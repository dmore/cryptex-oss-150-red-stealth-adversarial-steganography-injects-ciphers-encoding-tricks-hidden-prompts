# Cryptex OSS Extraction Design

**Date**: 2026-05-09
**Repo**: `cryptex-oss` (new public GitHub repo)
**License**: MIT
**Reference**: `OSS-Extraaction-Plan-ref.md` (original audit + plan)

## Goal

Extract the technique-tools surface of Cryptex into a standalone open-source
SvelteKit app. Ship 25 tool routes with full AI/BYOK capability. Strip chat
playground, dataset inspector, auth, billing, analytics, ads, and godmode.
No new code beyond a ~20 LOC localStorage refactor for tool state persistence.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AI capability | Full BYOK (all 3 adapters) | PromptCraft, Anti-Classifier, StrongREJECT, Probe Lab, Cross-Model Diff need LLM calls |
| Auth | Drop entirely | No Supabase, no OAuth, no login. BYOK API keys in localStorage only. Simple web app. |
| Mode toggle | Remove | TabRail always visible, no chat/tools switch |
| `/redteam/aggregation` | Drop | Depends on chat-run history tables that won't exist |
| Repo name | `cryptex-oss` | Explicitly signals open-source |
| License | MIT | Frictionless |

## What Ships

### Routes (25 tool routes + 5 informational)

**Technique tools (10)**:
`/transforms`, `/decode`, `/emoji`, `/gibberish`, `/promptcraft`,
`/anticlassifier`, `/bijection`, `/fuzzer`, `/tokenade`, `/tokenizer`

**Red-team workbenches (15)**:
`/redteam/adv-suffix`, `/redteam/glitch-tokens`, `/redteam/ocr-injection`,
`/redteam/markdown-exfil`, `/redteam/probe-lab`, `/redteam/cross-model-diff`,
`/redteam/replayer`, `/redteam/tool-result-lab`, `/redteam/indirect-injection`,
`/redteam/harmbench`, `/redteam/strongreject`, `/redteam/jbb`,
`/redteam/fingerprinter`, `/redteam/watermark`, `/redteam/pdf-injection`

**Informational**: `/`, `/guide`, `/privacy`, `/terms`, `/about`, `/settings`

### Library modules kept

- `app/src/lib/ai/` -- gateway, adapters (openrouter, anthropic, openai-compat),
  catalog, providers (vault path stripped), presets, types, errors, model-label,
  storage-strategy, validate
- `app/src/lib/techniques/` -- lifted from `chat/techniques/` (registry,
  from-mutators, from-classifier, from-composites, from-prefills, types, modes/)
- `app/src/lib/transformers/` -- registry, decoder, options
- `app/src/lib/redteam/` -- 15 workbench data + logic
- `app/src/lib/stego.ts`, `app/src/lib/config/`, `app/src/lib/utils/`,
  `app/src/lib/guide/`
- `app/src/lib/stores/` -- theme, toast, favorites, lastUsed, techniqueRecents,
  tool-state, consent, _persisted, _migrate, shortcuts, sessionLog
- `app/src/lib/components/ui/` -- 96 shadcn components
- `app/src/lib/components/shell/` -- HeaderBar, TabRail, ToastHost, ThemeToggle, brand
- `app/src/lib/components/ai/` -- ModelPickerV2, NoProviderBanner, ErrorBanner
- `app/src/lib/components/tools/` -- 28 tool implementations
- `app/src/lib/components/brand/` -- Logo, Wordmark
- `app/src/lib/tools/repo.ts` -- refactored to localStorage

### What gets deleted (~22K LOC)

