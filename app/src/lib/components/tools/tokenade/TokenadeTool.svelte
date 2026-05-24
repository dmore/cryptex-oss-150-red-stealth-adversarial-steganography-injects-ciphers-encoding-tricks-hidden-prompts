<script lang="ts">
  import {
    generateTokenade, estimateTokenadeLength, generateTextPayload,
    QUICK_CARRIERS, TOKENADE_PRESETS,
    type Separator
  } from './tokenade';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { cn } from '$lib/utils/cn';
  import Bomb from 'lucide-svelte/icons/bomb';
  import Copy from 'lucide-svelte/icons/copy';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import { tokenadeState } from './tokenade.state.svelte';

  const s = tokenadeState;

  const estimate = $derived(estimateTokenadeLength(s.opts));
  const DANGER_THRESHOLD = 2_000_000; // 2M code points ≈ rough token danger zone

  const separators: Array<{ id: Separator; label: string }> = [
    { id: 'zwnj', label: 'ZWNJ' },
    { id: 'zwj',  label: 'ZWJ' },
    { id: 'zwsp', label: 'ZWSP' },
    { id: 'none', label: 'None' }
  ];

  async function runEmoji() {
    if (estimate > DANGER_THRESHOLD) {
      notify.warn(`That's about ${estimate.toLocaleString()} code points — still proceeding, but consider lowering depth/breadth.`);
    }
    s.output = generateTokenade(s.opts);
    if (s.autoCopy && s.output) {
      try {
        await navigator.clipboard.writeText(s.output);
        notify.success('Tokenade generated and copied');
      } catch {
        notify.info('Tokenade generated (clipboard blocked)');
      }
    } else {
      notify.success('Tokenade generated');
    }
    sessionLog.record({
      tool: 'tokenade',
      operation: 'emoji',
      label: s.autoCopy ? 'auto-copied' : 'generated',
      input: `depth=${s.opts.depth} breadth=${s.opts.breadth} repeats=${s.opts.repeats} carrier=${s.opts.carrier}`,
      output: s.output,
      options: { ...s.opts, autoCopy: s.autoCopy }
    });
  }

  function applyPreset(name: keyof typeof TOKENADE_PRESETS) {
    s.opts = { ...s.opts, ...TOKENADE_PRESETS[name] };
    notify.info(`Preset '${name}' applied`);
  }

  function runTextPayload() {
    s.textPayload = generateTextPayload({ base: s.tpBase, repeat: s.tpRepeat, combining: s.tpCombining, zeroWidth: s.tpZW });
    notify.success('Text payload generated');
    sessionLog.record({
      tool: 'tokenade',
      operation: 'text-payload',
      label: s.autoCopy ? 'auto-copied' : 'generated',
      input: `base=${s.tpBase} repeat=${s.tpRepeat} combining=${s.tpCombining} zw=${s.tpZW}`,
      output: s.textPayload,
      options: { base: s.tpBase, repeat: s.tpRepeat, combining: s.tpCombining, zeroWidth: s.tpZW }
    });
  }

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.success(label);
    } catch {
      notify.error('Copy failed');
    }
  }
</script>

