<script lang="ts">
  import { history } from '$lib/history/store.svelte';
  import type { HistoryQuery, ToolRun } from '$lib/history/types';
  import { isOverSoftQuota } from '$lib/history/quota';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { notify } from '$lib/stores/toast.svelte';
  import { downloadText } from '$lib/stores/sessionLog.svelte';
  import Search from 'lucide-svelte/icons/search';
  import Download from 'lucide-svelte/icons/download';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Pin from 'lucide-svelte/icons/pin';
  import Pencil from 'lucide-svelte/icons/pencil';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';

  let query = $state('');
  let toolFilter = $state<string>('');
  let statusFilter = $state<HistoryQuery['status'] | ''>('');
  let pinnedOnly = $state(false);

  const results = $derived(
    history.search({
      text: query.trim() || undefined,
      toolId: toolFilter || undefined,
      status: statusFilter || undefined,
      pinnedOnly: pinnedOnly || undefined,
      limit: 500
    })
  );

  const tools = $derived.by(() => {
    const set = new Set<string>();
    for (const r of history.all) set.add(r.toolId);
    return [...set].sort();
  });

  // Reactive over-quota indicator; touches history.all so it re-runs on edits.
  const overSoftCap = $derived.by(() => {
    void history.all.length;
    return isOverSoftQuota();
  });

  // Per-run UI state: annotation editor, payload load+expand toggle.
  let annotateId = $state<string | null>(null);
  let annotateDraft = $state('');
  let expanded = $state<Record<string, boolean>>({});
  let payloads = $state<Record<string, { input: string; output: string } | null>>({});

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

  async function toggleExpand(run: ToolRun) {
    const wasOpen = expanded[run.id] === true;
    expanded = { ...expanded, [run.id]: !wasOpen };
    if (!wasOpen && payloads[run.id] === undefined) {
      const full = await history.getPayload(run.id);
      payloads = { ...payloads, [run.id]: full };
    }
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
    if (history.all.length === 0) return;
    if (
      !confirm(
        `Delete ALL ${history.all.length} history entries? Pinned items will also be cleared.`
      )
    )
      return;
    history.clear();
    payloads = {};
    expanded = {};
    notify.success('History cleared');
  }

  function routeFor(toolId: string): string {
    if (toolId.startsWith('redteam/')) return `${base}/${toolId}/`;
    if (toolId === 'transform') return `${base}/transforms/`;
    return `${base}/${toolId}/`;
  }

  function replayRun(run: ToolRun) {
    goto(`${routeFor(run.toolId)}?replayRunId=${encodeURIComponent(run.id)}`);
    notify.info("Open the tool's Recent runs panel and click Replay on this entry.");
  }

  function statusBadge(s: 'done' | 'error' | 'cancelled'): string {
    if (s === 'done') return 'border-emerald-500/30 text-emerald-300';
    if (s === 'error') return 'border-red-500/30 text-red-300';
    return 'border-muted text-muted-foreground';
  }
</script>

