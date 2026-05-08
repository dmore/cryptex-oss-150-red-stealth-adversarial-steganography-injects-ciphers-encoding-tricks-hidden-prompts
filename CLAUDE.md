# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Cryptex OSS is a **SvelteKit 2 + Svelte 5 + shadcn-svelte static-site app** for LLM red-teaming techniques. The deliverable is a single-page browser app, served as static files. There is no backend, no database, and no auth — every piece of state lives in `localStorage`. The app exposes 25 tool routes (10 technique workbenches under `/transforms`, `/decode`, etc., plus 15 red-team labs under `/redteam/*`).

A Python CLI (`cryptex-cli`, managed with `uv`) shells out to Node to execute the canonical transformers in `src/transformers/`, so there is **one source of truth** for transforms — both the SvelteKit app and the CLI import the same 159 transformer files.

This is the OSS extraction of a larger closed-source platform. The extraction design doc at `docs/superpowers/specs/2026-05-09-cryptex-oss-extraction-design.md` records what was removed and why.

## Commands

### Primary (SvelteKit app)

```bash
cd app && npm install              # install deps
cd app && npm run dev              # Vite dev server, http://localhost:5173
cd app && npm run check            # svelte-kit sync + svelte-check (type-check)
cd app && npx vitest run           # run all unit tests
cd app && npx vitest run path/to/file.test.ts   # run a single test
cd app && npm run build            # static build → app/build/
```

### Legacy parity tests (root)

A handful of legacy JS tests still live at the repo root and run against the transformer source.

```bash
npm test                           # tests/test_universal.js
npm run test:steg                  # tests/test_steganography_options.js
npm run test:lexeme                # tests/test_lexeme_analysis.js
npm run test:lexeme-ui             # tests/test_lexeme_ui_surface.js
npm run test:all                   # all four (precommit gate)
```

Run a single one directly: `node tests/test_universal.js`.

### Python CLI (cryptex-cli)

```bash
uv run cryptex-cli list
uv run cryptex-cli inspect caesar --json
uv run cryptex-cli encode --transform base64 --text "Hello"
uv run cryptex-cli /base64 --decode SGVsbG8=          # slash-command form
uv run cryptex-cli auto-decode --text "SGVsbG8="
pytest                                                 # python_tests/
```

### Docker

```bash
docker compose up --build          # → http://localhost:8080
```

The image is `nginx:1.27-alpine` serving `app/build/`. Same `app/build/` as the static deploy path.

## Architecture

### Transformers (the 159 transforms — single source of truth)

