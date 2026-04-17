# Cryptex

**The AI red-teamer's text lab.** 162 transforms, 13 tools, zero telemetry, runs entirely in your browser.

Cryptex is the Swiss Army knife for LLM red-teaming, CTF challenges, and adversarial prompt research: classical + modern ciphers, Unicode exploits, emoji steganography, transform chains, BPE tokenizers, bijection payloads, mutation fuzzers, and BYOK AI rewrites through OpenRouter. Nothing leaves your browser unless you explicitly hit "translate" with your own API key.

[**→ GitHub**](https://github.com/m4xx101/cryptex) · [**→ Deploy your own (Docker / Dokploy)**](#deploy-your-own) · [**→ CLI**](#cli) · by [**@m4xx101**](https://github.com/m4xx101)

> **Ethical use.** Cryptex exists so security researchers, ML engineers, and red-teamers can evaluate model robustness under lexical, encoding, and semantic perturbation. Use it on systems you're authorized to test.

---

## Why you might actually use this

Large-language-model safety is evaluated, in practice, by feeding a model adversarial input and seeing what comes back. The hard parts are:

1. **Lexical transformation** — homoglyphs, Unicode abuse, zero-width characters, invisible tags.
2. **Encoding layering** — Base64 of ROT13 of Vigenère of your prompt. Then a decoder that finds its way back.
3. **Linguistic paraphrase** — same request, different words (and different languages).
4. **Reproducibility** — seeded RNGs, deterministic chains, shareable recipes.

Cryptex does all four in one local-first UI. Every transform is pure JS; the decoder uses a ranked-candidate priority system; the AI tools (PromptCraft, Anti-Classifier, Translate) all route through your own OpenRouter key so you control the model and your data never hits a Cryptex server (there is no Cryptex server).

---

## What's inside

| Tool | Purpose |
|---|---|
| **Transform** | 162 transforms across 10 categories — encodings, classical ciphers (Caesar, Vigenère, Playfair, ADFGVX, Bifid, Hill, Porta, Trifid, …), Unicode styling, ancient scripts (hieroglyphs, runes), fantasy alphabets (Tengwar, Aurebesh, Klingon), steganography, and format tricks. Favorites, recents, per-transform options, encode/decode toggle, live previews. |
| **Decode** | Universal decoder. Paste anything suspicious — runs every detector, ranks candidates by confidence + priority, surfaces alternatives. Explains *why* each candidate matched. |
| **Emoji** | Steganography via Unicode variation selectors (VS15/VS16) and the invisible Tags block. Round-trips ASCII, multi-byte UTF-8, and LSB-bit-order payloads. |
| **Gibberish** | Seeded dictionary-mapped gibberish (consistent word → pseudo-word substitution) and batch letter-removal for puzzle/jailbreak corpus generation. |
| **Splitter** | Chunk text by size / word / sentence / line / regex / GPT token count (cl100k · o200k · p50k · r50k). Optional per-message wrapping templates with `{n}` iterators. |
| **Tokenizer** | Visualize segmentation under UTF-8 / naive-word / GPT BPE encoders. Per-token color bands + IDs, character/word/token counts. |
| **Tokenade** | Parameterized token-bomb payload builder (depth × breadth × repeats). Emoji carriers, variation selectors, zero-width noise, Tag-sequence wrapping, 5 presets from *feather* to *super*. |
| **Bijection** | Generate "alphapr"-style character-substitution payloads — char→num, char→symbol, char→hex, char→emoji, char→Greek, digit+char mix, mixed, ROT variant. Configurable budget 1–50. |
| **Fuzzer** | 7 orthogonal mutation strategies (random-mix, zero-width, Unicode noise, whitespace, casing, Zalgo, homoglyph). Seeded; 1–500 variants per run; download-ready. |
| **PromptCraft** | 9 prompt mutation strategies — rephrase · obfuscate · role-play wrap · multi-language · expand · compress · metaphor · fragment · custom. Parallel variants across any OpenRouter model. |
| **Anti-Classifier** | Syntactic/paraphrase rewrites against a detailed research-oriented system prompt. Configurable model, temperature, max tokens. |
| **Translate** | 25+ languages including Latin, Sumerian, Akkadian, Old English, Sanskrit, Ancient Greek, Klingon (via custom language field). TranslateGemma prompt format with automatic Gemma-3 fallback. |

All OpenRouter-powered tools share a **live-catalog model picker**: the full model list is fetched from `/api/v1/models`, cached 1 hour, refreshable with one click, and auto-refetched when you save a new key. Fallback list ships if you're offline.

---

## Example red-team workflows

**1. Multi-layer encoding chain for CTF challenges.**

```
Transform tab  →  pick  Base64  →  encode
                        ↓ swap output → input
                ↓  pick  ROT13  →  encode
                        ↓ swap output → input
                ↓  pick  Vigenère  →  encode with key "CRYPTEX"

Decode tab     →  paste final string
                ↓  decoder surfaces:
                     primary: Vigenère (priority 60)
                     alt 1:  ROT13
                     alt 2:  Base64  → once you re-decode → your original text
```

**2. Jailbreak-session prompt mutation bank.**

1. **PromptCraft** — paste a single seed prompt, pick *Obfuscate* or *Multi-language* strategy, set variants = 10, run.
2. **Fuzzer** — take any promising variant, paste as seed, enable *homoglyph* + *zero-width* + *casing*, generate 200 variants, download as `.txt`.
3. **Bijection** — take the first 3 variants, generate 5 alphapr-mapping prompts each via "char→Greek" → you now have 15 research payloads teaching the model a substitution cipher first.
4. **Splitter** — split the corpus by sentence into numbered messages, wrap with `[{n}/{total}]`.

**3. Unicode abuse kit for filter evasion tests.**

- **Transform → Cyrillic Stylized / Fullwidth / Invisible Text / Zero-Width Steganography** to check which Unicode classes the target filter normalizes away.
- **Transform → Bitwise NOT / XOR Cipher / Baconian** for layered obfuscation.
- **Emoji → Emoji Steganography** to hide the actual payload inside a benign carrier (`🐉` + variation selectors).
- **Tokenade → Super preset** to bench an LLM's per-request cost ceiling under adversarial token volume.

**4. Multilingual paraphrase stress-test.**

- Seed prompt → **Translate → Latin** → copy → **PromptCraft → Rephrase** (English input) → take the English rewrite → **Translate → Klingon** (custom language) → store.
- Repeat across 10 languages, 3 rephrases each = 30 structurally distinct prompts preserving semantic intent.

**5. Classifier-robustness dataset.**

- **Fuzzer** with a known-benign seed → 500 variants with only `casing` + `whitespace` toggles → positive class.
- **Fuzzer** with the same seed + `homoglyph` + `zero-width` + `Zalgo` → negative / adversarial class.
- Pipe both through your classifier, measure drop.

---

## Getting started

### Local development

```bash
# Prereqs: Node 20+, npm, and uv (for the Python CLI)
git clone <your-fork>
cd cryptex

# Install + build (this is the ONLY build you need to run)
cd app
npm install
npm run dev               # http://localhost:5173 with hot reload
# or
npm run build             # static output → app/build/
```

### One-command Docker run

```bash
docker compose up --build
# → http://localhost:8080
```

### CLI

The Python CLI reuses the same 162 transformers the web app does (via a Node bridge — zero code duplication):

```bash
# Requires: uv (https://docs.astral.sh/uv/)
uv run cryptex list                                 # catalog
uv run cryptex inspect caesar --json                # option schema
uv run cryptex encode --transform base64 --text "Attack at dawn"
uv run cryptex decode --transform base64 --text "QXR0YWNrIGF0IGRhd24="
uv run cryptex auto-decode --text "QXR0YWNrIGF0IGRhd24="
uv run cryptex /caesar --shift 5 "Attack at dawn"   # slash-command form
uv run cryptex agent "encode 'Attack at dawn' as rot13"
```

---

## Deploy your own

**Full walkthrough:** see [`DEPLOY.md`](DEPLOY.md) for the step-by-step on all three targets, including DNS, TLS, AdSense approval, and troubleshooting.

### TL;DR

**Dokploy (on Hostinger/any VPS) — the recommended path:**

```bash
# On the VPS (one-liner installs Dokploy + Docker + Traefik)
curl -sSL https://dokploy.com/install.sh | sh

# Then in the Dokploy UI:
# 1. New Application → GitHub → this repo
# 2. Build Type: Docker Compose (auto-detected)
# 3. Domain: cryptex.your-domain.com + HTTPS (Let's Encrypt)
# 4. Build Variables: BASE_PATH (optional), PUBLIC_ADSENSE_CLIENT (optional)
# 5. Deploy. Done.
```

**Plain Docker on any host:**

```bash
git clone https://github.com/m4xx101/cryptex.git
cd cryptex
cp .env.example .env        # optional — only edit for ads / subpath
docker compose up -d --build
# → http://localhost:8080
```

**GitHub Pages:**

Fork the repo → repo Settings → Pages → Source: **GitHub Actions** → push. The workflow at `.github/workflows/deploy.yml` handles tests, Svelte type-check, build, and publish.

### Key environment variables

| Var | When | Purpose |
|---|---|---|
| `BASE_PATH` | Build-time | Subpath like `/cryptex`. Empty for root-domain deploys. |
| `PUBLIC_ADSENSE_CLIENT` | Build-time | `ca-pub-XXXX…`. Unset → zero ads, zero Google script. |
| `TZ` | Runtime | Container log timezone. |
| `CRYPTEX_PORT` | Runtime | Host-side port for standalone docker-compose (default `8080`). |

Tool pages **never** show ads regardless of config. Consent banner only appears when `PUBLIC_ADSENSE_CLIENT` is set at build time. See [`DEPLOY.md`](DEPLOY.md) for AdSense approval flow + consent mechanics.

---

## Architecture

```
cryptex/
├── app/                        # SvelteKit 2 + Svelte 5 + Tailwind + shadcn-svelte
│   └── src/
│       ├── routes/             # One folder per tool + /settings /about
│       └── lib/
│           ├── transformers/   # registry, decoder, options (pure TS)
│           ├── ai/             # openrouter client + reactive models store
│           ├── stores/         # reactive persisted state (theme, favorites, …)
│           ├── stego.ts        # emoji steganography engine
│           └── components/tools/{transform,decode,emoji,...}
├── src/transformers/           # 162 transformer modules, pure JS — SSOT
├── cryptex_cli/                # Python CLI (agent-flavored)
├── scripts/
│   ├── cli_bridge.js           # Node bridge: Python CLI → transformers
│   └── promote-dist.js         # app/build/* → dist/ for legacy deploy paths
├── Dockerfile + nginx.conf     # multi-stage static build + strict CSP
└── docker-compose.yaml         # Dokploy-friendly, port 8080 → 80
```

**Key design notes:**

- **One source of truth for transforms.** `src/transformers/` is consumed by three independent runtimes: the Svelte app (via Vite `import.meta.glob`), the Python CLI (via a Node sandbox in `scripts/cli_bridge.js`), and the legacy Vue app (still in-tree during migration). No transformer is ever duplicated.
- **BYOK, client-side only.** OpenRouter API keys live in `localStorage` under `cryptex.openrouterApiKey` as a reactive Svelte 5 `$state`. Saving in `/settings` validates the key against `/api/v1/auth/key` and auto-refreshes the live model catalog — all other open tabs update reactively with zero remounts.
- **Strict CSP.** The production nginx config allows `connect-src 'self' https://openrouter.ai` and nothing else. No third-party scripts, no CDNs, no telemetry. Font Awesome is gone; Lucide ships per-icon imports only.
- **162 transforms, 46 Vitest cases.** The test suite covers the transformer registry (smoke-loads every module), the universal decoder (parity with the legacy JS harness), the emoji stego engine (UTF-8 + LSB round-trips), and the OpenRouter client (key storage, model normalization, 401/402/403/404/429 classification, upstream-error unwrapping).

---

## Roadmap

- **Phase 3** — PWA service worker + installable shell + IndexedDB-backed searchable copy history + teaching-mode inline explainers for the 20 most-taught ciphers.
- **Phase 4** — Retire the legacy `js/`, `css/`, `templates/`, `build/` trees; trim repo to the SvelteKit app + transformers + CLI only.

See `C:\…\.claude\plans\use-superpower-skills-which-joyful-sundae.md` for the full migration plan.

---

## Contributing

- **Add a transformer** → drop a file in `src/transformers/<category>/<name>.js`, extend `BaseTransformer`, rebuild (`npm run build`). Web app, Python CLI, and tests all pick it up automatically.
- **Add a tool tab** → new file under `app/src/lib/components/tools/<tool>/ToolName.svelte` + `app/src/routes/<tool>/+page.svelte`. Register it in `app/src/lib/components/shell/TabRail.svelte`.
- **Add tests** → `app/src/**/*.test.ts` for Vitest; `tests/*.js` for legacy transformer parity.

Run before a PR:

```bash
cd app && npm run check && npm run test:unit && npm run build
cd ..  && npm run test:all
uv run cryptex list  # confirm CLI integrity
```

---

## License

MIT. See `LICENSE`.

---

## Credits

Built by [**@m4xx101**](https://github.com/m4xx101). Cryptex is a ground-up rebrand and SvelteKit rewrite of the original P4RS3LT0NGV3 project — the 162 transformer modules preserve the classical-cipher lineage and Unicode abuse catalog built up over that project's lifetime.

Repo: <https://github.com/m4xx101/cryptex> · Issues & PRs welcome.