<svelte:head><title>History · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight">History</h1>
    <p class="text-muted-foreground text-sm">
      All tool runs, searchable and replayable. Records persist in your browser only.
    </p>
  </header>

  {#if overSoftCap}
    <div
      class="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
    >
      <AlertTriangle size={14} class="mt-0.5 flex-none" />
      <span
        >History storage is over the 4 MB soft cap. Auto-prune is keeping the latest 150 unpinned
        runs.</span
      >
    </div>
  {/if}

  <div class="rounded-xl border border-border bg-card/40 p-4 space-y-3">
    <div class="flex flex-wrap gap-2">
      <div class="relative flex-1 min-w-48">
        <Search
          size={14}
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          bind:value={query}
          placeholder="Search across input, output, annotation..."
          class="w-full rounded-md border border-input bg-background/70 pl-8 pr-2 py-1.5 text-sm focus:border-ring focus:outline-none"
        />
      </div>

      <select
        bind:value={toolFilter}
        class="rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm"
      >
        <option value="">All tools</option>
        {#each tools as t (t)}
          <option value={t}>{t}</option>
        {/each}
      </select>

      <select
        bind:value={statusFilter}
        class="rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm"
      >
        <option value="">Any status</option>
        <option value="done">Done</option>
        <option value="error">Error</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <label
        class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm"
      >
        <input type="checkbox" bind:checked={pinnedOnly} class="accent-primary" />
        Pinned only
      </label>

      <button
        type="button"
        onclick={downloadJSON}
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Download size={14} /> Export JSON
      </button>
      <button
        type="button"
        onclick={downloadMarkdown}
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Download size={14} /> Export Markdown
      </button>
      <button
        type="button"
        onclick={clearAll}
        class="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
      >
        <Trash2 size={14} /> Clear all
      </button>
    </div>
  </div>

  <div class="rounded-xl border border-border bg-card/40 p-4">
    {#if results.length === 0}
      <p class="text-sm text-muted-foreground text-center py-12">No runs match your filters.</p>
    {:else}
      <p class="text-xs text-muted-foreground mb-3">
        {results.length} entr{results.length === 1 ? 'y' : 'ies'}
      </p>
      <ul class="space-y-2">
        {#each results as run (run.id)}
          <li class="rounded-lg border border-border bg-background/40 p-3 text-sm">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              {#if run.pinned}<Pin size={12} class="text-amber-400" />{/if}
              <a href={routeFor(run.toolId)} class="font-medium text-foreground hover:text-primary">
                {run.toolId}
              </a>
              <span class="font-mono text-xs text-muted-foreground">
                {new Date(run.startedAt).toLocaleString()}
              </span>
              <span
                class={'rounded-full border px-1.5 py-0 text-[10px] uppercase tracking-wider ' +
                  statusBadge(run.status)}>{run.status}</span
              >
              <span class="text-xs text-muted-foreground">{run.durationMs}ms</span>
              <button
                type="button"
                onclick={() => replayRun(run)}
                class="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-xs hover:bg-muted"
                aria-label="Replay this run"
              >
                <RotateCcw size={11} /> Replay
              </button>
              <button
                type="button"
                onclick={() => history.pin(run.id)}
                class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
                aria-label={run.pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={11} />
              </button>
            </div>
            <div class="space-y-1 text-xs">
              <div>
                <span class="text-muted-foreground">in:</span>
                <span class="font-mono text-foreground break-words line-clamp-2"
                  >{run.inputSummary || '(empty)'}</span
                >
              </div>
              {#if run.status === 'done'}
                <div>
                  <span class="text-muted-foreground">out:</span>
                  <span class="font-mono text-foreground break-words line-clamp-2"
                    >{run.outputSummary || '(empty)'}</span
                  >
                </div>
              {:else if run.errorMessage}
                <div>
                  <span class="text-muted-foreground">error:</span>
                  <span class="text-red-300 break-words">{run.errorMessage}</span>
                </div>
              {/if}

              <!-- Annotation: inline pencil edit -->
              {#if annotateId === run.id}
                <div class="mt-1 flex items-center gap-2">
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
                    class="flex-1 rounded-md border border-input bg-background/70 px-2 py-1 text-xs focus:border-ring focus:outline-none"
                  />
                </div>
              {:else if run.annotation}
                <div class="mt-1 flex items-start gap-2 text-muted-foreground italic">
                  <span class="flex-1">{run.annotation}</span>
                  <button
                    type="button"
                    onclick={() => openAnnotate(run)}
                    class="flex-none text-muted-foreground hover:text-foreground"
                    aria-label="Edit annotation"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              {:else}
                <button
                  type="button"
                  onclick={() => openAnnotate(run)}
                  class="mt-1 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  aria-label="Add annotation"
                >
                  <Pencil size={11} /> Annotate
                </button>
              {/if}
            </div>

            <!-- Show full payload (lazy-loaded from IDB / fallback) -->
            <div class="mt-2">
              <button
                type="button"
                onclick={() => toggleExpand(run)}
                class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                aria-expanded={expanded[run.id] === true}
              >
                {#if expanded[run.id]}
                  <ChevronDown size={11} /> Hide full payload
                {:else}
                  <ChevronRight size={11} /> Show full payload
                {/if}
              </button>
              {#if expanded[run.id]}
                {@const p = payloads[run.id]}
                {#if p === undefined}
                  <p class="mt-1 text-[11px] text-muted-foreground">Loading…</p>
                {:else if p === null}
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    Full payload unavailable (storage was cleared or the run predates payload
                    capture). Summary above is all we have.
                  </p>
                {:else}
                  <div class="mt-2 space-y-2 text-xs">
                    <details class="rounded-md border border-border/40 bg-background/60 p-2">
                      <summary class="cursor-pointer text-muted-foreground"
                        >Input ({p.input.length} chars)</summary
                      >
                      <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{p.input}</pre>
                    </details>
                    <details class="rounded-md border border-border/40 bg-background/60 p-2">
                      <summary class="cursor-pointer text-muted-foreground"
                        >Output ({p.output.length} chars)</summary
                      >
                      <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{p.output}</pre>
                    </details>
                  </div>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
