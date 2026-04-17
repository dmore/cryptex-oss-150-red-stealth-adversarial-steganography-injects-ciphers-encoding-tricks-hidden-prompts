<script lang="ts">
  import { universalDecode } from '$lib/transformers/decoder';
  import type { DecodeResult } from '$lib/transformers/decoder';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { cn } from '$lib/utils/cn';
  import Copy from 'lucide-svelte/icons/copy';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import X from 'lucide-svelte/icons/x';
  import Loader2 from 'lucide-svelte/icons/loader-circle';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { decodeState } from './decode.state.svelte';

  const s = decodeState;
  let result = $state<DecodeResult | null>(null);
  let pending = $state(false);
  let selectedAltIdx = $state<number | null>(null);

  // Debounce decode by 180ms so heavy brute-scan doesn't fire per keystroke
  let timer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    // track input
    const snapshot = s.input;
    if (timer) clearTimeout(timer);

    if (!snapshot) {
      result = null;
      pending = false;
      selectedAltIdx = null;
      return;
    }

    pending = true;
    timer = setTimeout(() => {
      try {
        result = universalDecode(snapshot);
        selectedAltIdx = null;
      } catch (err) {
        console.error('decoder failed', err);
        result = null;
      } finally {
        pending = false;
      }
    }, 180);
  });

  const displayedResult = $derived(() => {
    if (!result) return null;
    if (selectedAltIdx !== null && result.alternatives[selectedAltIdx]) {
      const alt = result.alternatives[selectedAltIdx];
      return { text: alt.text, method: alt.method };
    }
    return { text: result.text, method: result.method };
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      sessionLog.record({
        tool: 'decode',
        operation: 'decode',
        label: displayedResult()?.method,
        input: s.input,
        output: text
      });
      notify.success('Decoded text copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function useResult() {
    const d = displayedResult();
    if (!d) return;
    s.input = d.text;
    notify.info('Promoted to input — decode again');
  }
</script>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Universal <span class="text-primary italic">decoder</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Paste any suspicious-looking text — ciphertext, Base64, binary, Unicode-abused strings,
      emoji steganography. The decoder runs every transformer's detector, ranks candidates by
      priority, and surfaces alternatives.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-2">
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
        rows="10"
        placeholder="Paste encoded text to decode…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{s.input.length.toLocaleString()} chars</span>
        {#if pending}
          <span class="inline-flex items-center gap-1">
            <Loader2 size={11} class="animate-spin" /> Decoding…
          </span>
        {/if}
      </div>
    </div>

    <!-- Result -->
    <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-sm">Result</h2>
        {#if displayedResult()}
          <div class="flex items-center gap-1.5">
            <span class="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              {displayedResult()!.method}
            </span>
            <button
              type="button"
              onclick={() => copy(displayedResult()!.text)}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Copy size={11} /> Copy
            </button>
            <button
              type="button"
              onclick={useResult}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Use result as the new input"
            >
              <RefreshCw size={11} /> Re-decode
            </button>
          </div>
        {/if}
      </div>
      <textarea
        readonly
        value={displayedResult()?.text ?? ''}
        rows="10"
        placeholder={s.input ? (pending ? 'Decoding…' : 'No decode candidate found.') : 'Decoded output appears here.'}
        class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
      ></textarea>
      <div class="text-xs text-muted-foreground">
        {#if displayedResult()}
          {displayedResult()!.text.length.toLocaleString()} chars decoded
        {:else if s.input && !pending}
          No viable decode — try a known format via the <a class="text-primary underline" href="./transforms">Transform</a> tab.
        {:else}
          &nbsp;
        {/if}
      </div>
    </div>
  </div>

  <!-- Alternatives -->
  {#if result && result.alternatives.length > 0}
    <div class="space-y-2 rounded-xl border border-border bg-card/40 p-4">
      <h3 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles size={11} class="text-accent" />
        Alternatives ({result.alternatives.length})
      </h3>
      <ol class="space-y-1 max-h-64 overflow-y-auto pr-1">
        <!-- Primary as pseudo-item zero so the user can toggle back -->
        <li>
          <button
            type="button"
            onclick={() => (selectedAltIdx = null)}
            class={cn(
              'w-full flex items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
              selectedAltIdx === null
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/50 bg-background/40 hover:border-primary/30'
            )}
          >
            <span class="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
              primary
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-xs text-muted-foreground">{result.method}</span>
              <span class="block font-mono text-sm truncate">{result.text}</span>
            </span>
          </button>
        </li>
        {#each result.alternatives as alt, i (i + ':' + alt.method)}
          <li>
            <button
              type="button"
              onclick={() => (selectedAltIdx = i)}
              class={cn(
                'w-full flex items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                selectedAltIdx === i
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/50 bg-background/40 hover:border-primary/30'
              )}
            >
              <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                alt {i + 1}
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-xs text-muted-foreground">{alt.method}</span>
                <span class="block font-mono text-sm truncate">{alt.text}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</section>
