# Deploying Cryptex

Cryptex is a single-container static site. Three tested targets:

1. **[Dokploy on a VPS](#1-dokploy-on-hostinger-or-any-vps)** — recommended for self-hosters.
2. **[Plain Docker](#2-plain-docker)** — anywhere with Docker.
3. **[GitHub Pages](#3-github-pages)** — for forks of this repo.

---

## 1. Dokploy (on Hostinger or any VPS)

Dokploy is an open-source PaaS that builds from your GitHub repo, handles Traefik routing, and provisions Let's Encrypt certs automatically. This is the path we optimize for.

### 1.1. Install Dokploy on the VPS

SSH to your Hostinger / Contabo / whatever VPS as root, then:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

The installer sets up Docker + Traefik + the Dokploy dashboard. After it finishes, open `http://<your-server-ip>:3000` and complete the first-run admin setup (email, password, organization name).

### 1.2. Point your DNS at the VPS

Create an `A` record for the domain you want (e.g. `cryptex.your-domain.com`) pointing at the VPS public IP. Give DNS ~2 minutes to propagate.

### 1.3. Add Cryptex as a Dokploy application

1. In the Dokploy dashboard, click **Create Application**.
2. **Source**: GitHub → connect your GitHub account → pick the forked Cryptex repo, branch `main` (or `master`).
3. **Build Type**: Docker Compose. Dokploy auto-detects `docker-compose.yaml` at the repo root.
4. **Domain**: add `cryptex.your-domain.com`, tick **HTTPS** and **Certificate Provider: Let's Encrypt**.
5. **Port**: `80` (the internal container port; Dokploy handles external 80/443 via Traefik).

### 1.4. Set build variables

Under the application's **Environment** tab, add:

| Variable | Value | Purpose |
|---|---|---|
| `BASE_PATH` | *(leave empty)* | Set to `/cryptex` if serving at a subpath. |
| `PUBLIC_ADSENSE_CLIENT` | `ca-pub-XXXXXXXXXXXXXXXX` | Optional. Omit to disable ads entirely. |
| `TZ` | `UTC` or e.g. `Asia/Kolkata` | Container log timezone. |
| `CRYPTEX_PORT` | *(not needed)* | Only for standalone docker-compose. |

> AdSense is a **build-time** variable — Vite inlines it into the static bundle. Changing it requires a rebuild (Dokploy: click **Rebuild**).

### 1.5. Enable Traefik labels

Open `docker-compose.yaml` and uncomment the **`traefik.*`** label block. Replace `cryptex.your-domain.com` with your actual domain. Commit and push — Dokploy auto-deploys via its GitHub webhook.

Alternatively: Dokploy's **Domains** tab can set these labels for you through the UI. Either path works.

### 1.6. First deploy

Hit **Deploy**. Watch the build log — first build takes ~2-3 minutes (node_modules install + SvelteKit build). Subsequent pushes auto-deploy via the webhook Dokploy registers in your GitHub repo.

When the build succeeds, `https://cryptex.your-domain.com` will be live with a valid Let's Encrypt cert.

### 1.7. Verify

```bash
# Healthcheck (used by Docker + Traefik)
curl https://cryptex.your-domain.com/health
# → "ok"

# Tool route
curl -sI https://cryptex.your-domain.com/transforms/ | head -1
# → HTTP/2 200
```

### 1.8. AdSense approval flow

If you set `PUBLIC_ADSENSE_CLIENT`:

1. Sign into https://adsense.google.com and add `cryptex.your-domain.com` as a site.
2. Google reviews your site (days to weeks). During review, ads don't render — but the consent banner and `<ins>` placeholders are in the DOM.
3. Once approved, ads appear on `/guide/*` and `/about/*` only. Tool pages stay ad-free regardless of consent.
4. Visitors see the consent banner once; **Accept** loads the AdSense script, **Reject** keeps the page script-free for that visitor.

---

## 2. Plain Docker

For any Linux host with Docker + docker-compose:

```bash
git clone https://github.com/m4xx101/cryptex.git
cd cryptex
cp .env.example .env
# Edit .env — set PUBLIC_ADSENSE_CLIENT only if you actually want ads.
docker compose up -d --build
```

Cryptex serves on `http://localhost:${CRYPTEX_PORT:-8080}`. Put a reverse proxy (nginx, Caddy, Traefik) in front for TLS.

### Rebuild after env change

```bash
docker compose up -d --build
```

### View logs

```bash
docker compose logs -f cryptex
```

### Stop

```bash
docker compose down
```

---

## 3. GitHub Pages

The workflow at `.github/workflows/deploy.yml` publishes `app/build/` to Pages on every push to `main`/`master`.

1. Fork this repo.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Push a commit. The workflow:
   - Runs legacy transformer tests (`npm run test:all`)
   - Runs app unit tests (`npm run test:unit`)
   - Runs `svelte-check`
   - Builds with `BASE_PATH` derived from your repo name
   - Publishes `app/build/` to Pages.

Pages URL: `https://<your-handle>.github.io/<repo-name>/`.

> GitHub Pages **cannot set `PUBLIC_ADSENSE_CLIENT`** without exposing the value in the public workflow. For ads, use Dokploy or plain Docker.

---

## Upgrading

Cryptex follows semantic versioning on the image tag. To pin:

```yaml
# In docker-compose.yaml
services:
  cryptex:
    image: cryptex:v1.2.3  # instead of :latest
```

On Dokploy: click **Pull new image + Redeploy** after each push to `main`.

---

## Troubleshooting

### Health check failing

```bash
docker exec cryptex wget -qO- http://localhost/health
# Should return: ok
```

If this fails inside the container, the build likely didn't produce `app/build/index.html`. Inspect build logs; the most common cause is a missing `PUBLIC_*` env var the app code expects.

### CSP blocks something

Open the browser DevTools console. CSP violations show as `Refused to load …`. Edit `nginx.conf`'s `Content-Security-Policy` header and redeploy.

### Ads don't appear after Google approval

1. Visit `/settings` → check **Ad consent** = `accepted`.
2. DevTools → Network → refresh → look for `adsbygoogle.js` loading. If absent, AdSense wasn't configured at build time — rebuild with `PUBLIC_ADSENSE_CLIENT` set.
3. Visit `/guide/` — ads only render on content routes, never on tool routes.
4. Google AdSense takes ~30 minutes after approval before ads actually serve inventory.

### GitHub Pages shows blank page

Check repo **Settings → Pages** — Source must be **GitHub Actions**, not a branch. The workflow needs `pages: write` permission (already set in the provided workflow).

---

## Configuration reference

| Variable | When | Default | Notes |
|---|---|---|---|
| `BASE_PATH` | Build-time | `""` | Subpath. Empty for root. |
| `PUBLIC_ADSENSE_CLIENT` | Build-time | *(unset)* | `ca-pub-…` for ads. |
| `TZ` | Runtime | `UTC` | Log timezone. |
| `CRYPTEX_PORT` | Runtime | `8080` | Host-side port (standalone only). |

All other app state is client-side: OpenRouter key lives in `localStorage` on the visitor's machine, never on the server.
