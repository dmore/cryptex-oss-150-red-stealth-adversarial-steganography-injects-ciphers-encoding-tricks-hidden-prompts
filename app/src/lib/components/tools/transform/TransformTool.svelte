<script lang="ts">
  import { transformers, transformersByCategory, categories, getTransformer } from '$lib/transformers/registry';
  import type { Transformer } from '$lib/transformers/registry';
  import { getMergedTransformOptions } from '$lib/transformers/options';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { lastUsed } from '$lib/stores/lastUsed.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { cn } from '$lib/utils/cn';
  import TransformTile from './TransformTile.svelte';
  import TransformOptions from './TransformOptions.svelte';
  import { transformState } from './transform.state.svelte';
  import { runInWorker, MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import { errorLogger } from '$lib/errors/logger';
  import Copy from 'lucide-svelte/icons/copy';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Search from 'lucide-svelte/icons/search';
  import Star from 'lucide-svelte/icons/star';
  import Clock from 'lucide-svelte/icons/clock';
  import X from 'lucide-svelte/icons/x';

  // Shorthand alias — `s.input`, `s.direction`, etc. read/write module-level $state.
  const s = transformState;

  const active = $derived<Transformer | null>(s.activeName ? getTransformer(s.activeName) ?? null : null);
  const canReverse = $derived(!!(active && active.reverse));

  const filtered = $derived.by(() => {
    const q = s.search.trim().toLowerCase();
    if (!q) return null;
    return Object.values(transformers)
      .filter((t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const visibleCategories = $derived.by(() => {
    if (filtered) return [];
    return s.activeCategory === 'all' ? categories : categories.filter((c) => c === s.activeCategory);
  });

  const favoriteTransforms = $derived(
    favorites.items.map((n) => getTransformer(n)).filter((t): t is Transformer => !!t)
  );
  const recentTransforms = $derived(
    lastUsed.ordered.map((n) => getTransformer(n)).filter((t): t is Transformer => !!t)
  );

  // Output is computed via `runInWorker` so inputs ≥50 KB run off the main thread.
  // For <50 KB inputs (the common case) runInWorker takes the in-thread fast
  // path so we keep the live-preview feel without a worker round-trip.
  // 1 MB hard cap is enforced by runInWorker itself (throws CryptexError).
  let output = $state('');
  let lastReportedOversize = '';

  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    s.optsTick; // re-run when options change
    const a = active;
    const text = s.input;
    const dir = s.direction;
    if (!a || !text) {
      output = '';
      return;
    }
    // Pre-check the 1 MB cap so we can surface a single ErrorPanel rather than
    // throwing on every keystroke. runInWorker would throw too, but we avoid
    // calling it past the limit.
    if (text.length > MAX_INPUT_BYTES) {
      output = '';
      // Only report once per input change (keyed by length+first chars) so we
      // don't spam toasts as the user keeps typing.
      const key = `${text.length}:${text.slice(0, 24)}`;
      if (key !== lastReportedOversize) {
        lastReportedOversize = key;
        errorLogger.report(
          new Error('Input exceeds 1 MB cap. Trim the input or split into batches.'),
          { toastMessage: 'Input exceeds 1 MB cap. Trim the input or split into batches.' }
        );
      }
      return;
    }
    lastReportedOversize = '';
    if (dir === 'decode' && !a.reverse) {
      output = '';
      return;
    }
    const controller = new AbortController();
    const opts = getMergedTransformOptions(a);
    runInWorker(a.name, dir, text, opts, { signal: controller.signal })
      .then((result) => {
        output = result;
      })
      .catch((err) => {
        // Aborts are expected when input changes mid-flight; ignore.
        if ((err as Error)?.name === 'AbortError') return;
        // Tool errors (e.g., transformer throws on bad input) — surface but
        // don't spam toasts: log to console + clear output.
        if (import.meta.env.DEV) console.error('transform failed', err);
        output = '';
      });
    return () => controller.abort();
  });

  function tilePreview(t: Transformer): string {
    if (!s.input) return '';
    try {
      const opts = getMergedTransformOptions(t);
      const fn = s.direction === 'encode' ? t.func : t.reverse;
      if (!fn) return '';
      const result = fn.call(t, s.input.slice(0, 140), opts);
      return (result ?? '').slice(0, 80);
    } catch {
      return '';
    }
  }

  function select(t: Transformer) {
    s.activeName = t.name;
    lastUsed.touch(t.name);
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      sessionLog.record({
        tool: 'transform',
        operation: s.direction,
        label: active?.name,
        input: s.input,
        output
      });
      notify.success('Output copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function swap() {
    if (!output) {
      notify.warn('Run a transform first');
      return;
    }
    s.input = output;
  }
</script>

<section class="space-y-6">
  <!-- Input + Output row -->
  <div class="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
    <!-- Input -->
    <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Input</h2>
        <div class="inline-flex gap-0.5 rounded-md border border-border bg-card/40 p-0.5">
          <button
            type="button"
            onclick={() => (s.direction = 'encode')}
            class={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              s.direction === 'encode' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Encode
          </button>
          <button
            type="button"
            onclick={() => (s.direction = 'decode')}
            disabled={!canReverse && !!active}
            class={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              s.direction === 'decode' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Decode
          </button>
        </div>
      </div>
      <textarea
        bind:value={s.input}
        rows="8"
        placeholder="Paste or type any text…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{s.input.length.toLocaleString()} chars</span>
        <button
          type="button"
          onclick={() => (s.input = '')}
          disabled={!s.input}
          class="inline-flex items-center gap-1 disabled:opacity-40 hover:text-foreground"
        >
          <X size={11} /> Clear
        </button>
      </div>
    </div>

    <!-- Middle swap control -->
    <div class="hidden lg:flex items-center justify-center">
      <button
        type="button"
        onclick={swap}
        title="Push output back to input"
        class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Use output as new input"
      >
        <ArrowLeft size={16} />
      </button>
    </div>

    <!-- Output -->
    <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Output</h2>
        <div class="flex items-center gap-1.5">
          {#if active}
            <span class="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              {active.name}
            </span>
          {:else}
            <span class="text-[10px] text-muted-foreground uppercase tracking-wider">
              No transform selected
            </span>
          {/if}
          <button
            type="button"
            onclick={copyOutput}
            disabled={!output}
            class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Copy size={11} /> Copy
          </button>
        </div>
      </div>
      <textarea
        readonly
        value={output}
        rows="8"
        placeholder="Output appears after you pick a transform"
        class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
      ></textarea>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{output.length.toLocaleString()} chars</span>
        {#if active && s.direction === 'decode' && !canReverse}
          <span class="text-destructive">This transform cannot decode.</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Search + category nav -->
  <div class="flex flex-wrap items-center gap-3">
    <label class="relative flex-1 min-w-[260px] max-w-md">
      <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        bind:value={s.search}
        placeholder={`Search ${Object.keys(transformers).length} transforms…`}
        class="w-full rounded-lg border border-input bg-card/60 pl-8 pr-3 py-2 text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
    {#if !filtered}
      <div class="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card/40 p-1">
        <button
          type="button"
          onclick={() => (s.activeCategory = 'all')}
          class={cn(
            'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
            s.activeCategory === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        {#each categories as cat}
          <button
            type="button"
            onclick={() => (s.activeCategory = cat)}
            class={cn(
              'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
              s.activeCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {cat}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Favorites & recent strips (only when no search) -->
  {#if !filtered && (favoriteTransforms.length > 0 || recentTransforms.length > 0)}
    <div class="space-y-3">
      {#if favoriteTransforms.length > 0}
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Star size={11} class="text-accent fill-accent" /> Favorites
          </h3>
          <div class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {#each favoriteTransforms as t (t.name)}
              <TransformTile
                transform={t}
                active={s.activeName === t.name}
                preview={tilePreview(t)}
                onselect={() => select(t)}
                onopenOptions={() => (s.optionsForName = t.name)}
              />
            {/each}
          </div>
        </div>
      {/if}
      {#if recentTransforms.length > 0}
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Clock size={11} /> Recently used
          </h3>
          <div class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {#each recentTransforms as t (t.name)}
              <TransformTile
                transform={t}
                active={s.activeName === t.name}
                preview={tilePreview(t)}
                onselect={() => select(t)}
                onopenOptions={() => (s.optionsForName = t.name)}
              />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Category grids -->
  {#if filtered}
    <div>
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Search results ({filtered.length})
      </h3>
      {#if filtered.length === 0}
        <p class="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
          No transforms match "{s.search}".
        </p>
      {:else}
        <div class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {#each filtered as t (t.name)}
            <TransformTile
              transform={t}
              active={s.activeName === t.name}
              preview={tilePreview(t)}
              onselect={() => select(t)}
              onopenOptions={() => (s.optionsForName = t.name)}
            />
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    {#each visibleCategories as cat (cat)}
      <div>
        <h3 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ArrowRight size={11} /> {cat} ({transformersByCategory[cat].length})
        </h3>
        <div class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {#each transformersByCategory[cat] as t (t.name)}
            <TransformTile
              transform={t}
              active={s.activeName === t.name}
              preview={tilePreview(t)}
              onselect={() => select(t)}
              onopenOptions={() => (s.optionsForName = t.name)}
            />
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</section>

<!-- Options dialog -->
{#if s.optionsForName}
  {@const t = getTransformer(s.optionsForName)}
  {#if t}
    <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close options"
        onclick={() => (s.optionsForName = null)}
        class="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
      ></button>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-title"
        tabindex="-1"
        class="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-primary fade-in"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 id="options-title" class="font-serif text-lg">Options</h2>
          <button
            type="button"
            onclick={() => (s.optionsForName = null)}
            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close options"
          >
            <X size={14} />
          </button>
        </div>
        <TransformOptions transform={t} oninvalidate={() => s.bumpOpts()} />
      </div>
    </div>
  {/if}
{/if}
