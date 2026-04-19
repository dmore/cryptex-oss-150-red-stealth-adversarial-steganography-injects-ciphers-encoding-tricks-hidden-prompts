# Internal: CSP and CORS in Cryptex

> This document is **internal engineering reference**, not user-facing
> documentation. Cryptex is a SaaS — end users never deploy their own
> nginx, Docker, or Dokploy. If you're reading this, you're working on
> Cryptex's infrastructure or debugging a production incident involving
> outbound provider calls.

## Why it matters

If you self-host Cryptex via nginx, Docker, or Dokploy and can't reach
Groq, OpenAI, Gemini, or any other first-party provider from the
browser, the cause is almost always your own deployment's
**Content-Security-Policy** header, not the provider. Cryptex caught
itself in this trap for weeks before we traced it. This guide documents
what broke, what was fixed, and the 90-second check you can run on any
Cryptex deployment to confirm your CSP allows outbound calls to the
providers you care about.

## What actually went wrong (and the fix)

Cryptex v1 shipped an nginx config whose CSP looked like this:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://openrouter.ai https://pagead2.googlesyndication.com; …" always;
```

The `connect-src` directive is the one that matters here. It enumerates
every origin the browser is allowed to open a `fetch()` or `XHR` to.
Our list contained exactly two external origins: OpenRouter (our
default) and the ad-frame for adsense. Every other provider — Groq,
Anthropic direct, OpenAI, Gemini, Together, Fireworks, DeepInfra,
Cerebras, SambaNova, and every custom OpenAI-compatible endpoint — was
silently blocked by the browser before the request ever left the
client.

The failure mode was indistinguishable from a CORS problem: the
`fetch()` threw a `TypeError: Failed to fetch`, exactly the same shape
the browser raises when a preflight `OPTIONS` request fails. For
months we patched the wrong end of the pipeline. The adapter code
grew a `suspectCors: true` flag that re-labeled every network failure
as "CORS"; the user-facing error banner said "can't reach Groq from
the browser" when what the browser actually meant was "my operator
forbade me from reaching Groq".

Commit `9bbd2d2` fixed the CSP directly:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: data: blob:; …" always;
```

`connect-src 'self' https: data: blob:` permits outbound HTTPS fetches
to any origin (provider APIs use HTTPS), plus data: and blob: URIs
for the attachment pipeline. This is the permissive-but-reasonable
posture for a BYOK client where every outbound call is scoped to a
key the user pasted themselves — the threat model doesn't justify a
per-provider allowlist.

## CORS truth (as of 2026-04-19)

Cryptex's build pipeline won't run a CORS preflight for you, but we
verified every supported provider's `OPTIONS` response directly with
`curl -X OPTIONS`. Every provider Cryptex ships a preset for returns
usable CORS headers:

| Provider | Origin | Returns `Access-Control-Allow-Origin` |
| --- | --- | --- |
| OpenRouter | `openrouter.ai` | Yes — wildcard |
| Anthropic direct | `api.anthropic.com` | Yes — with the `anthropic-dangerous-direct-browser-access` header |
| OpenAI | `api.openai.com` | **Yes** — echoes the Origin header |
| Google Gemini | `generativelanguage.googleapis.com` | **Yes** — via `/v1beta/openai` OpenAI-compat layer |
| Groq | `api.groq.com` | Yes — wildcard |
| Together | `api.together.xyz` | Yes |
| Fireworks | `api.fireworks.ai` | Yes |
| DeepInfra | `api.deepinfra.com` | Yes |
| Cerebras | `api.cerebras.ai` | Yes |
| SambaNova | `api.sambanova.ai` | Yes |

Every entry in the Cryptex "Add provider" picker reaches its upstream
direct from the browser. The two presets added in April 2026 —
OpenAI and Gemini — were the last holdouts, and their CORS status
flipped quietly over 2025. The older Cryptex copy claiming "OpenAI
doesn't accept browser requests" was stale.

