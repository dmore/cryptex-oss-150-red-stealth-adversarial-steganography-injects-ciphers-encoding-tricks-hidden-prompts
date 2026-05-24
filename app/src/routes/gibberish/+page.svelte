<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import {
    sentenceToGibberish,
    generateRandomRemovals,
    removeSpecificChars
  } from '$lib/components/tools/gibberish/gibberish';
  import { gibberishState } from '$lib/components/tools/gibberish/gibberish.state.svelte';
  import { MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import { errorLogger } from '$lib/errors/logger';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Shuffle from 'lucide-svelte/icons/shuffle';
  import Scissors from 'lucide-svelte/icons/scissors';
  import BookOpen from 'lucide-svelte/icons/book-open';

  const s = gibberishState;

  function checkSize(text: string): boolean {
    if (text.length > MAX_INPUT_BYTES) {
      errorLogger.report(
        new Error('Input exceeds 1 MB cap. Trim the input or split into batches.'),
        { toastMessage: 'Input exceeds 1 MB cap. Trim the input or split into batches.' }
      );
      return false;
    }
    return true;
  }

  function runDictionary() {
    if (!checkSize(s.gibberishInput)) return;
    const result = sentenceToGibberish(s.gibberishInput, s.gibberishSeed, s.gibberishChars);
    s.gibberishOutput = result.output;
    s.gibberishDictionary = result.dictionary;
    if (result.output) {
      notify.success('Gibberish generated');
      sessionLog.record({
        tool: 'gibberish',
        operation: 'dictionary',
        input: s.gibberishInput,
        output: s.gibberishOutput,
        options: { seed: s.gibberishSeed, chars: s.gibberishChars, dictionary: s.gibberishDictionary }
      });
    }
  }

  function runRandomRemoval() {
    if (!s.removalInput.trim()) {
      notify.error('Please enter text to process');
      return;
    }
    if (!checkSize(s.removalInput)) return;
    s.removalOutputs = generateRandomRemovals(s.removalInput, {
      variations: s.removalVariations,
      minLetters: s.removalMinLetters,
      maxLetters: s.removalMaxLetters,
      seed: s.removalSeed
    });
    notify.success(`Generated ${s.removalOutputs.length} variations`);
    sessionLog.record({
      tool: 'gibberish',
      operation: 'random-removal',
      input: s.removalInput,
      output: s.removalOutputs.join('\n'),
      options: {
        variations: s.removalVariations,
        minLetters: s.removalMinLetters,
        maxLetters: s.removalMaxLetters,
        seed: s.removalSeed
      }
    });
  }

  function runSpecificRemoval() {
    if (!s.removalSpecificInput.trim()) {
      notify.error('Please enter text to process');
      return;
    }
    if (!s.removalCharsToRemove) {
      notify.error('Please specify characters to remove');
      return;
    }
    if (!checkSize(s.removalSpecificInput)) return;
    s.removalSpecificOutput = removeSpecificChars(s.removalSpecificInput, s.removalCharsToRemove);
    notify.success('Characters removed');
    sessionLog.record({
      tool: 'gibberish',
      operation: 'specific-removal',
      input: s.removalSpecificInput,
      output: s.removalSpecificOutput,
      options: { charsToRemove: s.removalCharsToRemove }
    });
  }

  async function copy(text: string, label = 'Copied') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.success(label);
    } catch {
      notify.error('Copy failed');
    }
  }

  function copyAllRemovals() {
    if (s.removalOutputs.length === 0) return;
    copy(s.removalOutputs.join('\n'), `Copied ${s.removalOutputs.length} variations`);
  }
</script>

<ToolShell
  toolId="gibberish"
  title="Gibberish lab"
  accent="lab"
  description="Generate consistent dictionary-mapped gibberish, or strip characters from text to produce puzzle variants. Seeded for reproducibility, deterministic across runs."
  usage={{
    title: 'Gibberish lab · Usage',
    bullets: [
      'Dictionary mode → consistent char→token substitution.',
      'Removal mode → strips chars to produce puzzle variants.',
      'Seed makes runs reproducible across sessions.',
      'Useful for low-resource bypass and CTF-style puzzles.',
      '1 MB input cap per run.'
    ]
  }}
