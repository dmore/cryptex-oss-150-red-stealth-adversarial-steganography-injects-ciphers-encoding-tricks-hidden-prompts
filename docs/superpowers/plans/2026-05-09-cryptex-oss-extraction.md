# Cryptex OSS Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract technique-tools surface of Cryptex into a standalone open-source SvelteKit app (`cryptex-oss`), stripping chat/dataset/auth/billing/analytics/ads/godmode.

**Architecture:** Surgical deletion from existing codebase. 6 atomic commits, each keeping the build green. One ~20 LOC refactor (tools/repo.ts Dexie→localStorage). Everything else is file deletion or import path updates.

**Tech Stack:** SvelteKit 2, Svelte 5, shadcn-svelte, Tailwind, Vercel AI SDK, TypeScript

---

## File Structure

### Files to CREATE
- `app/src/lib/techniques/registry.ts` (moved from chat/techniques/)
- `app/src/lib/techniques/from-mutators.ts` (moved)
- `app/src/lib/techniques/from-classifier.ts` (moved)
- `app/src/lib/techniques/from-composites.ts` (moved)
- `app/src/lib/techniques/from-prefills.ts` (moved)
- `app/src/lib/techniques/types.ts` (moved)
- `app/src/lib/techniques/modes/` (moved, 3 files)
- `LICENSE` (new)
- `README.md` (rewritten for OSS)
- `CLAUDE.md` (rewritten for OSS)

### Files to MODIFY
- `app/src/lib/tools/repo.ts` — Dexie→localStorage refactor
- `app/src/lib/techniques/registry.ts` — remove godmode + from-transformers imports
- `app/src/lib/components/tools/promptcraft/strategies.ts` — update import paths
- `app/src/routes/redteam/probe-lab/+page.svelte` — update import path
- `app/src/routes/about/+page.svelte` — update import paths + remove chat stats
- `app/src/routes/+layout.svelte` — strip ads/billing/analytics/auth/chatMode
- `app/src/lib/components/shell/HeaderBar.svelte` — strip auth sign-out
- `app/src/lib/components/shell/TabRail.svelte` — remove aggregation entry
- `app/src/routes/settings/+page.svelte` — strip auth sections
- `app/src/lib/ai/providers.svelte.ts` — strip vault/auth imports
- `app/src/lib/components/settings/AddProviderDialog.svelte` — strip session import
- `app/src/lib/components/settings/ProviderCard.svelte` — strip session import
- `app/src/lib/config/featureFlags.ts` — strip auth + godmode flags
- `Dockerfile` — trim auth build args
- `docker-compose.yml` — trim auth env vars
- `app/package.json` — drop dexie, pdfjs-dist, mammoth, @supabase/supabase-js

### Files/directories to DELETE (~22K LOC)
- `app/src/routes/chat/` (whole tree)
- `app/src/routes/dataset/` (whole tree)
- `app/src/routes/redteam/aggregation/` (whole tree)
- `app/src/routes/login/` (whole tree)
- `app/src/routes/signup/` (whole tree)
- `app/src/routes/auth/` (whole tree)
- `app/src/lib/chat/` (whole tree — after technique lift-out)
- `app/src/lib/auth/` (whole tree)
- `app/src/lib/components/chat/` (whole tree)
- `app/src/lib/components/dataset/` (whole tree)
- `app/src/lib/components/auth/` (whole tree)
- `app/src/lib/components/billing/` (whole tree)
- `app/src/lib/billing/` (whole tree)
- `app/src/lib/analytics/` (whole tree)
- `app/src/lib/ads/` (whole tree)
- `app/src/lib/dataset/` (whole tree)
- `app/src/lib/stores/activeChat.svelte.ts`
- `app/src/lib/stores/chainUsage.svelte.ts`
- `app/src/lib/stores/lastChatModel.svelte.ts`
- `app/src/lib/stores/chatShortcuts.svelte.ts`
- `app/src/lib/stores/chatMode.svelte.ts`
- `app/src/lib/chat/techniques/godmode/` (not lifted)
- `app/src/lib/chat/techniques/from-transformers.ts` (not lifted)
- `app/src/lib/components/settings/SecurityPanel.svelte`

