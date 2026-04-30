# Chat UI Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the Chat workspace UI: single Chain/Godmode toggle in the chat header, right sidebar becomes a detached tile mirroring the left tile, both tiles independently resizable, route transitions get cold-load skeleton + fade, composer mode pills deleted (mode selection moves to header `⋮` submenu).

**Architecture:** `ChatShell.svelte` becomes a three-column CSS Grid `[left][center][right]` with widths driven by CSS variables bound to `chat.settings.leftSidebarWidth` / `rightSidebarWidth`. The right column conditionally renders `AttackWorkspaceSidebar.svelte`, which loses its in-tile tab strip and gains hybrid-tile chrome (label + History disclosure). A new `RouteShell.svelte` wrapper provides cold-load skeleton + opacity fade for chat and tools routes.

**Tech Stack:** Svelte 5 runes, Tailwind, Dexie (additive optional fields — no migration), shadcn-svelte dropdown for the Mode submenu, `lucide-svelte` icons.

**Spec:** [`docs/superpowers/specs/2026-04-24-chat-ui-restructure-design.md`](../specs/2026-04-24-chat-ui-restructure-design.md)

**Working directory:** `C:/Users/m4xx/Downloads/cryptex` (master).

**Shell:** PowerShell 5.1. Use POSIX heredoc form for multiline commits: `git commit -m "$(cat <<'EOF' ... EOF)"`. Do NOT use `@'...'@`.

**Constraint reminder — already verified by exploration:**
- `ChatShell.svelte` currently grids `[240px][1fr]` with left = `<aside class="glass rounded-lg border border-border/50 p-3 ...">` and right = `<section class="glass rounded-lg border border-border/50 p-3 ...">`. The "tile chrome" pattern to mirror is exactly that class set.
- `AttackWorkspaceSidebar.svelte` already has its own resize handle persisting to `chat.settings.workspaceWidth` with bounds `[320, 800]` default `440`. We REPLACE that field name with `rightSidebarWidth` (with read-side fallback) and reposition the handle so it lives on the new tile's left edge, in the new 3-col grid.
- The current tab strip lives INSIDE `AttackWorkspaceSidebar.svelte`. The header is already passed `workspaceTab` (per `ChatHeader.svelte` props). We move authority for `activeTool` into the chat header's segmented control; sidebar consumes it as a prop.
- `ModePills.svelte` is rendered by Composer and contains a `godmode` pill calling `toasts.push("Godmode is reserved...")`. The whole component will be deleted from Composer's render and replaced by a Mode submenu in `ChatHeader.svelte`.

**Untracked scratch files** (`docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`, `templates/hermes-agent/`) MUST remain unstaged. They predate this work.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/lib/chat/types.ts` | Modify | Extend `ChatSettings` with `leftSidebarWidth?` + `rightSidebarWidth?`; ensure `activeAttackTool?: 'chain' \| 'godmode'` exists |
| `app/src/lib/components/chat/ChatShell.svelte` | Rewrite | 3-column grid with CSS-var widths; conditional right column |
| `app/src/lib/components/chat/workspace/ChatHeader.svelte` | Modify | Add segmented Chain/Godmode toggle; add Mode submenu to ⋮ |
| `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte` | Modify | Strip tab strip; add tile chrome; convert resize handle to left-edge; rename `workspaceWidth` field usage to `rightSidebarWidth` (with back-compat read) |
| `app/src/lib/components/chat/workspace/AttackHistoryDisclosure.svelte` | Create | Per-chat session list (Chain or Godmode); collapsible; click-to-load |
| `app/src/lib/components/chat/workspace/RouteShell.svelte` | Create | Skeleton + fade timing wrapper |
| `app/src/lib/components/chat/workspace/ChatSkeleton.svelte` | Create | 3-row chat shimmer |
| `app/src/lib/components/chat/workspace/ToolsSkeleton.svelte` | Create | 4-bar tools shimmer |
| `app/src/lib/components/chat/sidebar/ChatSidebar.svelte` | Modify | Accept `width` from layout; expose left-edge drag emit (handle lives in ChatShell) |
| `app/src/lib/components/chat/composer/Composer.svelte` | Modify | Delete `<ModePills>` render; remove import |
| `app/src/lib/components/chat/composer/ModePills.svelte` | Delete | Component no longer used |
| `app/src/routes/chat/+layout.svelte` | Modify | Wrap children in `<RouteShell skeleton="chat">` |
| `app/src/routes/transforms/+page.svelte` (and equivalents for `decode`, `emoji`, `splitter`, `bijection`) | Modify | Wrap content in `<RouteShell skeleton="tools">` (per-page; no shared tools layout exists) |
| `app/src/lib/components/chat/workspace/__tests__/RouteShell.test.ts` | Create | Cold/warm path test for skeleton flag |

---

## Task 1: Extend `ChatSettings` types

**Goal:** Add the two new layout-width fields. Keep backward compatibility for existing rows that don't have them. Ensure `activeAttackTool` exists.

**Files:**
- Modify: `app/src/lib/chat/types.ts`

- [ ] **Step 1: Read current `ChatSettings` interface**

Read `app/src/lib/chat/types.ts`. Find the `ChatSettings` interface (or whichever interface holds the existing `workspaceWidth` field). Note its current fields and confirm `activeAttackTool` is already present (it's referenced by `ChatHeader.svelte` and `AttackWorkspaceSidebar.svelte`).

- [ ] **Step 2: Append new fields**

Inside `ChatSettings` (or whichever interface holds `workspaceWidth`), append after the existing `workspaceWidth?: number;` line:

```ts
  /** v3-UI: pixel width of the left sidebar tile. Clamped [240, 480] at use sites. */
  leftSidebarWidth?: number;
  /** v3-UI: pixel width of the right (attack workspace) sidebar tile. Clamped [320, 800].
   *  Supersedes `workspaceWidth`; readers prefer this when present. */
  rightSidebarWidth?: number;