- Live in `src/transformers/<category>/<name>.js` — **category = directory name** (ancient, case, cipher, encoding, fantasy, format, special, technical, unicode, visual).
- Each file does `export default new BaseTransformer({...})` from `src/transformers/BaseTransformer.js`.
- **Auto-discovered.** Adding a new file is sufficient; the registry picks it up.
- `src/transformers/loader-node.js` is the **Node-side** loader used by `scripts/cli_bridge.js` (the CLI's subprocess entry point). The web app uses Vite `import.meta.glob` instead. Same modules, two front-doors.
- `priority` (1–310) controls the universal decoder's ranking when auto-detecting format. See the priority guide at the bottom of `BaseTransformer.js`. Unique character sets (Binary, Morse, Braille) sit at 300; Unicode lookalikes default to 85; ciphers at 60; invisible-text at 1.

### Multi-provider AI gateway (BYOK)

All AI calls route through `app/src/lib/ai/gateway.ts`. It exposes:

- `chat(req) → ChatResponse`
- `streamChat(req)` — async iterator of stream chunks
- `fetchModels(signal)` — aggregates catalogs across every enabled provider
- `validateKey(providerId, candidate, opts)` — per-provider key probe
- `resolve(modelId)` — routes qualified ids (`openrouter:…`, `anthropic:…`, `openai-compat:<instance>/…`) to the right adapter; unqualified ids default to OpenRouter.

Provider config lives in `app/src/lib/ai/providers.svelte.ts` and is persisted under `cryptex.providers` in `localStorage`. Adapters in `app/src/lib/ai/adapters/` are lazy-imported.

Supported providers:
- **OpenRouter** (default, CORS-open)
- **Anthropic direct** (uses `anthropic-dangerous-direct-browser-access` header)
- **OpenAI-compatible endpoints** (Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, custom)

Direct OpenAI / Google Gemini are **not supported** from the browser — no CORS. Users route those models through OpenRouter.

### Technique registry

`app/src/lib/techniques/registry.ts` aggregates everything available to the workbenches:

- 159 transformers (re-exported from the `src/transformers/` registry)
- **36 mutators** in `from-mutators.ts` — single-prompt rewriters (rephrase, obfuscate, roleplay, multilingual, fragment, custom, red_team_persona, step_back, chain_of_verification, ctf_framing, rfc_style, payload_split, hypothetical_world, cipher_encode_bypass, pap_logical, pap_authority, many_shot, tap_seeder, plus E1-E5 expansion entries)
- **8 classifier-evasion techniques** in `from-classifier.ts` (circumlocution, metonymy, semantic_decomposition, technical_register, academic_framing, temporal_displacement, perplexity_raise, plus one expansion entry)
- **3 conversation modes** in `modes/` (creative, intelligent, adaptive)
- **4 composites** in `from-composites.ts` (base64_smuggle, grammar_constrained_output, layered_mutation, multi_layer_attack)

### Tool state

- Per-tool form state and outputs are persisted via `app/src/lib/tools/repo.ts`, which writes to `localStorage` under the `cryptex.toolStates` key.
- All access is browser-guarded — there is no SSR for stateful pages.
- No tool component reads `localStorage` directly; everything goes through `repo.ts`.

### Routes

- File-based SvelteKit routing under `app/src/routes/`.
- 25 tool routes: 10 technique routes (`/transforms`, `/decode`, `/emoji`, `/gibberish`, `/tokenizer`, `/tokenade`, `/bijection`, `/fuzzer`, `/promptcraft`, `/anticlassifier`) and 15 redteam routes (`/redteam/adv-suffix`, `/redteam/glitch-tokens`, `/redteam/ocr-injection`, `/redteam/markdown-exfil`, `/redteam/probe-lab`, `/redteam/cross-model-diff`, `/redteam/replayer`, `/redteam/tool-result-lab`, `/redteam/indirect-injection`, `/redteam/harmbench`, `/redteam/strongreject`, `/redteam/jbb`, `/redteam/fingerprinter`, `/redteam/watermark`, `/redteam/pdf-injection`).
- Plus `/`, `/about`, `/guide/*`, `/privacy`, `/terms`, `/settings`.

### Two-layer access to transforms (web vs CLI)

- **Web**: SvelteKit app loads transformers via `app/src/lib/transformers/registry.ts` (Vite `import.meta.glob` over `src/transformers/`).
- **CLI**: Python (`cryptex_cli/bridge.py`) spawns `node scripts/cli_bridge.js`, which `require`s `src/transformers/loader-node.js` and exchanges JSON over stdio. This is why changes to a transform are instantly reflected in the CLI — no separate build step beyond the regular `npm run build`.

## Generated / gitignored paths — do not edit

- `app/build/` — SvelteKit static output (the deployable artifact).
- `app/.svelte-kit/` — Vite/SvelteKit cache.
- `dist/` — legacy promote target; effectively unused in OSS but the directory may exist if you ran `scripts/promote-dist.js`.
- `src/transformers/index.js` — regenerated by `npm run build:index`. Don't hand-edit; add new files instead.

If you see stale state after editing transforms, re-run `npm run build` from the repo root before debugging.

## Deployment

Static site, deploys anywhere. The repo ships a `Dockerfile` + `nginx.conf` for container deploys (Dokploy-friendly out of the box). Build runs `cd app && npm run build`; image is `nginx:1.27-alpine` serving the static output.

Build args plumbed through `Dockerfile` + `docker-compose.yml`:

- `BASE_PATH` — subpath like `/cryptex`. Empty for root-domain deploys.

That is the only build-time env in OSS. Auth, Supabase, ads, and analytics build args were removed in the OSS extraction.

## When adding things

- **New transformer**: create `src/transformers/<category>/<name>.js`, run `npm run build`, add coverage to `tests/test_universal.js`. Pick `priority` using the guide in `BaseTransformer.js`.
- **New tool surface**: create the Svelte component in `app/src/lib/components/tools/<tool>/` (or `app/src/lib/components/redteam/<tool>/`), add the route at `app/src/routes/<tool>/+page.svelte`, and register the tab in `app/src/lib/components/shell/TabRail.svelte`.
- **New mutator/classifier/composite**: add an entry to `app/src/lib/techniques/from-mutators.ts` (or the relevant sibling). It will surface in PromptCraft and the technique registry automatically.

## Removed in OSS (for context)

The OSS extraction stripped out:

- Multi-turn chat playground (`/chat`, `/chat/:id`)
- Dataset Inspector (`/dataset`) + ShareGPT/JSONL export pipeline
- Auth pipeline (Supabase, OAuth, password reset, sessions, RLS)
- Encrypted BYOK key vault (PBKDF2 + AES-GCM)
- Attack-chain orchestrator + Crescendo escalation engine
- Godmode local engine + edge-function client
- Dexie/IndexedDB layer (chats, messages, attachments tables)
- Billing, subscriptions, ads, Google Analytics

If you're touching code that references any of these, check `docs/superpowers/specs/2026-05-09-cryptex-oss-extraction-design.md` first — it might be a stale reference that should be deleted.