| Path | Approx LOC | Reason |
|---|---|---|
| `app/src/routes/chat/` | 1,680 | Chat playground |
| `app/src/routes/dataset/` | 183 | Dataset inspector |
| `app/src/routes/redteam/aggregation/` | ~220 | Depends on chat-run tables |
| `app/src/routes/login/`, `signup/`, `auth/` | 1,044 | Auth dropped |
| `app/src/lib/chat/` (after technique lift-out) | ~10,500 | Chat + chain + dispatch + dexie + repo |
| `app/src/lib/components/chat/` | 4,978 | Chat workspace + composer + chain UI |
| `app/src/lib/components/dataset/` | 701 | Dataset components |
| `app/src/lib/components/auth/` | 320 | Auth UI |
| `app/src/lib/components/billing/` | 142 | Billing feature |
| `app/src/lib/auth/` | ~1,200 | Supabase integration |
| `app/src/lib/billing/`, `analytics/`, `ads/`, `dataset/` | ~672 | Closed-product features |
| `app/src/lib/stores/` (5 chat stores) | ~150 | activeChat, chainUsage, lastChatModel, chatShortcuts, chatMode |
| `app/src/lib/chat/techniques/godmode/`, `from-transformers.ts` | ~520 | Godmode + dead glue |

### Dependencies dropped

- `dexie` (IndexedDB -- replaced by localStorage for tool state)
- `pdfjs-dist` (PDF extraction for chat attachments)
- `mammoth` (DOCX extraction for chat attachments)
- `@supabase/supabase-js` (auth)

### Dependencies kept

- `ai` (Vercel AI SDK -- powers gateway.streamChat)
- `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`
- All shadcn-svelte / bits-ui / tailwind / lucide-svelte UI deps
- `sonner` (toast notifications)

## Execution: 6 Atomic Commits

Each commit passes: `cd app && npm run check && npx vitest run && npm run build`

### Commit 1: Lift technique registry out of `chat/` namespace

**Move** (git mv + import path updates):
```
app/src/lib/chat/techniques/registry.ts       -> app/src/lib/techniques/registry.ts
app/src/lib/chat/techniques/from-mutators.ts   -> app/src/lib/techniques/from-mutators.ts
app/src/lib/chat/techniques/from-classifier.ts -> app/src/lib/techniques/from-classifier.ts
app/src/lib/chat/techniques/from-composites.ts -> app/src/lib/techniques/from-composites.ts
app/src/lib/chat/techniques/from-prefills.ts   -> app/src/lib/techniques/from-prefills.ts
app/src/lib/chat/techniques/types.ts           -> app/src/lib/techniques/types.ts
app/src/lib/chat/techniques/modes/             -> app/src/lib/techniques/modes/
```

**Delete** (not lifted):
- `app/src/lib/chat/techniques/godmode/` (closed-product engine)
- `app/src/lib/chat/techniques/from-transformers.ts` (unused glue)

**Update imports** in 3 consuming files:
- `app/src/lib/components/tools/promptcraft/strategies.ts`
- `app/src/routes/redteam/probe-lab/+page.svelte`
- `app/src/routes/about/+page.svelte`

Plus any others found via `grep -r 'lib/chat/techniques' app/src` that survive
the technique lift (chat-internal consumers get deleted in Commit 3).

### Commit 2: Refactor `lib/tools/repo.ts` to localStorage

**Before** (Dexie + auth):
```ts
import { db } from '$lib/chat/db';
import { session } from '$lib/auth/session.svelte';
// db.toolStates.put/get/delete with ownerId
```

**After** (localStorage, no auth):
```ts
const STORAGE_KEY = 'cryptex.toolStates';
function readAll(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function writeAll(data: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export const toolRepo = {
  async saveToolState(toolId: string, state: unknown) { ... },
  async loadToolState<T>(toolId: string): Promise<T | null> { ... },
  async deleteToolState(toolId: string) { ... }
};
```

Same external API. No `ownerId` concept (single-user OSS).

### Commit 3: Bulk delete chat + dataset + Dexie

**Delete directories**:
- `app/src/routes/chat/`
- `app/src/routes/dataset/`
- `app/src/lib/chat/` (everything remaining after Commit 1 lift)
- `app/src/lib/components/chat/`
- `app/src/lib/components/dataset/`
- `app/src/lib/dataset/`

**Delete stores**:
- `app/src/lib/stores/activeChat.svelte.ts`
- `app/src/lib/stores/chainUsage.svelte.ts`
- `app/src/lib/stores/lastChatModel.svelte.ts`
- `app/src/lib/stores/chatShortcuts.svelte.ts`
- `app/src/lib/stores/chatMode.svelte.ts`

**Update files**:
- `app/src/routes/+layout.svelte` -- remove chatMode import + conditional;
  TabRail renders unconditionally. Remove HistoryDrawer if chat-coupled.
