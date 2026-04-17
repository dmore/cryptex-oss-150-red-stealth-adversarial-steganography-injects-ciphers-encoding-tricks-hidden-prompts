# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Cryptex is a **static site** text-transformation / steganography app mid-migration from Vue 2.6 → SvelteKit 2 + Svelte 5 + shadcn-svelte. The **new UI** lives under `app/`; the legacy Vue UI is still in place under `js/`, `css/`, `templates/`, `build/` and will be removed in Phase 4 of the migration. `dist/` is the deploy output (SvelteKit build promoted from `app/build/` by `scripts/promote-dist.js`) and is **gitignored** — you must install and build after clone.

A Python CLI (`cryptex-cli`, managed with `uv`, invoked as `cryptex`) shells out to Node to execute the canonical transformers in `src/transformers/`, so there is **one source of truth** for transforms — both the legacy Vue app and the new SvelteKit app import the same 162 transformer files, and so does the CLI.

Migration plan + context: `C:\Users\m4xx\.claude\plans\use-superpower-skills-which-joyful-sundae.md`.

## Commands

### Primary (new SvelteKit build)
```bash
npm install                # root deps (serve, test runners only)
cd app && npm install      # SvelteKit app deps
npm run build              # from root: cd app && npm run build && promote-dist.js → dist/
npm run app:dev            # Vite dev server on :5173 (from root)
npm run app:check          # svelte-kit sync + svelte-check (type-check)
npm run app:test           # Vitest unit tests (transformer registry + gibberish parity)
```

### Legacy (Vue 2 build — being retired)
```bash
npm run build:legacy       # tools → copy → index → transforms → emoji → templates (six-step homegrown pipeline)
npm run build:tools        # discovers js/tools/*Tool.js → updates index.template.html + toolRegistry.js
npm run build:copy         # css/, js/, favicon → dist/
npm run build:index        # writes src/transformers/index.js (ES module index)
npm run build:transforms   # bundles src/transformers/ → dist/js/bundles/transforms-bundle.js
npm run build:emoji        # writes dist/js/data/emojiData.js (merges src/emojiWordMap.js)
npm run build:templates    # injects templates/*.html → dist/index.html
```

### Run locally
- Open `dist/index.html` directly (no server needed), **or** `npm start` (serves `dist/` at http://localhost:8080), **or** `npm run preview` (build + serve in one step).

### Tests
```bash
npm test                   # tests/test_universal.js (alias: npm run test:universal)
npm run test:steg          # tests/test_steganography_options.js
npm run test:lexeme        # tests/test_lexeme_analysis.js
npm run test:lexeme-ui     # tests/test_lexeme_ui_surface.js
npm run test:all           # runs all four (this is what CI and `precommit` run)
```

Run a single test file directly: `node tests/test_universal.js` (tests use `path.resolve(__dirname, '..')` to locate the project root).

### Python CLI (cryptex-cli)
```bash
uv run cryptex-cli list
uv run cryptex-cli inspect caesar --json
uv run cryptex-cli encode --transform base64 --text "Hello"
uv run cryptex-cli /base64 --decode SGVsbG8=        # slash-command form
uv run cryptex-cli auto-decode --text "SGVsbG8="
pytest                     # python_tests/ (configured in pyproject.toml)
```

## Architecture

### Transformers (the 159 transforms)
- Live in `src/transformers/<category>/<name>.js` — **category = directory name** (ancient, case, cipher, encoding, fantasy, format, special, technical, unicode, visual).
- Each file `export default new BaseTransformer({...})` from `src/transformers/BaseTransformer.js`.
- Transformers are **auto-discovered**. Adding a new file and running `npm run build` is sufficient — no manual registration.
- Two generated artifacts downstream: `src/transformers/index.js` (for the browser bundle) and the bundle itself at `dist/js/bundles/transforms-bundle.js`. Both are gitignored.
- `src/transformers/loader-node.js` is the **Node-side** loader used by `scripts/cli_bridge.js` (the CLI's subprocess entry point) — it's what lets the Python CLI reuse the same transforms as the web app.
- `priority` (1–310) controls the universal decoder's ranking when auto-detecting format. See the priority guide at the bottom of `BaseTransformer.js`. Unique character sets (Binary, Morse, Braille) sit at 300; Unicode lookalike transforms default to 85; ciphers at 60; invisible-text at 1.

### Tools (the UI tabs)
- `js/tools/*Tool.js` extend `js/tools/Tool.js`. Each owns one tab and contributes Vue `data`, `methods`, `watchers`, `lifecycle` via `getVueData()` / `getVueMethods()` / etc.
- `build/inject-tool-scripts.js` **auto-discovers** every `*Tool.js`, writes script tags into `index.template.html`, and regenerates registration code in `js/core/toolRegistry.js`. Run `npm run build:tools` after adding a new tool file.
- `js/core/toolRegistry.js` merges all tools' Vue surfaces into the single Vue 2 app instance in `js/app.js`.

### Critical Vue-template caveat
Vue 2's `v-html` **does not compile** templates. This means:
- Tab HTML that uses `v-if` / `v-for` / `v-model` / `{{ }}` **must** live in `templates/*.html` (injected into `dist/index.html` at build time by `build/inject-tool-templates.js`), **not** in `Tool.getTabContentHTML()`.
- `getTabContentHTML()` is only safe for fully static HTML with inline handlers. See `docs/TOOL_ARCHITECTURE.md` for the rule in full.
- When adding a new Vue-driven tab, create `templates/<tabid>.html` **and** list it in `build/inject-tool-templates.js`.

### OpenRouter-backed features
AI Translation (on the Transform tab), PromptCraft, Anti-Classifier, and the Decoder's optional "translate to English" all call OpenRouter directly from the browser using a key the user pastes into Advanced Settings. The key is stored in `localStorage` only. `js/data/openrouterModels.js` is the model catalog.

### Two-layer access to transforms (web vs CLI)
- **Web**: Vue app loads `dist/js/bundles/transforms-bundle.js` → `window.transforms`.
- **CLI**: Python (`cryptex_cli/bridge.py`) spawns `node scripts/cli_bridge.js`, which `require`s `src/transformers/loader-node.js` and exchanges JSON over stdio. This is why changes to a transform are instantly reflected in the CLI — no separate build step.

## Generated / gitignored paths — do not edit
- `dist/` (entire directory — the built app)
- `src/transformers/index.js` (regenerated by `build:index`)
- `dist/js/bundles/transforms-bundle.js`
- `dist/js/data/emojiData.js`
- Legacy `js/bundles/transforms-bundle.js`, `js/data/emojiData.js` if present

If you see stale state after editing, re-run the specific `build:*` step (or full `npm run build`) before debugging — many "bugs" are just an unbuilt `dist/`.

## Deployment
`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on push to `main`/`master`. It runs `npm run test:all` first and verifies three critical output files (`dist/index.html`, the transforms bundle, the emoji data) exist before uploading.

## When adding things
- **New transformer**: create `src/transformers/<category>/<name>.js`, `npm run build`, add coverage to `tests/test_universal.js`. Pick `priority` using the guide in `BaseTransformer.js`. If updating the README catalog, use `build/readme-transform-section.js`.
- **New tool/tab**: create `js/tools/MyTool.js` (extend `Tool`), create `templates/mytool.html` if Vue directives are needed, add it to the ordered list in `build/inject-tool-templates.js`, then `npm run build`.
