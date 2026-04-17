<script lang="ts">
  import {
    runSplit,
    applyWrapping,
    type SplitMode,
    type TokenizerName
  } from './split';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { cn } from '$lib/utils/cn';
  import Copy from 'lucide-svelte/icons/copy';
  import Scissors from 'lucide-svelte/icons/scissors';
  import X from 'lucide-svelte/icons/x';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import { splitterState } from './splitter.state.svelte';

  const s = splitterState;
  let pending = $state(false);

  const modes: Array<{ id: SplitMode; label: string }> = [
    { id: 'chunk', label: 'Chunk' },
    { id: 'word', label: 'Word' },
    { id: 'sentence', label: 'Sentence' },
    { id: 'line', label: 'Line' },
    { id: 'pattern', label: 'Regex' },
    { id: 'token', label: 'Token' }
  ];

  const tokenizers: Array<{ id: TokenizerName; label: string }> = [
    { id: 'cl100k', label: 'cl100k (GPT-4 / 3.5)' },
    { id: 'o200k', label: 'o200k (GPT-4o)' },
    { id: 'p50k', label: 'p50k (edit)' },
    { id: 'r50k', label: 'r50k (davinci)' }
  ];

  async function run() {
    if (!s.input) {
      s.messages = [];
      return;
    }
    pending = true;
    try {
      const raw = await runSplit(s.input, s.opts);
      s.messages = applyWrapping(raw, s.startWrap, s.endWrap, s.iteratorMarker || '{n}');
    } catch (err) {
      console.error('split failed', err);
      notify.error(
        s.opts.mode === 'pattern'
          ? 'Invalid regex pattern'
          : s.opts.mode === 'token'
          ? 'Tokenizer load failed — try a different encoding'
          : 'Split failed'
      );
      s.messages = [];
    } finally {
      pending = false;
    }
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
    if (s.messages.length === 0) return;
    const joiner = s.copyAsSingleLine ? ' ' : '\n';
    copy(s.messages.join(joiner), `Copied ${s.messages.length} message${s.messages.length === 1 ? '' : 's'}`);
    sessionLog.record({
      tool: 'splitter',
      operation: s.opts.mode,
      label: `${s.messages.length} pieces`,
      input: s.input,
      output: s.messages.join('\n'),
      options: { ...s.opts, startWrap: s.startWrap, endWrap: s.endWrap }
    });
  }

  function setEncap(start: string, end: string) {
    s.startWrap = start;
    s.endWrap = end;
  }
</script>

<svelte:head><title>Splitter · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Message <span class="text-primary italic">splitter</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Chop text into copy-ready pieces by chunk, word, sentence, line, regex, or GPT token count. Optionally wrap each piece with a start/end template.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
    <!-- Input -->
    <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Input</h2>
        <button
          type="button"
          onclick={() => (s.input = '')}
          disabled={!s.input}
          class="inline-flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
        >
          <X size={11} /> Clear
        </button>
      </div>
      <textarea
        bind:value={s.input}
        rows="8"
        placeholder="Paste the text you want to split…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{s.input.length.toLocaleString()} chars</span>
        <button
          type="button"
          onclick={run}
          disabled={!s.input || pending}
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#if pending}
            <Loader size={14} class="animate-spin" />
          {:else}
            <Scissors size={14} />
          {/if}
          Split
        </button>
      </div>
    </div>

    <!-- Options -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Mode</h2>
      <div class="flex flex-wrap gap-1">
        {#each modes as m (m.id)}
          <button
            type="button"
            onclick={() => (s.opts = { ...s.opts, mode: m.id })}
            class={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              s.opts.mode === m.id ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        {/each}
      </div>

      {#if s.opts.mode === 'chunk'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Chars per chunk</span>
          <input
            type="number"
            min="1"
            max="500"
            bind:value={s.opts.chunkSize}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm"
          />
        </label>
      {:else if s.opts.mode === 'word'}
        <div class="space-y-2">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Skip (words between splits)</span>
            <input type="number" min="0" max="20" bind:value={s.opts.wordSkip}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Min word length</span>
            <input type="number" min="1" bind:value={s.opts.minWordLength}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" bind:checked={s.opts.splitFirstWord} class="h-4 w-4 rounded accent-primary" />
            Split the first word
          </label>
        </div>
      {:else if s.opts.mode === 'line'}
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" bind:checked={s.opts.preserveEmptyLines} class="h-4 w-4 rounded accent-primary" />
          Preserve empty lines
        </label>
      {:else if s.opts.mode === 'pattern'}
        <div class="space-y-2">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Regex pattern</span>
            <input type="text" bind:value={s.opts.pattern} placeholder="\\s+"
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" bind:checked={s.opts.patternIncludeDelimiter} class="h-4 w-4 rounded accent-primary" />
            Include empty matches
          </label>
        </div>
      {:else if s.opts.mode === 'token'}
        <div class="space-y-2">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Tokenizer</span>
            <select
              bind:value={s.opts.tokenizer}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm focus:border-ring focus:outline-none"
            >
              {#each tokenizers as t (t.id)}<option value={t.id}>{t.label}</option>{/each}
            </select>
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Tokens per chunk</span>
            <input type="number" min="1" max="1000" bind:value={s.opts.tokenCount}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
          </label>
        </div>
      {/if}

      <!-- Wrapping -->
      <div class="space-y-2 pt-2 border-t border-border/50">
        <h3 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Wrap each message</h3>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Start</span>
          <input type="text" bind:value={s.startWrap} placeholder={`e.g. ({n}/{total}) `}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">End</span>
          <input type="text" bind:value={s.endWrap} placeholder=""
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
        </label>
        <div class="flex flex-wrap gap-1">
          <button type="button" onclick={() => setEncap('[{n}] ', '')}
            class="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-card hover:text-foreground">[{'{n}'}]</button>
          <button type="button" onclick={() => setEncap('({n}) ', '')}
            class="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-card hover:text-foreground">({'{n}'})</button>
          <button type="button" onclick={() => setEncap('', '')}
            class="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-card hover:text-foreground">none</button>
        </div>
        <label class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <input type="checkbox" bind:checked={s.copyAsSingleLine} class="h-4 w-4 rounded accent-primary" />
          "Copy all" joins with spaces, not newlines
        </label>
      </div>
    </div>
  </div>

  <!-- Results -->
  {#if s.messages.length > 0}
    <div class="space-y-3 rounded-xl border border-border bg-card/50 p-4">
      <div class="flex items-center justify-between">
        <h2 class="flex items-center gap-1.5 font-serif text-sm">
          {s.messages.length} message{s.messages.length === 1 ? '' : 's'}
        </h2>
        <button
          type="button"
          onclick={copyAll}
          class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Copy size={11} /> Copy all
        </button>
      </div>
      <ol class="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
        {#each s.messages as msg, i (i + ':' + msg.slice(0, 20))}
          <li class="group flex items-start gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
            <span class="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5 w-6 text-right">{i + 1}</span>
            <span class="flex-1 font-mono text-sm break-all whitespace-pre-wrap">{msg}</span>
            <button
              type="button"
              onclick={() => copy(msg, `Message ${i + 1} copied`)}
              class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              aria-label="Copy message"
            >
              <Copy size={13} />
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</section>