- `app/src/lib/components/shell/TabRail.svelte` -- remove Chat/Dataset entries
  if present (audit found 26 tool-only entries, may be clean already)
- `app/src/lib/components/shell/HeaderBar.svelte` -- remove history drawer
  trigger if chat-coupled

**Drop dep**: `dexie` from `app/package.json`

### Commit 4: Drop auth + Supabase + closed-product features

**Delete directories**:
- `app/src/routes/login/`
- `app/src/routes/signup/`
- `app/src/routes/auth/`
- `app/src/lib/auth/`
- `app/src/lib/components/auth/`
- `app/src/lib/components/billing/`
- `app/src/lib/billing/`
- `app/src/lib/analytics/`
- `app/src/lib/ads/`

**Delete settings components** (100% auth-dependent):
- `app/src/lib/components/settings/SecurityPanel.svelte`

**Update settings components** (AI provider management -- KEEP, but strip auth):
- `app/src/lib/components/settings/AddProviderDialog.svelte` -- remove `session` import, remove any auth-gated logic
- `app/src/lib/components/settings/ProviderCard.svelte` -- remove `session` import, remove any auth-gated logic

**Update files**:
- `app/src/routes/+layout.svelte`:
  - Remove imports: ConsentBanner, UpgradeModal, ensureAdSenseState,
    ensureGaState, trackPageView, session
  - Remove mount-time calls: `ensureAdSenseState()`, `ensureGaState()`
  - Remove effect: `trackPageView(url.href)`
  - Remove component renders: `<ConsentBanner />`, `<UpgradeModal />`
- `app/src/lib/components/shell/HeaderBar.svelte`:
  - Remove: session import, signOut function, sign-out button block
- `app/src/routes/settings/+page.svelte`:
  - Remove SecurityPanel mount (if imported)
  - Keep ProvidersPanel + theme

**Drop deps from `app/package.json`**:
- `@supabase/supabase-js`
- `pdfjs-dist`
- `mammoth`

**Update deploy files**:
- `Dockerfile`: trim `VITE_AUTH_ENABLED`, `PUBLIC_SUPABASE_URL`,
  `PUBLIC_SUPABASE_ANON_KEY` build args
- `docker-compose.yml`: trim corresponding env vars

### Commit 5: Drop `/redteam/aggregation` + prune references

**Delete**: `app/src/routes/redteam/aggregation/`

**Update**:
- `TabRail.svelte`: remove aggregation entry
- Guide markdown files: remove `/redteam/aggregation` references
- Any other files referencing the route

### Commit 6: Polish -- README, LICENSE, CLAUDE.md, about page

**New files**:
- `README.md` -- OSS positioning ("the open-source technique toolkit from
  Cryptex"), quick start (clone + install + dev), tool list, Docker deploy,
  contributing guide
- `LICENSE` -- MIT
- `CLAUDE.md` -- stripped to OSS-relevant commands + architecture (no chat,
  no auth sections)

**Update**:
- `about/+page.svelte` -- remove chat/chain/dataset stats; keep technique
  counts + provider counts
- Clean up any remaining references to removed features

**Tag**: `v1.0.0`
**Push**: `gh repo create cryptex-oss --public && git push`

## Verification

### Per-commit gates
```bash
cd app && npm run check && npx vitest run && npm run build
```

### End-state smoke test
1. Fresh `npm install && npm run app:dev` -- 25 tool tabs visible
2. Settings -> paste OpenRouter key -> PromptCraft works end-to-end
3. No dead references: `grep -r 'dexie\|supabase\|routes/chat\|lib/auth' app/src` -> empty
4. `localStorage` persists tool state (devtools check)
5. Docker build + `docker run -p 8080:80` -> health check passes, `/transforms` loads
6. Bundle size < 2.5 MB (down from ~3-4 MB)

## Hard Constraints

- No new code beyond the localStorage refactor (~20 LOC in `lib/tools/repo.ts`)
- Every other change is a deletion or import path edit
- Tests stay green throughout -- delete orphan tests in the same commit
  that removes their source
- Deploy contract (Dockerfile / nginx.conf / docker-compose.yml) carries
  over, only build-arg list trimmed
- No per-file license headers; one top-level `LICENSE` (MIT)
