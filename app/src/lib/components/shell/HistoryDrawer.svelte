<script lang="ts">
  /**
   * Global slide-in drawer for tool run history.
   *
   * Wave 4.2 rewrite: reads from the persistent v2 history store
   * (`$lib/history/store.svelte`) rather than the legacy in-memory
   * sessionLog. Three tabs:
   *
   *  - This session: runs whose `startedAt > sessionStartTime` (captured at
   *    module load) — preserves the "since you opened the page" semantics
   *    from the legacy drawer while moving the source of truth to v2.
   *  - Pinned: runs the user has pinned (cross-session, persistent).
   *  - All: every persisted run, newest first.
   *
   * Per-entry actions on hover: Open (jumps to tool route), Replay
   * (navigates with a hint toast for now — deep auto-replay is a v2.1
   * follow-up), Pin toggle, Annotate (inline edit with pencil → input).
   *
   * Footer keeps JSON + Markdown export and a Clear button that wipes both
   * the persisted history AND the in-memory sessionLog under a single
   * confirm.
   */
  import { fade, fly } from 'svelte/transition';
  import { sessionLog, downloadText } from '$lib/stores/sessionLog.svelte';
  import { history } from '$lib/history/store.svelte';
  import type { ToolRun } from '$lib/history/types';
  import { isOverSoftQuota } from '$lib/history/quota';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { notify } from '$lib/stores/toast.svelte';
  import { cn } from '$lib/utils/cn';
  import X from 'lucide-svelte/icons/x';
  import Star from 'lucide-svelte/icons/star';
  import Activity from 'lucide-svelte/icons/activity';
  import List from 'lucide-svelte/icons/list';
  import Download from 'lucide-svelte/icons/download';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Pin from 'lucide-svelte/icons/pin';
  import Pencil from 'lucide-svelte/icons/pencil';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import Search from 'lucide-svelte/icons/search';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  // Captured at module load — defines "this session" for tab 1.
  const sessionStartTime = Date.now();

  type Tab = 'session' | 'pinned' | 'all';
  let tab = $state<Tab>('session');

  // Debounced search query (200ms).
  let queryInput = $state('');
  let debouncedQuery = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const q = queryInput;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = q.trim();
    }, 200);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  const baseResults = $derived(
    history.search({
      text: debouncedQuery || undefined,
      limit: 200
    })
  );

  const sessionRuns = $derived(baseResults.filter((r) => r.startedAt >= sessionStartTime));
  const pinnedRuns = $derived(baseResults.filter((r) => r.pinned));
  const allRuns = $derived(baseResults);

  const visibleRuns = $derived(
    tab === 'session' ? sessionRuns : tab === 'pinned' ? pinnedRuns : allRuns
  );

  // Inline annotation editor — only one entry editable at a time.
  let annotateId = $state<string | null>(null);
  let annotateDraft = $state('');

  function openAnnotate(run: ToolRun) {
    annotateId = run.id;
    annotateDraft = run.annotation ?? '';
  }

  function commitAnnotate() {
    if (annotateId === null) return;
    history.annotate(annotateId, annotateDraft);
    annotateId = null;
    annotateDraft = '';
  }

  function cancelAnnotate() {
    annotateId = null;
    annotateDraft = '';
  }

  function dateStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  function downloadJSON() {
    const json = history.exportJson();
    downloadText(json, `cryptex-history-${dateStamp()}.json`, 'application/json;charset=utf-8');
    notify.success(`Exported ${history.all.length} runs as JSON`);
  }

  function downloadMarkdown() {
    const md = history.exportMarkdown();
    downloadText(md, `cryptex-history-${dateStamp()}.md`, 'text/markdown;charset=utf-8');
    notify.success(`Exported ${history.all.length} runs as Markdown`);
  }

  function clearAll() {
    const total = history.all.length + sessionLog.size;
    if (total === 0) return;
    if (
      !confirm(
        `Clear ${history.all.length} persisted run${history.all.length === 1 ? '' : 's'} and ${sessionLog.size} in-memory session entr${sessionLog.size === 1 ? 'y' : 'ies'}? Pinned items are also cleared. This cannot be undone.`
      )
    )
      return;
    history.clear();
    sessionLog.clear();
    notify.info('History cleared');
  }

  function routeFor(toolId: string): string {
    if (toolId.startsWith('redteam/')) return `${base}/${toolId}/`;
    if (toolId === 'transform') return `${base}/transforms/`;
    return `${base}/${toolId}/`;
  }

  function openRun(run: ToolRun) {
    goto(routeFor(run.toolId));
    onclose();
    notify.info(`Opened ${run.toolId}`);
  }

  function replayRun(run: ToolRun) {
    goto(`${routeFor(run.toolId)}?replayRunId=${encodeURIComponent(run.id)}`);
    onclose();
    notify.info("Replay: open the tool's Recent runs panel and click Replay on this entry.");
  }

  function relativeTime(ts: number): string {
    const delta = Date.now() - ts;
    if (delta < 60_000) return `${Math.max(1, Math.round(delta / 1000))}s ago`;
    if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
    return new Date(ts).toLocaleString();
  }

  function truncate(text: string, max = 100): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function inferOperation(run: ToolRun): string {
    const op = run.params.operation;
    if (typeof op === 'string') return op;
    return run.status;
  }

  function inferLabel(run: ToolRun): string | undefined {
    const label = run.params.label;
    return typeof label === 'string' ? label : undefined;
  }

  // Reactive overage check — recomputed whenever runs change (estimateUsage
  // reads localStorage so it'll naturally pick up the new state).
  const overSoftCap = $derived.by(() => {
    // Touch history.all to make this derived re-run on changes.
    void history.all.length;
    return isOverSoftQuota();
  });

  const totalCount = $derived(history.all.length);
  const sessionCount = $derived(sessionRuns.length);
  const pinnedCount = $derived(pinnedRuns.length);
