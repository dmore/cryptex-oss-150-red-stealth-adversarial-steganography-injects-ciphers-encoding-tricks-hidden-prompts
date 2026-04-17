<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import Copy from 'lucide-svelte/icons/copy';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { tokenizerState, type Engine, type Token } from './tokenizer.state.svelte';

  const s = tokenizerState;
  let pending = $state(false);

  const engines: Array<{ id: Engine; label: string }> = [
    { id: 'byte', label: 'UTF-8 bytes' },
    { id: 'word', label: 'Words' },
    { id: 'cl100k', label: 'cl100k (GPT-3.5/4)' },
    { id: 'o200k', label: 'o200k (GPT-4o)' },
    { id: 'p50k', label: 'p50k (edit)' },
    { id: 'r50k', label: 'r50k (davinci)' }
  ];

  const charCount = $derived(Array.from(s.input).length);
  const wordCount = $derived((s.input.trim().match(/[^\s]+/g) || []).length);
  const tokenCount = $derived(s.tokens.length);

  // Color per token index — cycle through 8 hues so adjacent tokens are visually distinct
  function hueFor(i: number): number {
    return (i * 37) % 360;
  }

  let runId = 0;
  $effect(() => {
    // track input + engine
    const snapshotInput = s.input;
    const snapshotEngine = s.engine;
    const thisRun = ++runId;
    tokenize(snapshotInput, snapshotEngine, thisRun);
  });

  async function tokenize(text: string, eng: Engine, thisRun: number) {
    if (!text) { s.tokens = []; return; }

    if (eng === 'byte') {
      const bytes = new TextEncoder().encode(text);
      const out: Token[] = [];
      for (const b of bytes) out.push({ id: b, text: `0x${b.toString(16).padStart(2, '0')}` });
      if (thisRun === runId) s.tokens = out;
      return;
    }
    if (eng === 'word') {
      const parts = text.split(/(\s+|[.,!?:;()[\]{}])/);
      const out: Token[] = [];
      for (const p of parts) if (p) out.push({ text: p });
      if (thisRun === runId) s.tokens = out;
      return;
    }

    // BPE modes
    pending = true;
    try {
      const mod = await loadEncoding(eng);
      if (thisRun !== runId) return; // input/engine changed during load
      const ids: number[] = mod.encode(text);
      const out: Token[] = [];
      for (const id of ids) out.push({ id, text: mod.decode([id]) });
      if (thisRun === runId) s.tokens = out;
    } catch (err) {
      console.error('tokenizer load failed', err);
      notify.error('Tokenizer failed to load — falling back to bytes');
      s.engine = 'byte';
    } finally {
      if (thisRun === runId) pending = false;
    }
  }

  async function loadEncoding(eng: Engine) {
    switch (eng) {
      case 'o200k': return await import('gpt-tokenizer/encoding/o200k_base');
      case 'p50k':  return await import('gpt-tokenizer/encoding/p50k_edit');
      case 'r50k':  return await import('gpt-tokenizer/encoding/r50k_base');
      default:      return await import('gpt-tokenizer/encoding/cl100k_base');
    }
  }

  async function copyIds() {
    if (s.tokens.length === 0) return;
    const ids = s.tokens.map((t) => (t.id === undefined ? '-' : t.id)).join(' ');
    try {
      await navigator.clipboard.writeText(ids);
      sessionLog.record({
        tool: 'tokenizer',
        operation: s.engine,
        label: `${s.tokens.length} tokens`,
        input: s.input,
        output: ids
      });
      notify.success('Token IDs copied');
    } catch {
      notify.error('Copy failed');
    }
  }
</script>

<svelte:head><title>Tokenizer · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Tokenizer
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Visualize how models segment your text. Toggle between UTF-8 bytes, naive word splits, and the
      BPE encoders used by GPT-3.5, GPT-4, and GPT-4o.
    </p>
  </header>

  <div class="flex flex-wrap items-center gap-3">
    <div class="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card/40 p-1">
      {#each engines as e (e.id)}
        <button
          type="button"
          onclick={() => (s.engine = e.id)}
          class={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            s.engine === e.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {e.label}
        </button>
      {/each}
    </div>
    {#if pending}
      <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader size={11} class="animate-spin" /> Loading encoder…
      </span>
    {/if}
  </div>

  <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
    <h2 class="font-serif text-sm">Input</h2>
    <textarea
      bind:value={s.input}
      rows="4"
      placeholder="Enter text to tokenize…"
      class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    ></textarea>
    <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span><strong class="text-foreground">{charCount.toLocaleString()}</strong> chars</span>
      <span><strong class="text-foreground">{wordCount.toLocaleString()}</strong> words</span>
      <span><strong class="text-foreground">{tokenCount.toLocaleString()}</strong> tokens</span>
    </div>
  </div>

  {#if s.tokens.length > 0}
    <div class="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Tokens</h2>
        <button
          type="button"
          onclick={copyIds}
          class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Copy size={11} /> Copy IDs
        </button>
      </div>
      <div class="flex flex-wrap gap-0.5 font-mono text-sm">
        {#each s.tokens as t, i (i)}
          <span
            class="rounded px-1 py-0.5 border border-foreground/5"
            style={`background: hsl(${hueFor(i)} 60% 85% / 0.2); color: hsl(${hueFor(i)} 60% 45%);`}
            title={t.id !== undefined ? `id: ${t.id}` : undefined}
          >
            {t.text === ' ' ? '␣' : t.text === '\n' ? '⏎' : t.text}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</section>