## Check your CSP

If you've forked Cryptex or wrapped it in an unfamiliar deployment
(reverse proxy, CDN, WAF, Dokploy with custom headers), run this
one-liner in the browser DevTools console on your deployed Cryptex
origin:

```js
fetch('https://api.groq.com/openai/v1/models', { method: 'GET' })
  .then((r) => console.log('ok', r.status))
  .catch((e) => console.error('blocked:', e.message));
```

Three possible outcomes:

- `ok 401` or `ok 200` — Your CSP allows the fetch; you'll just need a
  valid Groq key for the probe to return 200.
- `blocked: Failed to fetch` with a separate console line reading
  `Refused to connect to 'https://api.groq.com/…' because it violates
  the following Content Security Policy directive: "connect-src 'self'
  …"` — That's the CSP refusing the fetch. Fix the header.
- `blocked: Failed to fetch` with **no** accompanying CSP violation —
  That's a real network problem (DNS, TLS, corporate egress firewall,
  extension intercept). The CSP isn't your culprit; look at the
  network tab and your corporate proxy settings.

Swap `api.groq.com` for any other provider origin you want to test
(`api.openai.com`, `generativelanguage.googleapis.com`, etc.). The
same three-outcome chart applies.

## Fix your CSP

If the console showed a CSP violation, widen `connect-src` in your
deployment. The simplest drop-in replacement for the stale Cryptex
config:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: data: blob:; frame-ancestors 'none';" always;
```

Then restart nginx (`nginx -s reload` or `docker compose restart
cryptex-web`). The new policy takes effect immediately on the next
page load. The per-origin allowlist approach — `connect-src 'self'
https://api.openai.com https://api.groq.com …` — works too but is
tedious to maintain when new presets are added.

## Optional hardening: the Cloudflare Worker proxy

For users on locked-down networks (corporate proxies that strip
fetches, compliance regimes that require outbound traffic via a
vendored relay, or setups where you want domain-pinning enforced by
something other than the browser), a one-hop proxy is still a good
tool. It's no longer the **primary** fix, but it's the right answer
when your environment forbids the direct browser-to-provider path for
reasons unrelated to Cryptex.

### Deploy the worker

The template is one file at `infra/cors-proxy/cloudflare-worker.js`
in the Cryptex repo. The core of it is three lines:

```js
const upstream = env.UPSTREAM + new URL(request.url).pathname;
const response = await fetch(upstream, { method, headers, body });
return response with Access-Control-Allow-Origin: *;
```

Deploy steps:

1. Sign in at [Cloudflare dashboard](https://dash.cloudflare.com). The
   free tier covers 100k requests/day.
2. **Workers & Pages → Create → Create Worker**.
3. Paste the contents of `cloudflare-worker.js`.
4. **Save and Deploy**.
5. **Settings → Variables** — add:
   - `UPSTREAM` = `https://api.groq.com/openai/v1` (or whichever
     provider you're proxying).
   - `SHARED_SECRET` (optional but recommended) = a long random
     string; the worker requires clients to present it via header.
6. Copy the worker URL — e.g.
   `https://cryptex-groq.<you>.workers.dev`.

### Wire it into Cryptex

1. **Settings → Add provider → Custom endpoint.**
2. Name: `Groq (proxy)` or whatever you remember.
3. Base URL: the worker URL (the worker appends the path).
4. API key: your real Groq key — the worker just forwards it.
5. Save.

One worker per provider is the sensible pattern. Each worker pins
exactly one upstream, which limits blast radius if a key leaks.

## The summary

The "I can't reach $provider" error you've seen is almost always your
CSP, and in Cryptex's case specifically it was the CSP this
repository's own nginx config shipped with. The fix is to widen
`connect-src` to allow HTTPS broadly, which matches the BYOK-client
threat model. Every supported provider is CORS-open from the browser,
verified. The Cloudflare Worker proxy remains a reasonable fallback
for locked-down networks but is no longer the default path to take.
