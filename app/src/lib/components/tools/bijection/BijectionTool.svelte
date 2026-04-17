<script lang="ts">
  import {
    generateBijectionPayloads, generateBijectionMapping, shuffleMapping,
    buildBijectionPayload,
    BIJECTION_TYPES
  } from './bijection';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Shuffle from 'lucide-svelte/icons/shuffle';
  import Download from 'lucide-svelte/icons/download';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { bijectionState } from './bijection.state.svelte';

  const s = bijectionState;

  function run() {
    s.outputs = generateBijectionPayloads(s.input, s.opts);
    if (s.outputs.length === 0) return;
    if (s.autoCopy) copy(s.outputs[0].prompt, 'First payload copied');
    notify.success(`Generated ${s.outputs.length} payload${s.outputs.length === 1 ? '' : 's'}`);
    sessionLog.record({
      tool: 'bijection',
      operation: s.opts.type,
      label: `${s.outputs.length} payloads`,
      input: s.input,
      output: s.outputs[0]?.prompt || '',
      options: { ...s.opts }
    });
  }

  function shuffleFirst() {
    if (s.outputs.length === 0) {
      notify.warn('Generate first');
      return;
    }
    const reshuffled = shuffleMapping(s.outputs[0].mapping);
    s.outputs = s.outputs.map((o) => buildBijectionPayload(s.input, s.opts.type, reshuffled, s.opts.includeExamples));
    notify.success('Mapping shuffled; prompts updated');
  }

  function regen() {
    if (!s.input.trim()) return;
    const mapping = generateBijectionMapping(s.opts.type, s.opts.fixedSize);
    s.outputs = s.outputs.map(() => buildBijectionPayload(s.input, s.opts.type, mapping, s.opts.includeExamples));
    notify.success('Fresh random mapping');
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
    copy(s.outputs.map((o) => o.prompt).join('\n\n---\n\n'), `Copied ${s.outputs.length} payloads`);
  }

  function download() {
    if (s.outputs.length === 0) return;
    const lines = s.outputs.map((o) => o.prompt).join('\n\n---\n\n');
    const header = `# Cryptex bijection payloads\n# count=${s.outputs.length}\n# type=${s.opts.type}\n# fixed_size=${s.opts.fixedSize}\n# input=${s.input.slice(0, 50)}${s.input.length > 50 ? '…' : ''}\n\n`;
    const blob = new Blob([header + lines + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bijection_payloads.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }
</script>

<svelte:head><title>Bijection · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Bijection <span class="text-primary italic">alphapr</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Generate character-to-token substitution mappings and wrap your input in a teaching prompt
      ("learn my language called alphapr"). Multiple variants per run for research-grade prompt fuzzing.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Mapping</h2>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Type</span>
        <select bind:value={s.opts.type}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm focus:border-ring focus:outline-none">
          {#each BIJECTION_TYPES as t (t.id)}
            <option value={t.id}>{t.label}</option>
          {/each}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Fixed size (leading chars un-mapped)</span>
        <input type="number" min="0" max="10" bind:value={s.opts.fixedSize}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Budget (variants, 1–50)</span>
        <input type="number" min="1" max="50" bind:value={s.opts.budget}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm" />
      </label>
      <label class="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" bind:checked={s.opts.includeExamples} class="h-4 w-4 rounded accent-primary" />
        Include example dialogue
      </label>
      <label class="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" bind:checked={s.autoCopy} class="h-4 w-4 rounded accent-primary" />
        Auto-copy first payload
      </label>

      <button
        type="button"
        onclick={run}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
      >
        <Sparkles size={14} /> Generate payloads
      </button>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={shuffleFirst}
          disabled={s.outputs.length === 0}
          class="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Shuffle size={12} /> Shuffle
        </button>
        <button
          type="button"
          onclick={regen}
          disabled={s.outputs.length === 0}
          class="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Regen
        </button>
      </div>
    </div>

    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Input</h2>
      <textarea
        bind:value={s.input}
        rows="4"
        placeholder="Message to encode with the bijection mapping…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>

      {#if s.outputs.length > 0}
        <div class="flex items-center justify-between pt-2 border-t border-border/50">
          <h3 class="font-serif text-sm">{s.outputs.length} payload{s.outputs.length === 1 ? '' : 's'}</h3>
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
              <Download size={11} /> Download .txt
            </button>
          </div>
        </div>
        <ol class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {#each s.outputs as out, i (i)}
            <li class="group rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Payload {i + 1} · {out.mappingCount} mappings · {out.type}
                </span>
                <button
                  type="button"
                  onclick={() => copy(out.prompt, `Payload ${i + 1} copied`)}
                  class="inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
              <pre class="font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{out.prompt}</pre>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>
</section>