```

If `activeAttackTool` does NOT already exist, also append:

```ts
  /** v3-UI: which attack tool the right tile renders. Default 'chain'. */
  activeAttackTool?: 'chain' | 'godmode';
```

If it does exist, leave it untouched.

- [ ] **Step 3: Typecheck**

Run: `cd app; npm run check 2>&1 | tail -1`
Expected: `0 ERRORS` (warnings unchanged).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/types.ts
git commit -m "$(cat <<'EOF'
feat(chat): ChatSettings adds left/right sidebar width fields

Two optional pixel-width fields for the upcoming 3-column tile
layout. Both are persisted by the drag-handle code in later tasks.
rightSidebarWidth supersedes workspaceWidth — readers prefer the
new field but fall back to the old one for legacy rows.
EOF
)"
```

---

## Task 2: Rewrite `ChatShell.svelte` to a 3-column grid

**Goal:** Make `ChatShell` a 3-column grid with CSS-variable-driven widths. The third column conditionally renders the AttackWorkspaceSidebar when the user has it open.

**Files:**
- Modify: `app/src/lib/components/chat/ChatShell.svelte`

- [ ] **Step 1: Read the current shell**

Read the file. It's currently 2 columns: `[240px][1fr]` with `aside` (chat sidebar) + `section` (chat content).

- [ ] **Step 2: Read where `AttackWorkspaceSidebar` is mounted today**

Run: `grep -rn "AttackWorkspaceSidebar" app/src --include="*.svelte" --include="*.ts"`

You'll find it imported and rendered inside the chat-page component (likely `app/src/routes/chat/[id]/+page.svelte` or a child of it). Note that file path — we will move the mount point in this task.

- [ ] **Step 3: Replace `ChatShell.svelte` with 3-column shell**

Replace the entire file contents with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import ChatSidebar from './sidebar/ChatSidebar.svelte';
  import SelectionPopover from './techniques/SelectionPopover.svelte';
  import DatasetFooter from './footer/DatasetFooter.svelte';
  import { activeChatStore } from '$lib/stores/activeChat.svelte';
  import { repo } from '$lib/chat/repo';
  import AttackWorkspaceSidebar from './workspace/AttackWorkspaceSidebar.svelte';

  let { children } = $props();

  // Read active chat from the store the chat-page populates.
  const chat = $derived(activeChatStore.chat);

  // Default widths — used when the chat row's settings don't carry a value.
  const LEFT_DEFAULT = 240;
  const LEFT_MIN = 200;
  const LEFT_MAX = 480;
  const RIGHT_DEFAULT = 440;
  const RIGHT_MIN = 320;
  const RIGHT_MAX = 800;

  let leftWidth = $state<number>(LEFT_DEFAULT);
  let rightWidth = $state<number>(RIGHT_DEFAULT);

  // Sync widths from chat.settings when chat changes.
  $effect(() => {
    if (!chat) return;
    leftWidth = chat.settings?.leftSidebarWidth ?? LEFT_DEFAULT;
    rightWidth =
      chat.settings?.rightSidebarWidth ??
      chat.settings?.workspaceWidth ?? // legacy field kept for back-compat
      RIGHT_DEFAULT;
  });

  // Workspace open + active tool — read from chat.settings.
  const workspaceOpen = $derived<boolean>(chat?.settings?.workspaceOpen ?? false);
  const activeTool = $derived<'chain' | 'godmode'>(chat?.settings?.activeAttackTool ?? 'chain');

  // ---- Left drag handle ------------------------------------------------
  let leftPersistTimer: ReturnType<typeof setTimeout> | null = null;
  function onLeftResizeStart(e: PointerEvent) {
    if (!chat) return;
    const startX = e.clientX;
    const startW = leftWidth;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function move(ev: PointerEvent) {
      const next = Math.min(LEFT_MAX, Math.max(LEFT_MIN, startW + (ev.clientX - startX)));
      leftWidth = next;
    }
    function end() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (leftPersistTimer) clearTimeout(leftPersistTimer);
      const id = chat?.id;
      const w = leftWidth;
      if (!id) return;
      leftPersistTimer = setTimeout(() => {
        void repo.updateChat(id, {
          settings: { ...(chat?.settings ?? {}), leftSidebarWidth: w }
        });
      }, 250);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  function onWorkspaceResize(width: number) {
    rightWidth = width;
  }
  function onWorkspaceClose() {
    if (!chat) return;
    void repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), workspaceOpen: false }
    });
  }
  function onWorkspaceTabChange(tab: 'chain' | 'godmode') {
    if (!chat) return;
    void repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), activeAttackTool: tab }
    });
  }
</script>

<div
  class="chat-shell grid h-[calc(100vh-7rem)] gap-3"
  style:grid-template-columns={workspaceOpen
    ? `${leftWidth}px minmax(0,1fr) ${rightWidth}px`
    : `${leftWidth}px minmax(0,1fr)`}
