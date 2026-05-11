<script lang="ts">
  import { history } from '$lib/history/store.svelte';
  import type { HistoryQuery } from '$lib/history/types';
  import { base } from '$app/paths';
  import { notify } from '$lib/stores/toast.svelte';
  import Search from 'lucide-svelte/icons/search';
  import Download from 'lucide-svelte/icons/download';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Pin from 'lucide-svelte/icons/pin';

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

  function downloadExport() {
    const json = history.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptex-history-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported ${history.all.length} runs`);
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
    notify.success('History cleared');
  }

  function routeFor(toolId: string): string {
    if (toolId.startsWith('redteam/')) return `${base}/${toolId}/`;
    return `${base}/${toolId}/`;
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
        onclick={downloadExport}
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Download size={14} /> Export JSON
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
                onclick={() => history.pin(run.id)}
                class="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
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
              {#if run.annotation}
                <div class="text-muted-foreground italic">{run.annotation}</div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