---

## Task 1: Lift technique registry out of `chat/` namespace

**Files:**
- Move: `app/src/lib/chat/techniques/{registry,from-mutators,from-classifier,from-composites,from-prefills,types}.ts` → `app/src/lib/techniques/`
- Move: `app/src/lib/chat/techniques/modes/` → `app/src/lib/techniques/modes/`
- Modify: `app/src/lib/techniques/registry.ts` (fix internal imports, drop godmode+from-transformers)
- Modify: `app/src/lib/components/tools/promptcraft/strategies.ts`
- Modify: `app/src/routes/redteam/probe-lab/+page.svelte`
- Modify: `app/src/routes/about/+page.svelte`

- [ ] **Step 1: Create techniques directory and move files**

```bash
cd app/src/lib
mkdir -p techniques/modes
```

Copy these files (git mv):
```bash
cd "C:/Users/m4xx/Downloads/cryptex-tools/.claude/worktrees/wizardly-goldberg-9f5728"
git mv app/src/lib/chat/techniques/types.ts app/src/lib/techniques/types.ts
git mv app/src/lib/chat/techniques/from-mutators.ts app/src/lib/techniques/from-mutators.ts
git mv app/src/lib/chat/techniques/from-classifier.ts app/src/lib/techniques/from-classifier.ts
git mv app/src/lib/chat/techniques/from-composites.ts app/src/lib/techniques/from-composites.ts
git mv app/src/lib/chat/techniques/from-prefills.ts app/src/lib/techniques/from-prefills.ts
git mv app/src/lib/chat/techniques/registry.ts app/src/lib/techniques/registry.ts
```