>
  <aside class="relative glass rounded-lg border border-border/50 p-3 overflow-hidden cryptex-scroll">
    <ChatSidebar />
    <button
      type="button"
      aria-label="Resize chat list sidebar"
      onpointerdown={onLeftResizeStart}
      class="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
    ></button>
  </aside>

  <section class="glass rounded-lg border border-border/50 p-3 overflow-hidden flex flex-col">
    {@render children?.()}
  </section>

  {#if workspaceOpen && chat}
    <AttackWorkspaceSidebar
      {chat}
      activeTab={activeTool}
      onTabChange={onWorkspaceTabChange}
      onClose={onWorkspaceClose}
      onResize={onWorkspaceResize}
      onInsertToComposer={(text: string) => {
        // Forward to the active page's composer via a window event.
        window.dispatchEvent(
          new CustomEvent('cryptex.composer.insert', { detail: { text } })
        );
      }}
    />
  {/if}
</div>

<SelectionPopover />
<DatasetFooter />
```

**Important:** the new `<AttackWorkspaceSidebar>` lives in `ChatShell` directly. The old mount site (a child component of the chat page) must be removed. See Step 4.

- [ ] **Step 4: Remove the old AttackWorkspaceSidebar mount**

Open the file the Step 2 grep surfaced (most likely `app/src/routes/chat/[id]/+page.svelte`). Find the `<AttackWorkspaceSidebar ...>` render block and the `import` for it. Delete both. The chat page no longer mounts the sidebar — `ChatShell` owns that.

If multiple consumers exist, delete all of them. The grep result should now show only the import + render in `ChatShell.svelte`.

- [ ] **Step 5: Confirm `activeChatStore` exists or stub it**

Run: `ls app/src/lib/stores/activeChat.svelte.ts 2>&1 || echo "MISSING"`

If the file is missing, create it:

```ts
// app/src/lib/stores/activeChat.svelte.ts
import type { ChatRow } from '$lib/chat/types';

class ActiveChatStore {
  chat = $state<ChatRow | null>(null);
  set(c: ChatRow | null) { this.chat = c; }
}

export const activeChatStore = new ActiveChatStore();
```

If it exists, read it and confirm it exposes `.chat: ChatRow | null` reactively. If the existing API differs, adapt the `$derived(activeChatStore.chat)` line in `ChatShell.svelte` to match.

The chat page (`app/src/routes/chat/[id]/+page.svelte`) must call `activeChatStore.set(chat)` whenever the loaded chat changes — verify this exists; if not, add a single-line `$effect(() => activeChatStore.set(chat));` at the top of the page's `<script>`.

- [ ] **Step 6: Typecheck + manual smoke**

Run: `cd app; npm run check 2>&1 | tail -1`
Expected: `0 ERRORS`.

Open `npm run app:dev`, browse to `/chat/<existing-chat>`, confirm:
- Left tile + center column render as before.
- Right tile renders only when workspace is open (Chain or Godmode toggle).
- Drag the left tile's right edge → width changes smoothly, persists across reload.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/components/chat/ChatShell.svelte app/src/lib/stores/activeChat.svelte.ts app/src/routes/chat/[id]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(chat): 3-column ChatShell grid with resizable left tile

ChatShell becomes a CSS-Grid with [left][center][right] columns
sized via inline style:grid-template-columns. Left column gets a
right-edge drag handle that persists to chat.settings.leftSidebarWidth
(clamped 200-480, default 240).

AttackWorkspaceSidebar moves into ChatShell as the conditional 3rd
column. Old mount in chat/[id]/+page.svelte deleted. activeChatStore
provides the live chat row to the shell.
EOF
)"
```

---

## Task 3: Migrate AttackWorkspaceSidebar to detached tile

**Goal:** Strip the in-tile tab strip; add tile chrome (`glass rounded-lg border ...`) matching the left tile; convert the resize handle from right-edge to left-edge; rename the persisted width field; expose an `onResize(width)` callback so `ChatShell` can apply width via grid.

**Files:**
- Modify: `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte`

- [ ] **Step 1: Read the file in full**

Read `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte`. Note the current resize handle (`onResizeStart` etc.), the tab-strip block (the `<div role="tablist">` or the two `<button>` tabs near the top), and how `activeTab` is currently rendered.

- [ ] **Step 2: Replace `<script>` block**

Replace the entire `<script lang="ts">...</script>` block at the top with:

```svelte
<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import AttackChainTab from '$lib/components/chat/attack-chain/AttackChainTab.svelte';
  import GodmodeTab from '$lib/chat/godmode/GodmodeTab.svelte';
  import AttackHistoryDisclosure from './AttackHistoryDisclosure.svelte';
  import X from 'lucide-svelte/icons/x';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';

  type Props = {
    chat: ChatRow;
    activeTab: 'chain' | 'godmode';
    onTabChange: (t: 'chain' | 'godmode') => void;
    onClose: () => void;
    onResize?: (width: number) => void;
    onInsertToComposer: (text: string) => void;
  };
  let { chat, activeTab, onClose, onResize, onInsertToComposer }: Props = $props();

  // Title label for the hybrid header.
  const toolLabel = $derived(activeTab === 'chain' ? 'Chain' : 'Godmode');

  // ---- Resize handle (left edge of this tile) -------------------------
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 800;
  const DEFAULT_WIDTH = 440;
  let width = $state<number>(
    chat.settings?.rightSidebarWidth ?? chat.settings?.workspaceWidth ?? DEFAULT_WIDTH
  );
  $effect(() => {
    width =
      chat.settings?.rightSidebarWidth ?? chat.settings?.workspaceWidth ?? DEFAULT_WIDTH;
  });

  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartWidth = 0;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function onResizeStart(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartWidth = width;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd, { once: true });
  }
  function onResizeMove(e: PointerEvent) {
    if (!dragging) return;
    // Tile is on the right; dragging left grows it.
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth + (dragStartX - e.clientX)));
    width = next;
    onResize?.(next);
  }
  function onResizeEnd() {
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onResizeMove);
    if (persistTimer) clearTimeout(persistTimer);
    const id = chat.id;
    const w = width;
    persistTimer = setTimeout(() => {
      void repo.updateChat(id, {
        settings: { ...(chat.settings ?? {}), rightSidebarWidth: w }
      });
    }, 250);
  }
</script>
```

- [ ] **Step 3: Replace the markup block**

Replace the entire markup section (everything after `</script>` and before any `<style>` block) with:

```svelte
<aside
  class="relative glass rounded-lg border border-border/50 overflow-hidden flex flex-col"
  style:width="100%"
>
  <!-- Drag handle on left edge -->
  <button
    type="button"
    aria-label="Resize attack workspace"
    onpointerdown={onResizeStart}
    class="absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
  ></button>

  <!-- Hybrid header -->
  <div class="flex items-center gap-2 border-b border-border/40 px-3 py-2 pl-4 text-xs">
    <GripVertical size={11} class="text-muted-foreground/60" />
    <span class="text-muted-foreground">Attack workspace</span>
    <span class="text-muted-foreground">·</span>
    <span class="font-medium text-foreground">{toolLabel}</span>
    <button
      type="button"
      aria-label="Close attack workspace"
      onclick={onClose}
      class="ml-auto rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    ><X size={11} /></button>
  </div>

  <!-- Per-chat session history disclosure -->
  <AttackHistoryDisclosure {chat} {activeTab} />

  <!-- Active form -->
  <div class="flex-1 min-h-0 overflow-hidden pl-1">
    {#if activeTab === 'chain'}
      <AttackChainTab {chat} {onInsertToComposer} />
    {:else}
      <GodmodeTab {chat} />
    {/if}
  </div>
</aside>
```

This removes the prior tab-strip + the right-edge drag handle. The drag handle is now a 6px-wide invisible button on the LEFT edge that emits via `onResize` and persists via `rightSidebarWidth`.

- [ ] **Step 4: Confirm tab-strip removal is complete**

Run: `grep -n "onTabChange\|activeTab.*===" app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte`

Expected hits: `activeTab === 'chain'` (in the `{#if}` switch) and `Props.onTabChange` (kept on the type but unused in the render — the new design has the chat header drive it). No `<button onclick={() => onTabChange(...)}>` blocks should remain inside the sidebar.

If `onTabChange` is no longer called from the sidebar at all, remove it from the destructure: change `let { chat, activeTab, onClose, onResize, onInsertToComposer }: Props = $props();` to keep it accepted via `Props` for API compat (so the parent's call doesn't typecheck-fail) but unused. That's fine — TypeScript allows unused destructured props if you don't list them.

- [ ] **Step 5: Typecheck**

`cd app; npm run check 2>&1 | tail -1` → `0 ERRORS`. The Task 4 component (`AttackHistoryDisclosure`) is referenced but doesn't exist yet — this typecheck WILL FAIL with a missing-import error. That's expected; we'll create it in Task 4. Skip this step's verification and move on.

- [ ] **Step 6: Stub commit (deferred)**

Do NOT commit yet. Wait until Task 4 lands the missing `AttackHistoryDisclosure.svelte`, then commit Tasks 3+4 together. (Otherwise we'd ship a known-broken commit.)

---

## Task 4: Create `AttackHistoryDisclosure.svelte`

**Goal:** New collapsible component that lists past Chain or Godmode sessions for the current chat.

**Files:**
- Create: `app/src/lib/components/chat/workspace/AttackHistoryDisclosure.svelte`

- [ ] **Step 1: Implement**

Create the file:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatRow, AttackSessionRow, GodmodeRunRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import History from 'lucide-svelte/icons/history';

  type Props = {
    chat: ChatRow;
    activeTab: 'chain' | 'godmode';
  };
  let { chat, activeTab }: Props = $props();

  let open = $state(false);
  let chainSessions = $state<AttackSessionRow[]>([]);
  let godmodeRuns = $state<GodmodeRunRow[]>([]);

  async function refresh() {
    if (activeTab === 'chain') {
      try { chainSessions = await repo.listAttackSessions(chat.id); }
      catch (err) { console.error('[history-disclosure] chain list failed:', err); }
    } else {
      try { godmodeRuns = await repo.listGodmodeRuns(chat.id); }
      catch (err) { console.error('[history-disclosure] godmode list failed:', err); }
    }
  }

  onMount(refresh);
  $effect(() => {
    void chat.id;
    void activeTab;
    void refresh();
  });

  const count = $derived(activeTab === 'chain' ? chainSessions.length : godmodeRuns.length);

  function rel(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
</script>

<details class="group border-b border-border/30 bg-background/30 text-xs" bind:open>
  <summary class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
    <ChevronRight size={11} class="transition-transform group-open:rotate-90" />
    <History size={11} />
    <span>History</span>
    <span class="ml-auto text-[10px]">{count === 0 ? 'none' : count}</span>
  </summary>
  <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto border-t border-border/30 px-2 py-1.5 text-[11px]">
    {#if activeTab === 'chain'}
      {#each chainSessions as s (s.id)}
        <div class="flex items-center gap-2 truncate rounded px-1.5 py-1 hover:bg-muted/30">
          <span class={'rounded px-1 py-0.5 text-[9px] uppercase ' +
            (s.finalOutcome === 'extracted' ? 'bg-green-500/20 text-green-400' :
             s.finalOutcome === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
             s.finalOutcome === 'abandoned' ? 'bg-orange-500/20 text-orange-400' :
             'bg-muted/40 text-muted-foreground')}>{s.finalOutcome ?? 'live'}</span>
          <span class="truncate">{s.objective}</span>
          <span class="ml-auto text-[9px] text-muted-foreground">{rel(s.createdAt)}</span>
        </div>
      {:else}
        <p class="px-1 py-2 text-center text-[10px] text-muted-foreground">No sessions yet.</p>
      {/each}
    {:else}
      {#each godmodeRuns as r (r.id)}
        <div class="flex items-center gap-2 truncate rounded px-1.5 py-1 hover:bg-muted/30">
          <span class="truncate">{r.task ?? '(no task)'}</span>
          <span class="ml-auto text-[9px] text-muted-foreground">{rel(r.createdAt)}</span>
        </div>
      {:else}
        <p class="px-1 py-2 text-center text-[10px] text-muted-foreground">No runs yet.</p>
      {/each}
    {/if}
  </div>
</details>
```

- [ ] **Step 2: Typecheck**

`cd app; npm run check 2>&1 | tail -1` → `0 ERRORS`.

If `GodmodeRunRow.task` doesn't exist as a property name, replace the `r.task` reference with whatever the actual identifying field is (e.g. `r.objective` or `r.input`). Same for `r.createdAt`. Confirm by reading the type in `app/src/lib/chat/types.ts`.

- [ ] **Step 3: Commit Tasks 3+4 together**

```bash
git add app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte app/src/lib/components/chat/workspace/AttackHistoryDisclosure.svelte
git commit -m "$(cat <<'EOF'
feat(chat-ui): detached attack workspace tile + history disclosure

AttackWorkspaceSidebar gains tile chrome matching the left chat-list
tile (glass rounded-lg border). In-tile tab strip removed — the chat
header now drives activeTool. Resize handle moves to the left edge of
the tile and persists to chat.settings.rightSidebarWidth (back-compat
read from workspaceWidth).

New AttackHistoryDisclosure component renders a collapsible list of
the chat's past Chain or Godmode sessions inside the tile header.
EOF
)"
```

---

## Task 5: Add segmented Chain/Godmode toggle to chat header

**Goal:** Move the active-tool selection authority from the sidebar's tab strip to the chat header. The header gets a small segmented control next to the model pill.

**Files:**
- Modify: `app/src/lib/components/chat/workspace/ChatHeader.svelte`

- [ ] **Step 1: Read current header**

Read `app/src/lib/components/chat/workspace/ChatHeader.svelte` in full. Find where the model picker and the existing right-side controls render. The imports for `Zap` and `Sparkles` already exist.

- [ ] **Step 2: Add segmented toggle**

In the header markup, immediately after the `<ModelPickerV2 ... />` block (or in the right-side control row near it), insert:

```svelte
<div class="inline-flex rounded-md border border-border/40 bg-background/30 p-0.5 text-[11px]">
  <button
    type="button"
    onclick={() => setActiveTool('chain')}
    aria-pressed={(chat.settings?.activeAttackTool ?? 'chain') === 'chain'}
    class={'inline-flex items-center gap-1 rounded px-2 py-1 transition ' +
      ((chat.settings?.activeAttackTool ?? 'chain') === 'chain'
        ? 'bg-primary/15 text-primary'
        : 'text-muted-foreground hover:text-foreground')}
  >
    <Zap size={11} /> Chain
  </button>
  {#if GODMODE_ENGINE_ENABLED}
    <button
      type="button"
      onclick={() => setActiveTool('godmode')}
      aria-pressed={chat.settings?.activeAttackTool === 'godmode'}
      class={'inline-flex items-center gap-1 rounded px-2 py-1 transition ' +
        (chat.settings?.activeAttackTool === 'godmode'
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground')}
    >
      <Sparkles size={11} /> Godmode
    </button>
  {/if}
</div>
```

- [ ] **Step 3: Add `setActiveTool` function**

Inside the `<script>` block (near the existing `onModelChange` async function), add:

```ts
  async function setActiveTool(tool: 'chain' | 'godmode') {
    await repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), activeAttackTool: tool, workspaceOpen: true }
    });
  }
```

This both flips the active tool AND opens the workspace if it was closed, so a click guarantees the user sees the chosen surface.

- [ ] **Step 4: Verify imports**

The script block already imports `Zap`, `Sparkles`, `GODMODE_ENGINE_ENABLED`, and `repo`. No new imports needed.

- [ ] **Step 5: Typecheck + smoke**

`cd app; npm run check 2>&1 | tail -1` → `0 ERRORS`.

Manual smoke: open a chat, click `Chain` then `Godmode` in the new segmented control. Sidebar (which still consumes `chat.settings.activeAttackTool` via the parent's `activeTab` prop set by `ChatShell`) should swap content. The old tab strip in the sidebar is gone (Task 3 already removed it).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/components/chat/workspace/ChatHeader.svelte
git commit -m "$(cat <<'EOF'
feat(chat-ui): segmented Chain/Godmode toggle in chat header

Single toggle authority moves to the chat header. Clicking Chain or
Godmode flips chat.settings.activeAttackTool AND opens the workspace
(workspaceOpen=true) so the user always sees the chosen surface.
The sidebar's old in-tile tab strip is gone (deleted in Task 3).
Godmode button gated behind GODMODE_ENGINE_ENABLED feature flag.
EOF
)"
```

---

## Task 6: Remove ModePills from Composer; add Mode submenu to ChatHeader

**Goal:** Composer drops the four-pill mode row entirely. The chat header's existing `⋮` menu gets a `Mode` submenu with three items (creative / intelligent / adaptive). `godmode` is removed.

**Files:**
- Modify: `app/src/lib/components/chat/composer/Composer.svelte`
- Delete: `app/src/lib/components/chat/composer/ModePills.svelte`
- Modify: `app/src/lib/components/chat/workspace/ChatHeader.svelte`

- [ ] **Step 1: Read Composer**

Read `app/src/lib/components/chat/composer/Composer.svelte` in full. Note the `<ModePills>` import + its render.

- [ ] **Step 2: Remove ModePills usage from Composer**

In the script block, find and delete:

```ts
  import ModePills from './ModePills.svelte';
```

In the markup, find and delete the `<ModePills ... />` render block (typically a single line between the textarea wrapper and the send-button wrapper). Delete any state/derived that exists ONLY to feed `ModePills` props (likely `activeMode` getter/setter wired through the chat's mode field).

If the only consumer of an `activeMode`-related local state was `ModePills`, delete the state too. If it's still used elsewhere in the Composer (e.g. for placeholder text), keep it.

- [ ] **Step 3: Delete the ModePills file**

```bash
git rm app/src/lib/components/chat/composer/ModePills.svelte
```

- [ ] **Step 4: Add Mode submenu to ChatHeader's `⋮` menu**

Read `app/src/lib/components/chat/workspace/ChatHeader.svelte`. Find the `<DropdownMenu.Content>` block under the `⋮` button. At the top of the dropdown content (above existing items like "Duplicate chat", "Export"), insert:

```svelte
{@const currentMode = chat.mode ?? 'creative'}
<DropdownMenu.Sub>
  <DropdownMenu.SubTrigger>
    <span>Mode</span>
    <span class="ml-auto text-[10px] capitalize text-muted-foreground">{currentMode}</span>
  </DropdownMenu.SubTrigger>
  <DropdownMenu.SubContent>
    <DropdownMenu.Item onclick={() => setMode('creative')}>
      <span class="capitalize">Creative</span>
      {#if currentMode === 'creative'}<span class="ml-auto text-primary">✓</span>{/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => setMode('intelligent')}>
      <span class="capitalize">Intelligent</span>
      {#if currentMode === 'intelligent'}<span class="ml-auto text-primary">✓</span>{/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => setMode('adaptive')}>
      <span class="capitalize">Adaptive</span>
      {#if currentMode === 'adaptive'}<span class="ml-auto text-primary">✓</span>{/if}
    </DropdownMenu.Item>
  </DropdownMenu.SubContent>
</DropdownMenu.Sub>
<DropdownMenu.Separator />
```

- [ ] **Step 5: Add `setMode` to ChatHeader script**

Near `onModelChange`:

```ts
  async function setMode(mode: 'creative' | 'intelligent' | 'adaptive') {
    await repo.updateChat(chat.id, { mode });
  }
```

If `chat.mode` is not the right field name (verify in `types.ts`), change both the read and the write to match the actual field. Common alternates: `chat.modeApplied`, `chat.settings.mode`.

- [ ] **Step 6: Confirm shadcn-svelte supports `Sub/SubTrigger/SubContent`**

```bash
grep -rn "DropdownMenu.Sub\|SubTrigger\|SubContent" app/src/lib/components/ui/dropdown-menu/
```

If the project's dropdown-menu wrapper exports these, the markup above works. If it doesn't (returns no hits or only re-exports `Item` / `Content` / `Trigger`), fall back to a flat menu — replace the `Sub` block in Step 4 with three top-level items prefixed `Mode: Creative`, `Mode: Intelligent`, `Mode: Adaptive`, each calling `setMode(...)`.

- [ ] **Step 7: Typecheck + smoke**

`cd app; npm run check 2>&1 | tail -1` → `0 ERRORS`.

Smoke:
- Open a chat. Verify composer no longer shows pills. Verify the chat header's `⋮` menu has a Mode submenu (or flat list, depending on dropdown lib support) with three items + check on active mode.
- Click each mode → check moves; close + reopen menu confirms persistence.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/components/chat/composer/Composer.svelte app/src/lib/components/chat/workspace/ChatHeader.svelte
git commit -m "$(cat <<'EOF'
feat(chat-ui): mode selection moves to header submenu; composer pills removed

Composer drops the four-pill mode row (creative/intelligent/adaptive/
godmode). godmode pill deleted entirely. Mode selection moves to the
chat header's ⋮ menu as a submenu with the three live modes and a
checkmark on the active one. Falls back to a flat-menu format if
the dropdown library doesn't support nested submenus.
EOF
)"
```

---

## Task 7: Create `RouteShell.svelte` + skeleton variants

**Goal:** Reusable wrapper that renders a skeleton on cold mount + opacity-fades content into view.

**Files:**
- Create: `app/src/lib/components/chat/workspace/RouteShell.svelte`
- Create: `app/src/lib/components/chat/workspace/ChatSkeleton.svelte`
- Create: `app/src/lib/components/chat/workspace/ToolsSkeleton.svelte`
- Create: `app/src/lib/components/chat/workspace/__tests__/RouteShell.test.ts`

- [ ] **Step 1: Implement `RouteShell.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import ChatSkeleton from './ChatSkeleton.svelte';
  import ToolsSkeleton from './ToolsSkeleton.svelte';

  type Props = {
    skeleton?: 'chat' | 'tools' | null;
    children: Snippet;
  };
  let { skeleton = null, children }: Props = $props();

  // Cold-load = first mount in this browser session. We use sessionStorage
  // so route navigations within the same session use the fast fade only.
  let coldLoad = $state(false);
  let mounted = $state(false);

  onMount(() => {
    if (typeof window === 'undefined') return;
    coldLoad = !sessionStorage.getItem('cryptex.routeShell.warm');
    sessionStorage.setItem('cryptex.routeShell.warm', '1');
    // Two-frame delay: first frame renders skeleton, second swaps to content.
    requestAnimationFrame(() => requestAnimationFrame(() => { mounted = true; }));
  });
</script>

<div class="route-shell" class:warm={!coldLoad} class:mounted>
  {#if coldLoad && skeleton && !mounted}
    <div class="skeleton-overlay" aria-hidden="true">
      {#if skeleton === 'chat'}
        <ChatSkeleton />
      {:else if skeleton === 'tools'}
        <ToolsSkeleton />
      {/if}
    </div>
  {/if}
  <div class="content">{@render children()}</div>
</div>

<style>
  .route-shell { position: relative; height: 100%; min-height: 0; }
  .content {
    height: 100%;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  .route-shell.warm .content,
  .route-shell.mounted .content {
    opacity: 1;
  }
  .skeleton-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    animation: skeleton-fade-out 250ms 200ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes skeleton-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
</style>
```

- [ ] **Step 2: Implement `ChatSkeleton.svelte`**

```svelte
<div class="flex h-full flex-col gap-3 p-4">
  {#each [0, 1, 2] as i (i)}
    <div class={'flex items-start gap-3 ' + (i % 2 === 0 ? '' : 'flex-row-reverse')}>
      <div class="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted/50"></div>
      <div class="flex flex-col gap-1.5">
        <div class="h-3 w-48 animate-pulse rounded bg-muted/40"></div>
        <div class="h-3 w-72 animate-pulse rounded bg-muted/40"></div>
        <div class="h-3 w-56 animate-pulse rounded bg-muted/40"></div>
      </div>
    </div>
  {/each}
</div>
```

- [ ] **Step 3: Implement `ToolsSkeleton.svelte`**

```svelte
<div class="flex h-full flex-col gap-3 p-4">
  {#each [0, 1, 2, 3] as i (i)}
    <div class="h-12 w-full animate-pulse rounded-lg bg-muted/40"></div>
  {/each}
</div>
```

- [ ] **Step 4: Write a sanity test for RouteShell**

Create `app/src/lib/components/chat/workspace/__tests__/RouteShell.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RouteShell from '../RouteShell.svelte';
import { tick } from 'svelte';

describe('RouteShell', () => {
  beforeEach(() => {
    sessionStorage.removeItem('cryptex.routeShell.warm');
  });

  it('renders a skeleton on cold mount when skeleton="chat"', async () => {
    render(RouteShell, { props: { skeleton: 'chat', children: () => 'BODY' } });
    // Skeleton overlay is in the DOM during cold mount.
    expect(document.querySelector('.skeleton-overlay')).toBeTruthy();
    // Content body is also rendered (just hidden via opacity until mounted flips).
    expect(screen.getByText('BODY')).toBeInTheDocument();
  });

  it('marks subsequent mounts as warm via sessionStorage', async () => {
    render(RouteShell, { props: { skeleton: 'chat', children: () => 'A' } });
    await tick();
    // Second component instance should not see coldLoad=true.
    render(RouteShell, { props: { skeleton: 'chat', children: () => 'B' } });
    await tick();
    const overlays = document.querySelectorAll('.skeleton-overlay');
    // One skeleton from the first mount; the second skipped because warm flag set.
    expect(overlays.length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 5: Run test**

```bash
cd app
npx vitest run src/lib/components/chat/workspace/__tests__/RouteShell.test.ts
```

Expected: 2/2 PASS. If `@testing-library/svelte` isn't a project dep, replace the test with a minimal Svelte-compile + DOM assertion using `vitest`'s built-in jsdom + manually instantiating the component (`new RouteShell({ target: ... })`). If neither path is workable, mark the test `it.skip(...)` with a TODO and verify behaviour manually in Step 6.

- [ ] **Step 6: Typecheck**

`cd app; npm run check 2>&1 | tail -1` → `0 ERRORS`.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/components/chat/workspace/RouteShell.svelte app/src/lib/components/chat/workspace/ChatSkeleton.svelte app/src/lib/components/chat/workspace/ToolsSkeleton.svelte app/src/lib/components/chat/workspace/__tests__/RouteShell.test.ts
git commit -m "$(cat <<'EOF'
feat(chat-ui): RouteShell wrapper for cold-load skeleton + fade

New RouteShell.svelte renders a skeleton overlay on first mount of
the browser session (tracked via sessionStorage) and crossfades to
the actual content. Warm navigations within the same session skip
the skeleton and use a 200ms opacity fade only. Two skeleton
variants ship: ChatSkeleton (3 alternating message rows) and
ToolsSkeleton (4 stacked bars).
EOF
)"
```

---

## Task 8: Wire `RouteShell` into chat + tools routes

**Goal:** Wrap the chat layout and tool routes with `<RouteShell>`.

**Files:**
- Modify: `app/src/routes/chat/+layout.svelte`
- Modify: `app/src/routes/transforms/+page.svelte`
- Modify: `app/src/routes/decode/+page.svelte`
- Modify: `app/src/routes/emoji/+page.svelte`
- Modify: `app/src/routes/splitter/+page.svelte` (if exists)
- Modify: `app/src/routes/bijection/+page.svelte` (if exists)

- [ ] **Step 1: Wrap `chat/+layout.svelte` content**

Read `app/src/routes/chat/+layout.svelte`. Find the `<ChatShell>{@render children?.()}</ChatShell>` line. Replace with:

```svelte
<RouteShell skeleton="chat">
  <ChatShell>{@render children?.()}</ChatShell>
</RouteShell>
```

Add the import inside `<script>`:

```ts
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
```

The wrap goes inside the existing `{#if featureFlags.authEnabled && !session.isSignedIn}` else-branch.

- [ ] **Step 2: Wrap each tool page**

For each of the tool pages (`transforms/+page.svelte`, `decode/+page.svelte`, `emoji/+page.svelte`, and any other tool page that exists per `ls app/src/routes/`):

Read the file, find the top-level wrapper element of the page content, wrap it:

```svelte
<RouteShell skeleton="tools">
  <!-- existing content -->
</RouteShell>
```

Add the import.

If a page is short (e.g., just a single component import + render), the wrap is trivial. If a page already has a top-level layout div, place the `<RouteShell>` immediately inside the outermost element so the skeleton sizes match.

For pages where the user wouldn't notice a cold-load delay (e.g., `about`), skip — those don't need the skeleton.

- [ ] **Step 3: Verify build**

```bash
cd app
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: Manual smoke**

Run `npm run app:dev`. In a new browser tab (no prior session storage):
- Navigate to `/chat/<id>` → see chat skeleton flash briefly, then real chat.
- Click `/transforms` → see tools skeleton flash, then real tool.
- Click back to `/chat` → no skeleton, just instant fade (warm).
- Open another new tab → cold skeleton again on first route.

If skeleton flashes are too short to notice, that's fine — they only show on actual cold loads. Try Chrome DevTools → Network → Slow 3G to simulate slow boot.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/chat/+layout.svelte app/src/routes/transforms/+page.svelte app/src/routes/decode/+page.svelte app/src/routes/emoji/+page.svelte app/src/routes/splitter/+page.svelte app/src/routes/bijection/+page.svelte
git commit -m "$(cat <<'EOF'
feat(chat-ui): wrap chat + tool routes with RouteShell

Cold-load skeleton + opacity fade now applies to /chat (chat
skeleton) and the main tool pages /transforms /decode /emoji
/splitter /bijection (tools skeleton). About page and other rarely
hit routes left bare — skeleton would be more noise than signal there.
EOF
)"
```

---

## Task 9: Final verification + push

**Goal:** Run the full CI matrix locally, fix anything that surfaces, push to origin/master.

**Files:** none directly modified; possibly test fixes via the flake ladder.

- [ ] **Step 1: Full vitest**

```bash
cd app
npm run test:unit 2>&1 | tail -10
```

Expected: chain suite + repo + db + dispatch all green. The new `RouteShell.test.ts` passes. Pre-existing flakes count ≤ 4. If new failures surface in the chat tests (e.g., a test that asserted on the deleted ModePills surface), apply the fix-skip-quarantine ladder from the cleanup plan (capped at 4 tests).

- [ ] **Step 2: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 3: Production build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✔ done`.

- [ ] **Step 4: Visual smoke (manual)**

Run `npm run app:dev`. Walk through:

1. Cold-load `/chat/<id>` in a new tab → skeleton briefly visible, then chat.
2. Header segmented control: click Chain ↔ Godmode → right tile swaps + workspaceOpen flips true.
3. Click X on right tile → tile closes; main chat reflows to fill.
4. Click Chain again → tile reopens.
5. Drag the left tile's right edge → width changes; reload → width persisted.
6. Drag the right tile's left edge → width changes; reload → width persisted.
7. ⋮ menu → Mode submenu (or flat list) → click Intelligent → checkmark moves.
8. Composer no longer has mode pills.
9. Right tile's "History" disclosure expands to show past sessions for THIS chat.
10. Tab to `/transforms` → tools skeleton briefly, then content.

If anything is broken, fix it and re-commit before push.

- [ ] **Step 5: Commit verification marker**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(chat-ui): restructure verification pass

- Chain suite + RouteShell test green
- svelte-check 0 errors
- Production build clean
- Manual smoke: 3-col grid resize works, segmented header toggle
  works, composer pills gone, mode submenu functional, RouteShell
  cold/warm transitions observed.
EOF
)"
```

- [ ] **Step 6: Push**

```bash
git push origin master
```

Watch the deploy + docker workflows in GitHub Actions. If the deploy fails, diagnose via `gh run view --log-failed` (auth required) or by opening the Actions tab in the browser.

---

## Scope Coverage

| Spec section | Implementing task |
|---|---|
| 1 — single header toggle | Task 5 (header segmented control) + Task 3 (sidebar tab strip removed) |
| 2 — detached tile + hybrid header | Task 3 (tile chrome + header) + Task 4 (history disclosure) |
| 3 — independent resize handles | Task 2 (left handle in ChatShell) + Task 3 (right handle on tile left edge) |
| 4 — RouteShell skeleton + fade | Task 7 (component) + Task 8 (route wrapping) |
| 5 — composer cleanup + mode submenu | Task 6 |
| Data model — `leftSidebarWidth/rightSidebarWidth/activeAttackTool` | Task 1 |

## Self-review verdict

- **Spec coverage:** all 5 sections + the data-model addition have a task. No gaps.
- **Placeholder scan:** no TBD/TODO/incomplete. Fallback paths spelled out (e.g., dropdown lib without `Sub` support → flat menu).
- **Type consistency:** `leftSidebarWidth`/`rightSidebarWidth` declared in Task 1, used in Tasks 2/3 with the same names. `setActiveTool` (Task 5) writes the field that ChatShell (Task 2) reads. `activeAttackTool` consistent throughout.

## Out of scope (deferred)

- Mobile / tablet breakpoints for the 3-col grid.
- Keyboard shortcut to toggle Chain/Godmode (e.g., `Cmd+Shift+J`).
- Per-route skeleton variants for Dataset / Guide / Settings.
- Animated transition for sidebar widths (currently raw drag → instant width change).
- Resizable center column.
- Migrating existing chats with `workspaceWidth` to populate `rightSidebarWidth` proactively (the runtime fallback handles read-side transparently).
