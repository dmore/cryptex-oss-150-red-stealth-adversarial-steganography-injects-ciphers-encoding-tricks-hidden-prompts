<script lang="ts">
  import { generateFuzzCases, type FuzzerOptions } from './fuzzer';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import FlaskConical from 'lucide-svelte/icons/flask-conical';
  import Copy from 'lucide-svelte/icons/copy';
  import Download from 'lucide-svelte/icons/download';
  import { fuzzerState } from './fuzzer.state.svelte';

  const s = fuzzerState;

  const toggles: Array<{ key: keyof FuzzerOptions; label: string; hint: string }> = [
    { key: 'useRandomMix',   label: 'Random Mix',     hint: 'Chain a 2–4 transform pipeline' },
    { key: 'zeroWidth',      label: 'Zero-width',     hint: 'Inject invisible characters' },
    { key: 'unicodeNoise',   label: 'Unicode noise',  hint: 'Add combining marks' },
    { key: 'whitespace',     label: 'Whitespace',     hint: 'Randomize space → tab / NBSP' },
    { key: 'casing',         label: 'Casing',         hint: 'Random per-char case' },
    { key: 'zalgo',          label: 'Zalgo',          hint: 'Dense combining-mark overlay' },
    { key: 'encodeShuffle',  label: 'Homoglyph',      hint: 'Greek/Cyrillic lookalikes' }
  ];

  function run() {
    if (!s.input) {
      s.outputs = [];
      notify.warn('Enter a seed first');
      return;
    }
    s.outputs = generateFuzzCases(s.input, s.opts);
    notify.success(`Generated ${s.outputs.length} variants`);
    sessionLog.record({
      tool: 'fuzzer',
      operation: 'generate',
      label: `${s.outputs.length} variants`,
      input: s.input,
      output: s.outputs.join('\n'),
      options: { ...s.opts }
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(label);
    } catch {
      notify.error('Copy failed');
    }
  }

  function copyAll() {
    if (s.outputs.length === 0) return;
    copy(s.outputs.join('\n'), `Copied ${s.outputs.length} variants`);
  }

  function download() {
    if (s.outputs.length === 0) return;
    const activeStrategies = toggles
      .filter((t) => (s.opts[t.key] as boolean))
      .map((t) => t.key)
      .join(',');
    const header = `# Cryptex fuzzer output\n# count=${s.outputs.length}\n# seed=${s.opts.seed || ''}\n# strategies=${activeStrategies}\n\n`;
    const lines = s.outputs.map((line, i) => `#${i + 1}\t${line}`).join('\n');
    const blob = new Blob([header + lines + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuzz_cases.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }
</script>

<svelte:head><title>Mutation Lab · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Mutation <span class="text-primary italic">lab</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Generate up to 500 mutated variants from a single seed using configurable strategies:
      zero-width injection, Unicode noise, whitespace chaos, homoglyph substitution, Zalgo, and random-transform chaining.
      Seeded for reproducibility.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Strategies</h2>
      <div class="space-y-1.5">
        {#each toggles as t (t.key)}
          <label class="flex items-start gap-2 text-xs">
            <input type="checkbox" bind:checked={s.opts[t.key] as boolean} class="h-4 w-4 mt-0.5 rounded accent-primary" />
            <span class="flex-1">
              <span class="font-medium">{t.label}</span>
              <span class="block text-[11px] text-muted-foreground">{t.hint}</span>
            </span>
          </label>
        {/each}
      </div>

      <div class="space-y-2 pt-2 border-t border-border/50">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Variants (1–500)</span>
          <input type="number" min="1" max="500" bind:value={s.opts.count}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Seed (optional — deterministic)</span>
          <input type="text" bind:value={s.opts.seed} placeholder="leave empty for random"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      <button
        type="button"
        onclick={run}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
      >
        <FlaskConical size={14} /> Generate variants
      </button>
    </div>

    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Seed input</h2>
      <textarea
        bind:value={s.input}
        rows="4"
        placeholder="The single string mutated into many…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>

      {#if s.outputs.length > 0}
        <div class="flex items-center justify-between pt-2 border-t border-border/50">
          <h3 class="font-serif text-sm">{s.outputs.length} variants</h3>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick={copyAll}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy size={11} /> Copy all
            </button>
            <button
              type="button"
              onclick={download}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Download size={11} /> Download
            </button>
          </div>
        </div>
        <ol class="space-y-1 max-h-[520px] overflow-y-auto pr-1">
          {#each s.outputs as variant, i (i)}
            <li class="group flex items-start gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <span class="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5 w-6 text-right">{i + 1}</span>
              <span class="flex-1 font-mono text-xs break-all whitespace-pre-wrap">{variant}</span>
              <button
                type="button"
                onclick={() => copy(variant, `Variant ${i + 1} copied`)}
                class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                aria-label="Copy variant"
              >
                <Copy size={13} />
              </button>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>
</section>