>
  <!-- Top-level mode switch: dictionary vs removal -->
  <div class="inline-flex gap-1 rounded-lg border border-border bg-card/40 p-1">
    <button
      type="button"
      onclick={() => (s.topMode = 'dictionary')}
      class={cn(
        'inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
        s.topMode === 'dictionary'
          ? 'bg-primary text-primary-foreground shadow-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <BookOpen size={14} />
      Dictionary
    </button>
    <button
      type="button"
      onclick={() => (s.topMode = 'removal')}
      class={cn(
        'inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
        s.topMode === 'removal'
          ? 'bg-primary text-primary-foreground shadow-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Scissors size={14} />
      Removal
    </button>
  </div>

  {#if s.topMode === 'dictionary'}
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
        <h2 class="font-serif text-lg">Input</h2>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-muted-foreground">Text to encode</span>
          <textarea
            bind:value={s.gibberishInput}
            rows="6"
            placeholder="Type any sentence — each word maps to a consistent gibberish replacement."
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm shadow-sm transition-colors focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-muted-foreground">Seed (optional)</span>
            <input
              bind:value={s.gibberishSeed}
              type="text"
              placeholder="empty = random"
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm shadow-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-muted-foreground">Character set</span>
            <input
              bind:value={s.gibberishChars}
              type="text"
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm shadow-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        <button
          type="button"
          onclick={runDictionary}
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Shuffle size={16} />
          Generate
        </button>
      </div>

      <div class="space-y-4 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-lg">Output</h2>
          <button
            type="button"
            disabled={!s.gibberishOutput}
            onclick={() => copy(s.gibberishOutput, 'Output copied')}
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <textarea
          readonly
          value={s.gibberishOutput}
          rows="6"
          placeholder="Gibberish output will appear here."
          class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
        ></textarea>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground">Dictionary mapping</span>
            <button
              type="button"
              disabled={!s.gibberishDictionary}
              onclick={() => copy(s.gibberishDictionary, 'Dictionary copied')}
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <textarea
            readonly
            value={s.gibberishDictionary}
            rows="3"
            placeholder="plaintext → gibberish map"
            class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-xs"
          ></textarea>
        </div>
      </div>
    </div>
  {:else}
    <div class="inline-flex gap-1 rounded-md border border-border bg-card/40 p-1">
      <button
        type="button"
        onclick={() => (s.removalMode = 'random')}
        class={cn(
          'rounded px-3 py-1.5 text-xs font-medium transition-colors',
          s.removalMode === 'random'
            ? 'bg-primary text-primary-foreground shadow-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        Random removal
      </button>
      <button
        type="button"
        onclick={() => (s.removalMode = 'specific')}
        class={cn(
          'rounded px-3 py-1.5 text-xs font-medium transition-colors',
          s.removalMode === 'specific'
            ? 'bg-primary text-primary-foreground shadow-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        Specific characters
      </button>
    </div>

    {#if s.removalMode === 'random'}
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
          <h2 class="font-serif text-lg">Input</h2>
          <textarea
            bind:value={s.removalInput}
            rows="5"
            placeholder="Text to strip letters from"
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-muted-foreground">Variations</span>
              <input
                type="number"
                min="1"
                max="100"
                bind:value={s.removalVariations}
                class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-muted-foreground">Seed (optional)</span>
              <input
                type="text"
                bind:value={s.removalSeed}
                placeholder="deterministic runs"
                class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-muted-foreground">Min letters to strip</span>
              <input
                type="number"
                min="0"
                bind:value={s.removalMinLetters}
                class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-muted-foreground">Max letters to strip</span>
              <input
                type="number"
                min="0"
                bind:value={s.removalMaxLetters}
                class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            onclick={runRandomRemoval}
            class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
          >
            <Scissors size={16} /> Generate variations
          </button>
        </div>

        <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-lg">Variations ({s.removalOutputs.length})</h2>
            <button
              type="button"
              disabled={s.removalOutputs.length === 0}
              onclick={copyAllRemovals}
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={12} /> Copy all
            </button>
          </div>

          {#if s.removalOutputs.length === 0}
            <p class="py-12 text-center text-sm text-muted-foreground">
              Variations will appear here after you generate.
            </p>
          {:else}
            <ol class="space-y-1.5 max-h-[380px] overflow-y-auto cryptex-scroll pr-1">
              {#each s.removalOutputs as line, i}
                <li class="group flex items-start gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
                  <span class="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5">{i + 1}.</span>
                  <span class="flex-1 font-mono text-sm break-all">{line}</span>
                  <button
                    type="button"
                    onclick={() => copy(line, 'Variation copied')}
                    class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                    aria-label="Copy variation"
                  >
                    <Copy size={14} />
                  </button>
                </li>
              {/each}
            </ol>
          {/if}
        </div>
      </div>
    {:else}
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
          <h2 class="font-serif text-lg">Input</h2>
          <textarea
            bind:value={s.removalSpecificInput}
            rows="5"
            placeholder="Text to filter"
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-muted-foreground">Characters to remove</span>
            <input
              type="text"
              bind:value={s.removalCharsToRemove}
              placeholder="e.g. aeiou"
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm"
            />
          </label>

          <button
            type="button"
            onclick={runSpecificRemoval}
            class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
          >
            <Scissors size={16} /> Remove
          </button>
        </div>

        <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-lg">Output</h2>
            <button
              type="button"
              disabled={!s.removalSpecificOutput}
              onclick={() => copy(s.removalSpecificOutput, 'Output copied')}
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <textarea
            readonly
            value={s.removalSpecificOutput}
            rows="10"
            placeholder="Filtered output"
            class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
          ></textarea>
        </div>
      </div>
    {/if}
  {/if}
</ToolShell>