</script>

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
    aria-label="Close session history"
    transition:fade={{ duration: 140 }}
    onclick={onclose}
  ></button>

  <div
    class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-glass"
    transition:fly={{ x: 360, duration: 220, opacity: 1 }}
    role="dialog"
    aria-label="Session history"
    tabindex="-1"
  >
    <header class="flex items-center justify-between border-b border-border/60 px-5 py-3">
      <h2 class="font-serif text-lg">History</h2>
      <button
        type="button"
        onclick={onclose}
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Close history drawer"
      >
        <X size={14} />
      </button>
    </header>

    {#if overSoftCap}
      <div class="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-200">
        <div class="flex items-start gap-1.5">
          <AlertTriangle size={12} class="mt-0.5 flex-none" />
          <span
            >History storage is over the 4 MB soft cap. Auto-prune is keeping the latest 150
            unpinned runs.</span
          >
        </div>
      </div>
    {/if}

    <!-- Search -->
    <div class="border-b border-border/60 px-3 py-2">
      <div class="relative">
        <Search
          size={12}
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          bind:value={queryInput}
          placeholder="Search input, output, annotation…"
          class="w-full rounded-md border border-input bg-background/70 pl-7 pr-2 py-1 text-xs focus:border-ring focus:outline-none"
        />
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border/60 p-1">
      <button
        type="button"
        onclick={() => (tab = 'session')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'session'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Activity size={12} /> This session
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{sessionCount}</span>
      </button>
      <button
        type="button"
        onclick={() => (tab = 'pinned')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'pinned'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Star size={12} /> Pinned
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{pinnedCount}</span>
      </button>
      <button
        type="button"
        onclick={() => (tab = 'all')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <List size={12} /> All
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{totalCount}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto cryptex-scroll px-3 py-2">
      {#if visibleRuns.length === 0}
        <p class="py-12 text-center text-xs text-muted-foreground">
          {#if tab === 'session'}
            No activity yet. Run a tool and it'll appear here.
          {:else if tab === 'pinned'}
            Pin a run from the All tab (or any tool's Recent panel) to keep it here.
          {:else if debouncedQuery}
            No runs match "{debouncedQuery}".
          {:else}
            No runs persisted yet.
          {/if}
        </p>
      {:else}
        <ol class="space-y-1.5">
          {#each visibleRuns as run (run.id)}
            <li class="group rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-1.5">
                  {#if run.pinned}<Pin size={10} class="flex-none text-amber-400" />{/if}
                  <span
                    class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary"
                  >
                    {run.toolId}
                  </span>
                  <span class="shrink-0 text-[10px] text-muted-foreground">{inferOperation(run)}</span>
                  {#if inferLabel(run)}
                    <span class="truncate text-[11px] text-foreground">· {inferLabel(run)}</span>
                  {/if}
                  {#if run.status === 'error'}
                    <span
                      class="shrink-0 rounded-full border border-red-500/30 px-1.5 py-0 text-[9px] uppercase tracking-wider text-red-300"
                      >error</span
                    >
                  {/if}
                </div>
                <span class="shrink-0 text-[10px] text-muted-foreground"
                  >{relativeTime(run.startedAt)}</span
                >
              </div>
              {#if run.inputSummary}
                <div class="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={run.inputSummary}>
                  in: {truncate(run.inputSummary, 100)}
                </div>
              {/if}
              {#if run.outputSummary}
                <div class="truncate font-mono text-[11px] text-foreground/80" title={run.outputSummary}>
                  out: {truncate(run.outputSummary, 100)}
                </div>
              {/if}

              {#if annotateId === run.id}
                <div class="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    bind:value={annotateDraft}
                    placeholder="Add a note…"
                    autofocus
                    onblur={commitAnnotate}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') commitAnnotate();
                      else if (e.key === 'Escape') cancelAnnotate();
                    }}
                    class="flex-1 rounded-md border border-input bg-background/70 px-2 py-1 text-[11px] focus:border-ring focus:outline-none"
                  />
                </div>
              {:else if run.annotation}
                <div class="mt-1 flex items-start gap-1.5 text-[11px] italic text-muted-foreground">
                  <span class="flex-1">{run.annotation}</span>
                  <button
                    type="button"
                    onclick={() => openAnnotate(run)}
                    class="flex-none text-muted-foreground hover:text-foreground"
                    aria-label="Edit annotation"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              {/if}

              <div
                class="mt-1 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <button
                  type="button"
                  onclick={() => openRun(run)}
                  class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  aria-label="Open tool"
                >
                  Open <ChevronRight size={10} />
                </button>
                <button
                  type="button"
                  onclick={() => replayRun(run)}
                  class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  aria-label="Replay run"
                >
                  <RotateCcw size={10} /> Replay
                </button>
                <button
                  type="button"
                  onclick={() => history.pin(run.id)}
                  class={cn(
                    'inline-flex items-center text-[10px]',
                    run.pinned
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={run.pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={10} />
                </button>
                {#if !run.annotation && annotateId !== run.id}
                  <button
                    type="button"
                    onclick={() => openAnnotate(run)}
                    class="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label="Add annotation"
                  >
                    <Pencil size={10} />
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <!-- Actions -->
    <footer class="border-t border-border/60 p-3 space-y-2">
      <div class="text-[10px] text-muted-foreground leading-relaxed">
        Persisted in your browser only — never uploaded. Pin runs to survive auto-prune.
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={downloadJSON}
          disabled={history.all.length === 0}
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={12} /> JSON
        </button>
        <button
          type="button"
          onclick={downloadMarkdown}
          disabled={history.all.length === 0}
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={12} /> Markdown
        </button>
        <button
          type="button"
          onclick={clearAll}
          disabled={history.all.length === 0 && sessionLog.size === 0}
          class="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Clear history"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </footer>
  </div>
{/if}
