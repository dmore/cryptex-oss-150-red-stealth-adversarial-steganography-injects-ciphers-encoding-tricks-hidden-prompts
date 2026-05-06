<script lang="ts">
  import {
    ADV_SUFFIXES,
    SUFFIX_CATEGORIES,
    suffixesByCategory,
    type AdvSuffix,
    type SuffixCategory
  } from '$lib/redteam/adv-suffixes';
  import { notify } from '$lib/stores/toast.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Skull from 'lucide-svelte/icons/skull';

  let selectedCategory = $state<SuffixCategory | 'all'>('all');
  let searchTerm = $state('');
  let minSuccessRate = $state(0);

  const filtered = $derived.by(() => {
    let list: AdvSuffix[] = selectedCategory === 'all' ? ADV_SUFFIXES : suffixesByCategory(selectedCategory);
    if (minSuccessRate > 0) {
      list = list.filter((s) => s.reportedSuccessRate >= minSuccessRate);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.suffix.toLowerCase().includes(q) ||
          s.reportedTargets.toLowerCase().includes(q) ||
          s.source.toLowerCase().includes(q)
      );
    }
    return list;
  });

  async function copyToClipboard(s: AdvSuffix) {
    try {
      await navigator.clipboard.writeText(s.suffix);
      notify.success(`Copied ${s.id}`);
    } catch {
      notify.error('Copy failed');
    }
  }

  function categoryLabel(cat: SuffixCategory | 'all'): string {
    const labels: Record<SuffixCategory | 'all', string> = {
      all: 'All',
      gcg: 'GCG',
      autodan: 'AutoDAN',
      harmbench: 'HarmBench',
      jbb: 'JailbreakBench',
      advbench: 'AdvBench',
      pair: 'PAIR',
      tap: 'TAP',
      pap: 'PAP',
      'best-of-n': 'Best-of-N',
      reasoning: 'Reasoning',
      community: 'Community'
    };
    return labels[cat];
  }

  function successColor(rate: number): string {
    if (rate >= 0.7) return 'text-emerald-400';
    if (rate >= 0.5) return 'text-amber-400';
    return 'text-muted-foreground';
  }
</script>

<svelte:head><title>Adv-Suffix Library · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Adversarial <span class="text-primary italic">suffix</span> library
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Curated public corpus of GCG / AutoDAN / HarmBench / PAIR / TAP / PAP / Best-of-N transferable
      adversarial suffixes from peer-reviewed 2023-2026 red-team literature. Hit rate on current
      frontier models is always lower than paper numbers — labs train against these.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar — controls -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Category</span>
        <select
          bind:value={selectedCategory}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All ({ADV_SUFFIXES.length})</option>
          {#each SUFFIX_CATEGORIES as cat}
            <option value={cat}>{categoryLabel(cat)} ({suffixesByCategory(cat).length})</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Search</span>
        <input
          bind:value={searchTerm}
          type="search"
          placeholder="id, text, target, source…"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Min success: {(minSuccessRate * 100).toFixed(0)}%</span>
        <input
          type="range"
          min="0"
          max="0.9"
          step="0.05"
          bind:value={minSuccessRate}
          class="w-full accent-primary"
        />
      </label>

      <div class="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span>Showing</span>
        <span class="font-mono text-foreground">{filtered.length} / {ADV_SUFFIXES.length}</span>
      </div>

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Skull size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Direct paste into chat composer, or use the
          <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">adv_suffix</code>
          chain mutator with
          <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">metadata.suffixText</code>.
        </p>
      </div>
    </div>

    <!-- Right — results list -->
    <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Suffixes</h2>
        <span class="font-mono text-[11px] text-muted-foreground">
          {selectedCategory === 'all' ? 'all' : categoryLabel(selectedCategory)} · {filtered.length}
        </span>
      </div>

      {#if filtered.length === 0}
        <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
          No suffixes match the current filter.
        </div>
      {:else}
        <ul class="flex max-h-[calc(100vh-22rem)] flex-col gap-2 overflow-y-auto pr-1 cryptex-scroll">
          {#each filtered as s (s.id)}
            <li class="rounded-lg border border-input bg-background/70 p-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{s.id}</code>
                    <span class="rounded-full border border-border bg-card/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {categoryLabel(s.category)}
                    </span>
                    <span class="font-mono text-[10px] text-muted-foreground">{s.year}</span>
                    <span class={'font-mono text-[11px] ' + successColor(s.reportedSuccessRate)}>
                      {(s.reportedSuccessRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <pre class="whitespace-pre-wrap break-all rounded border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground">{s.suffix}</pre>
                  <div class="text-[10px] text-muted-foreground">
                    <span class="font-medium text-foreground">{s.source}</span>
                    <span class="mx-1">·</span>
                    <span>{s.reportedTargets}</span>
                  </div>
                  {#if s.notes}
                    <p class="text-[10px] italic text-muted-foreground">{s.notes}</p>
                  {/if}
                </div>
                <button
                  type="button"
                  onclick={() => copyToClipboard(s)}
                  class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Copy suffix"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
