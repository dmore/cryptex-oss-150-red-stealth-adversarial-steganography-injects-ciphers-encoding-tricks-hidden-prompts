<script lang="ts">
  import { applyTechniqueForVariant, listPromptCraftTechniques } from './strategies';
  import { tuneParams } from '$lib/ai/prompt-scaffold';
  import { chat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { GatewayError as OpenRouterError } from '$lib/ai/types';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import { Combobox } from '$lib/components/ui/combobox';
  import type { ComboboxOption } from '$lib/components/ui/combobox';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Copy from 'lucide-svelte/icons/copy';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { promptcraftState } from './promptcraft.state.svelte';
  import ErrorBanner from '$lib/components/ai/ErrorBanner.svelte';
  import { GatewayError } from '$lib/ai/types';

  // All eligible techniques (mutators + composites) keyed to Combobox options.
  const techniques = listPromptCraftTechniques();
  const techniqueOptions: ComboboxOption[] = techniques.map((t) => ({
    id: t.id,
    label: t.name,
    description: t.desc,
    group: t.group
  }));

  const modelPref = createPersistedState<string>('cryptex.pc.model', 'openrouter:openrouter/auto');

  $effect(() => {
    if (modelPref.value && !modelPref.value.includes(':')) modelPref.value = `openrouter:${modelPref.value}`;
  });
  const tempPref = createPersistedState<number>('cryptex.pc.temperature', 0.9);

  const s = promptcraftState;
  let loading = $state(false);
  let errorMsg = $state('');
  let lastError = $state<GatewayError | null>(null);

  const keyConfigured = $derived(hasApiKey());

  async function run() {
    if (!keyConfigured) {
      errorMsg = 'No provider configured. Add one in Settings to unlock this tool.';
      return;
    }
    if (!s.input.trim()) {
      errorMsg = 'Enter a prompt to mutate.';
      return;
    }

    errorMsg = '';
    lastError = null;
    loading = true;
    // applyTechniqueForVariant correctly handles both LLM-generative and
    // local-template techniques. For local-template picks, it applies the
    // template locally then sends only a variation-only system prompt so
    // PromptCraft can generate variance without forcing the meta-LLM to
    // re-evaluate template content from scratch.
    const { system, user } = applyTechniqueForVariant(s.strategy, s.input, s.customInstruction);
    const n = Math.max(1, Math.min(10, s.count));

    // NOTE: reasoning_effort / thinking_level from tuneParams are not yet threaded through
    // ChatRequest — future gateway widening will add those knobs. temperature-only for now.
    const { temperature } = tuneParams(modelPref.value, 'mutate');
    const runs = Array.from({ length: n }, () =>
      chat({
        model: modelPref.value,
        temperature: temperature ?? tempPref.value,
        max_tokens: 2048,
        title: `Cryptex/PromptCraft/${s.strategy}-v2`,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user }
        ]
      })
    );

    const results = await Promise.allSettled(runs);
    const fulfilled: string[] = [];
    let lastErrMsg = '';
    let lastGwError: GatewayError | null = null;
    for (const r of results) {
      if (r.status === 'fulfilled') fulfilled.push(r.value.content);
      else if (r.reason instanceof GatewayError) { lastGwError = r.reason; lastErrMsg = r.reason.message; }
      else if (r.reason instanceof OpenRouterError) { lastErrMsg = r.reason.message; }
      else if (r.reason instanceof Error) lastErrMsg = r.reason.message;
    }

    loading = false;

    if (fulfilled.length === 0) {
      // Preserve previous outputs — don't wipe them on a transient failure
      lastError = lastGwError;
      errorMsg = lastGwError ? '' : (lastErrMsg || 'All variants failed. Check your model or try again.');
      if (!lastGwError) notify.error(errorMsg);
    } else {
      s.outputs = fulfilled;
      if (fulfilled.length < n) notify.warn(`${fulfilled.length}/${n} variants succeeded`);
      else notify.success(`Generated ${fulfilled.length} variants`);
      sessionLog.record({
        tool: 'promptcraft',
        operation: s.strategy,
        label: `${fulfilled.length} variants`,
        input: s.input,
        output: fulfilled.join('\n\n---\n\n'),
        options: { model: modelPref.value, temperature: tempPref.value, count: n }
      });
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

  function useAsInput(text: string) {
    s.input = text;
    notify.info('Pulled variant into input — mutate again');
  }
</script>

<svelte:head><title>PromptCraft · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      PromptCraft
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      The full registry of mutator and composite techniques, searchable. Generate multiple
      variants in parallel with adjustable temperature. Requires a configured provider.
    </p>
  </header>

  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Strategies + Model -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Technique</h2>
      <Combobox
        value={s.strategy}
        options={techniqueOptions}
        placeholder="Search techniques..."
        onChange={(id) => (s.strategy = id)}
      />

      {#if s.strategy === 'custom'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Your custom instruction</span>
          <textarea
            bind:value={s.customInstruction}
            rows="3"
            placeholder="System prompt for the mutation model…"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 font-mono text-xs"
          ></textarea>
        </label>
      {/if}

      <div class="space-y-2 pt-2 border-t border-border/50">
        <ModelPickerV2
          value={modelPref.value}
          onChange={(v) => (modelPref.value = v)}
          recentsKey="cryptex.pc.recentModels"
        />

        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Temperature: {tempPref.value.toFixed(2)}</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={tempPref.value}
            oninput={(e) => (tempPref.value = Number((e.currentTarget as HTMLInputElement).value))}
            class="w-full accent-primary"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Variants (1–10)</span>
          <input
            type="number"
            min="1"
            max="10"
            bind:value={s.count}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onclick={run}
        disabled={loading || !keyConfigured}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if loading}
          <Loader size={14} class="animate-spin" /> Mutating…
        {:else}
          <Sparkles size={14} /> Mutate
        {/if}
      </button>

      {#if lastError}
        <ErrorBanner
          error={lastError}
          onRetry={() => run()}
          onOpenSettings={() => {
            const frag = lastError?.provider === 'openai-compat' ? 'providers' : `provider-${lastError?.provider}`;
            goto(`/settings#${frag}`);
          }}
        />
      {:else if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}
    </div>

    <!-- Input + outputs -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Prompt to mutate</h2>
      <textarea
        bind:value={s.input}
        rows="5"
        placeholder="Paste the prompt you want to re-frame, obfuscate, or role-play wrap…"
        class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ></textarea>

      {#if s.outputs.length > 0}
        <div class="flex items-center justify-between pt-2 border-t border-border/50">
          <h3 class="font-serif text-sm">{s.outputs.length} variants</h3>
          <button
            type="button"
            onclick={() => copy(s.outputs.join('\n\n---\n\n'), `Copied ${s.outputs.length} variants`)}
            class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Copy size={11} /> Copy all
          </button>
        </div>
        <ol class="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {#each s.outputs as out, i (i)}
            <li class="group rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Variant {i + 1}
                </span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onclick={() => copy(out, `Variant ${i + 1} copied`)}
                    class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy size={11} /> Copy
                  </button>
                  <button
                    type="button"
                    onclick={() => useAsInput(out)}
                    class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUp size={11} /> Use as input
                  </button>
                </div>
              </div>
              <pre class="font-mono text-[12px] whitespace-pre-wrap break-words">{out}</pre>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>
</section>