<section class="space-y-6">
  <div class="inline-flex gap-1 rounded-lg border border-border bg-card/40 p-1">
    <button
      type="button"
      onclick={() => (s.activeTab = 'emoji')}
      class={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', s.activeTab === 'emoji' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
    >
      <Bomb size={12} class="inline -mt-0.5 mr-1" /> Emoji bomb
    </button>
    <button
      type="button"
      onclick={() => (s.activeTab = 'text')}
      class={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', s.activeTab === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
    >
      Text payload
    </button>
  </div>

  {#if s.activeTab === 'emoji'}
    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <!-- Controls -->
      <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Payload</h2>

        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Depth (1–8)</span>
            <input type="number" min="1" max="8" bind:value={s.opts.depth}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Breadth (1–10)</span>
            <input type="number" min="1" max="10" bind:value={s.opts.breadth}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Repeats (1–50)</span>
            <input type="number" min="1" max="50" bind:value={s.opts.repeats}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Separator</span>
            <select bind:value={s.opts.separator}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm focus:border-ring focus:outline-none">
              {#each separators as sep (sep.id)}<option value={sep.id}>{sep.label}</option>{/each}
            </select>
          </label>
        </div>

        <div class="space-y-1.5 text-xs text-muted-foreground">
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={s.opts.includeVS} class="h-4 w-4 rounded accent-primary" />
            Include variation selectors
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={s.opts.includeNoise} class="h-4 w-4 rounded accent-primary" />
            Include zero-width noise
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={s.opts.randomizeEmojis} class="h-4 w-4 rounded accent-primary" />
            Randomize emoji picks
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={s.opts.singleCarrier} class="h-4 w-4 rounded accent-primary" />
            Single carrier + Tag-sequence payload
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={s.autoCopy} class="h-4 w-4 rounded accent-primary" />
            Auto-copy output
          </label>
        </div>

        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Carrier emoji (single-carrier mode)</span>
          <div class="flex flex-wrap gap-1">
            {#each QUICK_CARRIERS as e (e)}
              <button
                type="button"
                onclick={() => (s.opts.carrier = e)}
                class={cn(
                  'h-8 w-8 rounded border text-lg leading-none',
                  s.opts.carrier === e ? 'border-primary bg-primary/10' : 'border-border bg-card/40 hover:border-primary/40'
                )}
                aria-label={`Use ${e}`}
              >{e}</button>
            {/each}
          </div>
          <input
            type="text"
            bind:value={s.opts.carrier}
            maxlength="4"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm mt-1"
            placeholder="or paste any emoji"
          />
        </label>

        <div class="space-y-1 pt-2 border-t border-border/50">
          <span class="text-xs text-muted-foreground">Presets</span>
          <div class="flex flex-wrap gap-1">
            {#each Object.keys(TOKENADE_PRESETS) as name (name)}
              <button
                type="button"
                onclick={() => applyPreset(name as keyof typeof TOKENADE_PRESETS)}
                class="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-card hover:text-foreground capitalize"
              >{name}</button>
            {/each}
          </div>
        </div>

        <button
          type="button"
          onclick={runEmoji}
          class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          <Bomb size={14} /> Generate
        </button>
      </div>

      <!-- Output -->
      <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Output</h2>
          <div class="flex items-center gap-1.5">
            {#if estimate > DANGER_THRESHOLD}
              <span class="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                <TriangleAlert size={10} /> danger
              </span>
            {/if}
            <button
              type="button"
              onclick={() => copy(s.output, 'Payload copied')}
              disabled={!s.output}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Copy size={11} /> Copy
            </button>
          </div>
        </div>
        <textarea
          readonly
          value={s.output}
          rows="12"
          placeholder="Payload appears after you generate"
          class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-xs"
        ></textarea>
        <div class="text-xs text-muted-foreground">
          Estimated length: <strong class="text-foreground">{estimate.toLocaleString()}</strong> code points ·
          Actual: <strong class="text-foreground">{s.output.length.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  {:else}
    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Text payload</h2>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Base character</span>
          <input type="text" bind:value={s.tpBase} maxlength="4"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Repeat (1–10,000)</span>
          <input type="number" min="1" max="10000" bind:value={s.tpRepeat}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" bind:checked={s.tpCombining} class="h-4 w-4 rounded accent-primary" />
          Add combining marks
        </label>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" bind:checked={s.tpZW} class="h-4 w-4 rounded accent-primary" />
          Add zero-width joiners
        </label>
        <button
          type="button"
          onclick={runTextPayload}
          class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Generate text payload
        </button>
      </div>
      <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Output</h2>
          <button
            type="button"
            onclick={() => copy(s.textPayload, 'Payload copied')}
            disabled={!s.textPayload}
            class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Copy size={11} /> Copy
          </button>
        </div>
        <textarea
          readonly
          value={s.textPayload}
          rows="12"
          class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-xs"
        ></textarea>
        <div class="text-xs text-muted-foreground">{s.textPayload.length.toLocaleString()} code points</div>
      </div>
    </div>
  {/if}
</section>