For the modes/ directory, copy each file individually (git mv doesn't support directory moves cleanly on Windows):
```bash
git mv app/src/lib/chat/techniques/modes/creative.ts app/src/lib/techniques/modes/creative.ts
git mv app/src/lib/chat/techniques/modes/intelligent.ts app/src/lib/techniques/modes/intelligent.ts
git mv app/src/lib/chat/techniques/modes/adaptive.ts app/src/lib/techniques/modes/adaptive.ts
```

(Adjust filenames based on actual files in modes/ — list them first with `ls app/src/lib/chat/techniques/modes/`)

- [ ] **Step 2: Update registry.ts — remove godmode + from-transformers imports**

In `app/src/lib/techniques/registry.ts`, the current imports are:
```ts
import type { Technique, TechniqueCategory } from './types';
import { transformerTechniques } from './from-transformers';
import { mutatorTechniques } from './from-mutators';
import { classifierTechniques } from './from-classifier';
import { compositeTechniques } from './from-composites';
import { modes } from './modes';
import { godmodes } from './godmode';
import { prefillTechniques } from './from-prefills';
```

Remove the `from-transformers` and `godmode` import lines. Also remove any references to `transformerTechniques` and `godmodes` in the body of the file (they'll be in an array concatenation — remove those entries from the array).

The relative imports (`./types`, `./from-mutators`, etc.) are already correct since we moved all files together.

- [ ] **Step 3: Update promptcraft/strategies.ts imports**

In `app/src/lib/components/tools/promptcraft/strategies.ts`, change:
```ts
import { getMutatorSpecs } from '$lib/chat/techniques/from-mutators';
import { buildMutatorSystem } from '$lib/chat/techniques/from-mutators';
import { find as findTechnique, byCategory } from '$lib/chat/techniques/registry';
```
to:
```ts
import { getMutatorSpecs } from '$lib/techniques/from-mutators';
import { buildMutatorSystem } from '$lib/techniques/from-mutators';
import { find as findTechnique, byCategory } from '$lib/techniques/registry';
```

- [ ] **Step 4: Update probe-lab imports**

In `app/src/routes/redteam/probe-lab/+page.svelte`, change line 3:
```ts
import { mutatorTechniques } from '$lib/chat/techniques/from-mutators';
```
to:
```ts
import { mutatorTechniques } from '$lib/techniques/from-mutators';
```

- [ ] **Step 5: Update about page imports**

In `app/src/routes/about/+page.svelte`, change lines 4-6:
```ts
import { mutatorTechniques } from '$lib/chat/techniques/from-mutators';
import { classifierTechniques } from '$lib/chat/techniques/from-classifier';
import { compositeTechniques } from '$lib/chat/techniques/from-composites';
```
to:
```ts
import { mutatorTechniques } from '$lib/techniques/from-mutators';
import { classifierTechniques } from '$lib/techniques/from-classifier';
import { compositeTechniques } from '$lib/techniques/from-composites';
```

- [ ] **Step 6: Sweep for any remaining `lib/chat/techniques` imports**

```bash
grep -r "lib/chat/techniques" app/src --include="*.ts" --include="*.svelte" | grep -v "node_modules"
```

Any hits in files that are NOT being deleted (i.e., not in `lib/chat/`, `lib/components/chat/`, `routes/chat/`, `routes/dataset/`) need their imports updated to `$lib/techniques/`.

- [ ] **Step 7: Verify build**

```bash
cd app && npm run check && npx vitest run && npm run build
```

Expected: all pass. Some chat-related tests may reference the old paths — they'll be deleted in Task 3 so warnings are OK as long as the build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: lift technique registry out of chat/ namespace

Move $lib/chat/techniques/ → $lib/techniques/ (6 files + modes/).
Drop godmode/ and from-transformers.ts (closed-product, unused).
Update imports in promptcraft, probe-lab, about page."
```

---

## Task 2: Refactor `lib/tools/repo.ts` to localStorage

**Files:**
- Modify: `app/src/lib/tools/repo.ts`

- [ ] **Step 1: Rewrite repo.ts**

Replace the entire contents of `app/src/lib/tools/repo.ts` with:

```ts
const STORAGE_KEY = 'cryptex.toolStates';

function readAll(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — best-effort */ }
}

export const toolRepo = {
  async saveToolState(toolId: string, state: unknown): Promise<void> {
    const all = readAll();
    all[toolId] = state;
    writeAll(all);
  },
  async loadToolState<T = unknown>(toolId: string): Promise<T | null> {
    const all = readAll();
    return (all[toolId] as T) ?? null;
  },
  async deleteToolState(toolId: string): Promise<void> {
    const all = readAll();
    delete all[toolId];
    writeAll(all);
  }
};
```

The async signatures are kept so all existing callers (`useToolState` etc.) work without changes.

- [ ] **Step 2: Verify build**

```bash
cd app && npm run check && npx vitest run && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/tools/repo.ts
git commit -m "refactor: replace Dexie toolStates with localStorage

Same async API (saveToolState, loadToolState, deleteToolState).
Removes dependency on chat/db and auth/session.
Unblocks Dexie deletion in next commit."
```

---

## Task 3: Bulk delete chat + dataset + Dexie

**Files:**
- Delete: `app/src/routes/chat/` (whole tree)
- Delete: `app/src/routes/dataset/` (whole tree)
- Delete: `app/src/lib/chat/` (whole remaining tree after Task 1 lift)
- Delete: `app/src/lib/components/chat/` (whole tree)
- Delete: `app/src/lib/components/dataset/` (whole tree)
- Delete: `app/src/lib/dataset/` (whole tree)
- Delete: `app/src/lib/stores/activeChat.svelte.ts`
- Delete: `app/src/lib/stores/chainUsage.svelte.ts`
- Delete: `app/src/lib/stores/lastChatModel.svelte.ts`
- Delete: `app/src/lib/stores/chatShortcuts.svelte.ts`
- Delete: `app/src/lib/stores/chatMode.svelte.ts`
- Modify: `app/src/routes/+layout.svelte`
- Modify: `app/src/lib/components/shell/HeaderBar.svelte`
- Modify: `app/package.json` (drop dexie)

- [ ] **Step 1: Delete chat/dataset directories**

```bash
cd "C:/Users/m4xx/Downloads/cryptex-tools/.claude/worktrees/wizardly-goldberg-9f5728"
rm -rf app/src/routes/chat
rm -rf app/src/routes/dataset
rm -rf app/src/lib/chat
rm -rf app/src/lib/components/chat
rm -rf app/src/lib/components/dataset
rm -rf app/src/lib/dataset
```

- [ ] **Step 2: Delete chat-only stores**

```bash
rm app/src/lib/stores/activeChat.svelte.ts
rm app/src/lib/stores/chainUsage.svelte.ts
rm app/src/lib/stores/lastChatModel.svelte.ts
rm app/src/lib/stores/chatShortcuts.svelte.ts
rm app/src/lib/stores/chatMode.svelte.ts
```

- [ ] **Step 3: Update +layout.svelte — strip chat/ads/billing/analytics imports and components**

Replace the `<script>` block of `app/src/routes/+layout.svelte` with this cleaned version. The current imports at lines 1-18 become:

```svelte
<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import HeaderBar from '$lib/components/shell/HeaderBar.svelte';
  import TabRail from '$lib/components/shell/TabRail.svelte';
  import ToastHost from '$lib/components/shell/ToastHost.svelte';
  import { apply as applyTheme, watchSystemTheme } from '$lib/stores/theme.svelte';
  import { runLegacyMigration } from '$lib/stores/_migrate';
  import { initCatalogStore } from '$lib/ai/catalog.svelte';

  let { children } = $props();
```

Remove these imports entirely:
- `HistoryDrawer` (chat-coupled session history)
- `ConsentBanner` (ads)
- `UpgradeModal` (billing)
- `ensureAdSenseState` (ads)
- `ensureGaState`, `trackPageView` (analytics)
- `chatMode` (chat mode toggle)

Remove the `historyOpen` state variable.

In the `onMount` block, remove calls to `ensureAdSenseState()` and `ensureGaState()`.
Remove the `$effect` that calls `trackPageView(url.href)`.

In the template, change the conditional TabRail section from:
```svelte
{#if chatMode.value === 'tools' && !hideTabRail}
  <div class="mb-6"><TabRail /></div>
{/if}
```
to unconditional:
```svelte
{#if !hideTabRail}
  <div class="mb-6"><TabRail /></div>
{/if}
```

(Keep the `hideTabRail` logic if it exists for certain routes like `/guide`.)

Remove from the template:
```svelte
<HistoryDrawer open={historyOpen} onclose={() => (historyOpen = false)} />
<ConsentBanner />
<UpgradeModal />
```

Keep: `<ToastHost />`

In `HeaderBar` component invocation, remove the `onopenHistory` prop:
```svelte
<HeaderBar />
```

- [ ] **Step 4: Update HeaderBar.svelte — strip sign-out and history**

In `app/src/lib/components/shell/HeaderBar.svelte`:

Remove these imports:
```ts
import History from 'lucide-svelte/icons/history';
import LogOut from 'lucide-svelte/icons/log-out';
import Loader from 'lucide-svelte/icons/loader-circle';
import { session } from '$lib/auth/session.svelte';
```

Remove the `onopenHistory` prop if present.

Remove the entire `signingOut` state + `signOut()` function (lines 19-32).

Remove the sign-out button block (lines 117-132):
```svelte
{#if featureFlags.authEnabled && session.isSignedIn}
  <button ...>...</button>
{/if}
```

Remove the history button if it references `onopenHistory`.

Keep: Logo, Wordmark, ThemeToggle, ModePill, Settings link, HelpCircle, `sessionLog`.

- [ ] **Step 5: Drop dexie from package.json**

In `app/package.json`, remove the line:
```json
"dexie": "4.0.11",
```

Then run:
```bash
cd app && npm install
```

- [ ] **Step 6: Delete any orphan test files that import deleted modules**

```bash
grep -r "lib/chat\|lib/dataset\|lib/components/chat\|lib/components/dataset\|activeChat\|chainUsage\|lastChatModel\|chatShortcuts\|chatMode" app/src --include="*.test.ts" --include="*.spec.ts" -l
```

Delete any test files that import from deleted modules.

- [ ] **Step 7: Verify build**

```bash
cd app && npm run check && npx vitest run && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove chat playground, dataset inspector, and Dexie

Delete routes: /chat, /dataset
Delete libraries: lib/chat/, lib/dataset/, components/chat/, components/dataset/
Delete stores: activeChat, chainUsage, lastChatModel, chatShortcuts, chatMode
Strip layout: remove ads, billing, analytics, history drawer, mode toggle
Drop dependency: dexie
TabRail now renders unconditionally (tools-only app)."
```

---

## Task 4: Drop auth + Supabase + closed-product features

**Files:**
- Delete: `app/src/routes/login/`, `app/src/routes/signup/`, `app/src/routes/auth/`
- Delete: `app/src/lib/auth/`
- Delete: `app/src/lib/components/auth/`
- Delete: `app/src/lib/components/billing/`
- Delete: `app/src/lib/billing/`
- Delete: `app/src/lib/analytics/`
- Delete: `app/src/lib/ads/`
- Delete: `app/src/lib/components/settings/SecurityPanel.svelte`
- Modify: `app/src/lib/ai/providers.svelte.ts`
- Modify: `app/src/lib/components/settings/AddProviderDialog.svelte`
- Modify: `app/src/lib/components/settings/ProviderCard.svelte`
- Modify: `app/src/lib/components/settings/ProvidersPanel.svelte`
- Modify: `app/src/routes/settings/+page.svelte`
- Modify: `app/src/lib/config/featureFlags.ts`
- Modify: `app/package.json`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Delete auth/billing/analytics/ads directories**

```bash
cd "C:/Users/m4xx/Downloads/cryptex-tools/.claude/worktrees/wizardly-goldberg-9f5728"
rm -rf app/src/routes/login
rm -rf app/src/routes/signup
rm -rf app/src/routes/auth
rm -rf app/src/lib/auth
rm -rf app/src/lib/components/auth
rm -rf app/src/lib/components/billing
rm -rf app/src/lib/billing
rm -rf app/src/lib/analytics
rm -rf app/src/lib/ads
rm app/src/lib/components/settings/SecurityPanel.svelte
```

- [ ] **Step 2: Simplify providers.svelte.ts — remove vault/auth path**

In `app/src/lib/ai/providers.svelte.ts`, remove these imports:
```ts
import { featureFlags } from '$lib/config/featureFlags';
import { session } from '$lib/auth/session.svelte';
import { listBYOKKeys, storeBYOKKey, storeBYOKKeyWithVaultKey } from '$lib/auth/key-vault';
```

Replace the `useVaultStorage()` function:
```ts
function useVaultStorage(): boolean {
  return browser && featureFlags.authEnabled && session.isSignedIn;
}
```
with:
```ts
function useVaultStorage(): boolean {
  return false;
}
```

Remove the `stripApiKey()` function and `purgeApiKeyFromMirror()` function (dead code when vault is never used).

Remove any vault-related code blocks guarded by `if (!useVaultStorage()) return;` — those early-returns mean the vault code after them is dead. Remove the dead vault code and the guard, keeping the localStorage path.

- [ ] **Step 3: Strip session imports from settings components**

In `app/src/lib/components/settings/AddProviderDialog.svelte`, remove:
```ts
import { session } from '$lib/auth/session.svelte';
```
And remove any code that references `session.` — search for `session.` in the file and remove those conditional blocks.

In `app/src/lib/components/settings/ProviderCard.svelte`, remove:
```ts
import { session } from '$lib/auth/session.svelte';
```
And remove any code that references `session.`.

In `app/src/lib/components/settings/ProvidersPanel.svelte`, remove:
```ts
import { session } from '$lib/auth/session.svelte';
```
And remove any code that references `session.`.

- [ ] **Step 4: Strip auth from settings page**

In `app/src/routes/settings/+page.svelte`:

Remove imports:
```ts
import { session } from '$lib/auth/session.svelte';
import SecurityPanel from '$lib/components/settings/SecurityPanel.svelte';
import { ensureAdSenseState } from '$lib/ads/adsense.svelte';
import { ensureGaState, isGaConfigured } from '$lib/analytics/ga.svelte';
```

In the `sections` array, remove the 'account' entry:
```ts
{ id: 'account', label: 'Account', icon: UserCog, visible: () => featureFlags.authEnabled && session.isSignedIn },
```

Remove the `SecurityPanel` component render from the template.
Remove any AdSense/GA sections from the template.

- [ ] **Step 5: Simplify featureFlags.ts**

Replace `app/src/lib/config/featureFlags.ts` with:

```ts
export const featureFlags = {
  authEnabled: false,
  godmodeLocalEnabled: false
} as const;
```

Both features are stripped from OSS. Keeping the object shape means any code that reads `featureFlags.authEnabled` still compiles (returns false).

- [ ] **Step 6: Drop deps from package.json**

In `app/package.json`, remove:
```json
"@supabase/supabase-js": "^2.103.3",
"pdfjs-dist": "4.10.38",
"mammoth": "1.9.0",
```

Then:
```bash
cd app && npm install
```

- [ ] **Step 7: Trim Dockerfile build args**

In `Dockerfile`, remove these ARG/ENV lines:
```dockerfile
ARG VITE_AUTH_ENABLED=
ARG PUBLIC_SUPABASE_URL=
ARG PUBLIC_SUPABASE_ANON_KEY=
```
And any corresponding `ENV` lines that propagate them.

Keep: `BASE_PATH`, `PUBLIC_GODMODE_LOCAL_ENABLED` (even though it's false, the arg is harmless).

- [ ] **Step 8: Trim docker-compose.yml env vars**

In `docker-compose.yml`, remove environment entries:
```yaml
VITE_AUTH_ENABLED: ${VITE_AUTH_ENABLED:-}
PUBLIC_SUPABASE_URL: ${PUBLIC_SUPABASE_URL:-}
PUBLIC_SUPABASE_ANON_KEY: ${PUBLIC_SUPABASE_ANON_KEY:-}
```

- [ ] **Step 9: Delete orphan test files**

```bash
grep -r "lib/auth\|lib/billing\|lib/analytics\|lib/ads\|supabase\|SecurityPanel" app/src --include="*.test.ts" --include="*.spec.ts" -l
```

Delete any test files that import from deleted modules.

- [ ] **Step 10: Verify build**

```bash
cd app && npm run check && npx vitest run && npm run build
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: remove auth, Supabase, billing, analytics, and ads

Delete routes: /login, /signup, /auth/callback
Delete libraries: lib/auth/, lib/billing/, lib/analytics/, lib/ads/
Delete components: auth/, billing/, SecurityPanel
Strip vault path from providers.svelte.ts (localStorage only)
Simplify featureFlags (auth=false, godmode=false)
Drop deps: @supabase/supabase-js, pdfjs-dist, mammoth
Trim Dockerfile + docker-compose build args."
```

---

## Task 5: Drop `/redteam/aggregation` + prune references

**Files:**
- Delete: `app/src/routes/redteam/aggregation/`
- Modify: `app/src/lib/components/shell/TabRail.svelte`
- Modify: guide markdown files (if they reference aggregation)

- [ ] **Step 1: Delete aggregation route**

```bash
rm -rf app/src/routes/redteam/aggregation
```

- [ ] **Step 2: Remove aggregation from TabRail**

In `app/src/lib/components/shell/TabRail.svelte`, remove this entry from the `tabs` array:
```ts
{ href: '/redteam/aggregation',       label: 'Aggregate',  icon: Activity,      status: 'live' },
```

Also remove the `Activity` icon import if it's no longer used by any other tab.

- [ ] **Step 3: Prune guide references**

```bash
grep -r "aggregation" app/src/lib/guide --include="*.md" -l
```

In any matching guide files, remove references to `/redteam/aggregation`.

- [ ] **Step 4: Verify build**

```bash
cd app && npm run check && npx vitest run && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: drop /redteam/aggregation workbench

Depends on chat-run history tables which don't exist in OSS.
25 tool routes remain (10 technique + 15 redteam workbenches)."
```

---

## Task 6: Polish — README, LICENSE, CLAUDE.md, about page, push to GitHub

**Files:**
- Create: `LICENSE`
- Rewrite: `README.md`
- Rewrite: `CLAUDE.md`
- Modify: `app/src/routes/about/+page.svelte`

- [ ] **Step 1: Create MIT LICENSE**

Write `LICENSE` with standard MIT text, copyright `2026 Cryptex Contributors`.

- [ ] **Step 2: Write OSS README.md**

Write a clean `README.md` with:
- What Cryptex OSS is (open-source technique toolkit for LLM red-teaming)
- Quick start: `cd app && npm install && npm run dev`
- Tool list (25 tools: 10 technique + 15 redteam)
- Docker deploy: `docker compose up --build`
- BYOK setup: paste API key in Settings
- Contributing: add transformer → drop file in `src/transformers/<category>/`, rebuild
- License: MIT

- [ ] **Step 3: Write OSS CLAUDE.md**

Write a stripped `CLAUDE.md` focused on:
- Commands (dev, build, test, check)
- Architecture (transformers, AI gateway, techniques registry, SvelteKit static adapter)
- "When adding things" (new transformer, new tool route)
- No auth/chat/dataset/billing sections

- [ ] **Step 4: Clean about page**

In `app/src/routes/about/+page.svelte`, remove any references to:
- Chat playground features
- Dataset inspector
- Attack chain / chain orchestrator stats
- Sign-in / account features

Keep: transformer counts, mutator counts, classifier counts, provider info, tool list.

- [ ] **Step 5: Final grep verification**

Run these to confirm no dead references remain:
```bash
grep -r "dexie" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "supabase" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "routes/chat" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "lib/auth" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "lib/chat" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "lib/billing" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "lib/analytics" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
grep -r "lib/ads" app/src --include="*.ts" --include="*.svelte" | grep -v node_modules
```

All should return empty. Fix any stragglers.

- [ ] **Step 6: Final build + manual smoke test**

```bash
cd app && npm run check && npx vitest run && npm run build
npm run dev
```

Verify in browser:
1. 25 tool tabs visible in TabRail
2. No Chat/Dataset/Login in navigation
3. Settings → AI Providers panel loads, can paste key
4. PromptCraft works end-to-end with an API key
5. No console errors on any route
6. `/transforms` encodes/decodes correctly
7. `/decode` auto-detects and decodes

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: add MIT LICENSE, OSS README, and CLAUDE.md

Finalize cryptex-oss v1.0.0 — 25 technique tools,
full BYOK AI gateway, zero auth, zero telemetry."
```

- [ ] **Step 8: Create GitHub repo and push**

```bash
gh repo create cryptex-oss --public --description "Open-source LLM red-teaming technique toolkit" --source . --push
git tag v1.0.0
git push origin v1.0.0
```

---

## Verification Summary

After all 6 tasks, the end state must pass:

| Check | Command | Expected |
|---|---|---|
| Type check | `cd app && npm run check` | 0 errors |
| Unit tests | `cd app && npx vitest run` | All pass |
| Build | `cd app && npm run build` | Green |
| No dexie | `grep -r 'dexie' app/src` | Empty |
| No supabase | `grep -r 'supabase' app/src` | Empty |
| No chat routes | `grep -r 'routes/chat' app/src` | Empty |
| No auth lib | `grep -r 'lib/auth' app/src` | Empty |
| No chat lib | `grep -r 'lib/chat' app/src` | Empty |
| Docker | `docker build -t cryptex-oss . && docker run -p 8080:80 cryptex-oss` | Health check passes |
| Tool count | Browser → TabRail | 25 tabs |
| BYOK works | Settings → paste key → PromptCraft | End-to-end |
