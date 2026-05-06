<script lang="ts">
  import {
    GLITCH_TOKENS,
    findGlitchTokens,
    listFamilies,
    type GlitchToken,
    type ModelFamily,
    type GlitchSeverity,
    type GlitchEffect
  } from '$lib/redteam/glitch-tokens';
  import { notify } from '$lib/stores/toast.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Zap from 'lucide-svelte/icons/zap';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';

  const families = listFamilies();
  let scanInput = $state('');
  let selectedFamily = $state<ModelFamily>('gpt-4');
  let severityFilter = $state<GlitchSeverity | 'all'>('all');
  let effectFilter = $state<GlitchEffect | 'all'>('all');
  let searchTerm = $state('');

  const detected = $derived(
    scanInput.length > 0 ? findGlitchTokens(scanInput, selectedFamily) : []
  );

  const familyTokens = $derived.by(() => {
    let list = GLITCH_TOKENS.filter((g) => g.family.includes(selectedFamily));
    if (severityFilter !== 'all') list = list.filter((g) => g.severity === severityFilter);
    if (effectFilter !== 'all') list = list.filter((g) => g.effect === effectFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (g) =>
          g.token.toLowerCase().includes(q) ||
          g.source.toLowerCase().includes(q) ||
          g.effect.toLowerCase().includes(q)
      );
    }
    return list;
  });

  const familyCounts = $derived.by(() => {
    const all = GLITCH_TOKENS.filter((g) => g.family.includes(selectedFamily));
    return {
      all: all.length,
      high: all.filter((g) => g.severity === 'high').length,
      medium: all.filter((g) => g.severity === 'medium').length,
      low: all.filter((g) => g.severity === 'low').length
    };
  });

  // All effects present in the current family for the dropdown.
  const familyEffects = $derived.by<GlitchEffect[]>(() => {
    const set = new Set<GlitchEffect>();
    for (const g of GLITCH_TOKENS) {
      if (g.family.includes(selectedFamily)) set.add(g.effect);
    }
    return Array.from(set).sort();
  });

  async function copyToken(t: GlitchToken) {
    try {
      await navigator.clipboard.writeText(t.token);
      notify.success('Token copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function severityClass(s: GlitchSeverity): string {
    if (s === 'high') return 'border-red-500/40 bg-red-500/10 text-red-400';
    if (s === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
    return 'border-border bg-card/60 text-muted-foreground';
  }

  function effectClass(effect: GlitchEffect): string {
    if (effect === 'crash' || effect === 'leak') return 'text-red-400';
    if (effect === 'gibberish' || effect === 'invert' || effect === 'repeat') return 'text-amber-400';
    return 'text-muted-foreground';
  }
</script>

<svelte:head><title>Glitch Token Detector · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Glitch <span class="text-primary italic">token</span> detector
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Tokenizer artifacts that produce undefined model behavior — gibberish, repeat-loops,
      training-data leaks, crashes. Per-family because each tokenizer has its own set: a token
      toxic to GPT-4 is benign to Claude.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar — controls + scan input -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Target model family</span>
        <select
          bind:value={selectedFamily}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each families as f}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Severity</span>
        <select
          bind:value={severityFilter}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All ({familyCounts.all})</option>
          <option value="high">High ({familyCounts.high})</option>
          <option value="medium">Medium ({familyCounts.medium})</option>
          <option value="low">Low ({familyCounts.low})</option>
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Effect</span>
        <select
          bind:value={effectFilter}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All</option>
          {#each familyEffects as e}
            <option value={e}>{e}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Search</span>
        <input
          bind:value={searchTerm}
          type="search"
          placeholder="token, source, effect…"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Scan text for known tokens</span>
        <textarea
          bind:value={scanInput}
          rows="4"
          placeholder="Paste prompt or response…"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </label>

      <div class="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span>Showing</span>
        <span class="font-mono text-foreground">{familyTokens.length} / {familyCounts.all}</span>
      </div>

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Zap size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Use the <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">glitch_token</code>
          chain mutator to wrap a prompt with prefix + suffix tokens via
          <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">metadata.prefix/suffix</code>.
        </p>
      </div>
    </div>

    <!-- Right — scan results + catalog -->
    <div class="space-y-4">
      <!-- Scan results card -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Scan results</h2>
          {#if scanInput.length > 0}
            <span class="font-mono text-[11px] text-muted-foreground">
              {selectedFamily} · {detected.length} hit{detected.length === 1 ? '' : 's'}
            </span>
          {/if}
        </div>

        {#if scanInput.length === 0}
          <p class="rounded-lg border border-dashed border-border/40 bg-background/20 p-3 text-xs text-muted-foreground">
            Paste text in the sidebar to scan for known glitch tokens.
          </p>
        {:else if detected.length === 0}
          <p class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-400">
            ✓ No known glitch tokens for {selectedFamily}.
          </p>
        {:else}
          <ul class="flex flex-wrap gap-1.5">
            {#each detected as t}
              <li class="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px]">
                <AlertTriangle size={11} class="text-red-400" />
                <code class="break-all font-mono text-foreground">{t.token}</code>
                <span class={'text-[10px] ' + effectClass(t.effect)}>· {t.effect}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Catalog -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Catalog · {selectedFamily}</h2>
          <span class="font-mono text-[11px] text-muted-foreground">{familyTokens.length} tokens</span>
        </div>

        {#if familyTokens.length === 0}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            No tokens match the current filter.
          </div>
        {:else}
          <ul class="flex max-h-[calc(100vh-26rem)] flex-col gap-1.5 overflow-y-auto pr-1 cryptex-scroll">
            {#each familyTokens as t}
              <li class="rounded-lg border border-input bg-background/70 p-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <code class="break-all rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{t.token}</code>
                      <span class={'rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' + severityClass(t.severity)}>
                        {t.severity}
                      </span>
                      <span class={'font-mono text-[10px] ' + effectClass(t.effect)}>{t.effect}</span>
                    </div>
                    <div class="text-[10px] text-muted-foreground">
                      <span class="font-medium text-foreground">{t.source}</span>
                      {#if t.notes}<span class="mx-1">·</span><span class="italic">{t.notes}</span>{/if}
                    </div>
                  </div>
                  <button
                    type="button"
                    onclick={() => copyToken(t)}
                    class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Copy token"
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
  </div>
</section>
