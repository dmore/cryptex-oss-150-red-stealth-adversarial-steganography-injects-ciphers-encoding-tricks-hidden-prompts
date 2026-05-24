<script lang="ts">
  import { fanout, type FanoutResult, type FanoutItem } from '$lib/redteam/fanout';
  import { chat as gatewayChat, streamChat as gatewayStreamChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import { MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import Copy from 'lucide-svelte/icons/copy';
  import Plus from 'lucide-svelte/icons/plus';
  import X from 'lucide-svelte/icons/x';

  type CrossDiffData = { results: FanoutResult[]; progress: number; total: number };
  const TOOL_ID = 'cross-model-diff';

  // Persist the model list as a JSON string so multiple targets survive reload.
  const targetsPref = createPersistedState<string>(
    'cryptex.crossdiff.targets',
    JSON.stringify(['openrouter:openai/gpt-4o-mini', 'openrouter:anthropic/claude-3.5-sonnet'])
  );
  const judgePref = createPersistedState<string>('cryptex.crossdiff.judge', 'openrouter:openai/gpt-4o-mini');

  let targets = $state<string[]>(JSON.parse(targetsPref.value || '[]'));
  $effect(() => { targetsPref.value = JSON.stringify(targets); });

  // Pending model added via the picker before "Add" is clicked.
  let pendingTarget = $state<string>('openrouter:openrouter/auto');

  const prompt = useToolState<string>('cross-model-diff', 'prompt', '');

  // Run state lives in activeRuns — survives route navigation.
  const run = $derived(activeRuns.get<CrossDiffData>(TOOL_ID));
  const running = $derived(activeRuns.isRunning(TOOL_ID));
  const results = $derived(run?.data.results ?? []);
  const progress = $derived(run?.data.progress ?? 0);

  const keyConfigured = $derived(hasApiKey());

  function addTarget() {
    if (!pendingTarget.trim()) return;
    if (targets.includes(pendingTarget)) {
      notify.warn('Model already in the list');
      return;
    }
    targets = [...targets, pendingTarget];
  }

  function removeTarget(m: string) {
    targets = targets.filter((t) => t !== m);
  }

  function runDiff() {
    if (!prompt.value.trim()) {
      activeRuns.start<CrossDiffData>(TOOL_ID, { results: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'Enter a prompt to diff.');
      return;
    }
    if (prompt.value.length > MAX_INPUT_BYTES) {
      activeRuns.start<CrossDiffData>(TOOL_ID, { results: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'Input exceeds 1 MB cap. Trim the input or split into batches.');
      return;
    }
    if (targets.length === 0) {
      activeRuns.start<CrossDiffData>(TOOL_ID, { results: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'Add at least one target model.');
      return;
    }
    if (!keyConfigured) {
      activeRuns.start<CrossDiffData>(TOOL_ID, { results: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'No provider configured. Add one in Settings.');
      return;
    }

    const totalCount = targets.length;
    const r = activeRuns.start<CrossDiffData>(
      TOOL_ID,
      { results: [], progress: 0, total: totalCount },
      `0 / ${totalCount}`
    );

    const items: FanoutItem[] = targets.map((m) => ({ id: m, name: m, prompt: prompt.value }));

    void (async () => {
      try {
        await fanout({
          task: prompt.value,
          items,
          perItemTarget: (item) => item.id,
          judgeModelId: judgePref.value,
          signal: r.controller.signal,
          gateway: { chat: gatewayChat, streamChat: gatewayStreamChat },
          concurrency: totalCount,
          onResult: (res) => {
            activeRuns.update<CrossDiffData>(TOOL_ID, (d) => {
              const merged = [...d.results, res].sort((a, b) => b.judgeScore - a.judgeScore);
              return { results: merged, progress: merged.length, total: d.total };
            });
          }
        });
        activeRuns.finish(TOOL_ID, `Diffed ${totalCount} models`);
        notify.success(`Diffed ${totalCount} models`);
      } catch (err) {
        const msg = (err as Error).message ?? 'Diff failed';
        if (r.controller.signal.aborted) {
          if (activeRuns.get(TOOL_ID)?.status === 'running') activeRuns.cancel(TOOL_ID);
        } else {
          activeRuns.fail(TOOL_ID, msg);
        }
      }
    })();
  }

  function stop() {
    activeRuns.cancel(TOOL_ID);
  }

  async function copyReply(r: FanoutResult) {
    try {
      await navigator.clipboard.writeText(r.targetReply);
      notify.success('Reply copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function scoreColor(s: number): string {
    if (s >= 0.7) return 'text-emerald-400';
    if (s >= 0.4) return 'text-amber-400';
    return 'text-muted-foreground';
  }
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Cross-model diff"
  accent="diff"
  description="Same prompt, multiple targets, side-by-side responses with judge scores. Useful for comparing how different model families handle the same framing — which break, which hold, which hedge."
  usage={{
    title: 'Cross-model diff · Usage',
    bullets: [
      'Type a prompt, pick 2-4 target models from the picker.',
      'All targets run in parallel; judge scores each response.',
      'Useful for identifying which model family is softest on a given framing.',
      'Stops on cancel; results stream in as they arrive.',
      '1 MB input cap on the prompt.'
    ]
  }}
>
  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Add target model</span>
        <ModelPickerV2
          value={pendingTarget}
          onChange={(v) => (pendingTarget = v)}
          recentsKey="cryptex.crossdiff.recentTargets"
        />
        <button
          type="button"
          onclick={addTarget}
          class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {#if targets.length > 0}
        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Targets ({targets.length})</span>
          <ul class="space-y-1">
            {#each targets as t}
              <li class="flex items-center justify-between gap-2 rounded-md border border-input bg-background/70 px-2 py-1">
                <code class="truncate font-mono text-[11px] text-foreground" title={t}>{t}</code>
                <button
                  type="button"
                  onclick={() => removeTarget(t)}
                  aria-label="Remove model"
                  class="text-muted-foreground hover:text-destructive"
                >
                  <X size={12} />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Judge model</span>
        <ModelPickerV2
          value={judgePref.value}
          onChange={(v) => (judgePref.value = v)}
          recentsKey="cryptex.crossdiff.recentJudge"
        />
      </div>

      <div class="border-t border-border/40 pt-3">
        {#if running}
          <div class="mb-2 text-xs text-muted-foreground">
            <span>Progress</span>
            <span class="ml-2 font-mono text-foreground">{progress} / {targets.length}</span>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div class="h-full bg-primary transition-all" style="width: {targets.length > 0 ? (progress / targets.length) * 100 : 0}%"></div>
            </div>
          </div>
          <button
            type="button"
            onclick={stop}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Square size={14} /> Stop
          </button>
        {:else}
          <button
            type="button"
            onclick={runDiff}
            disabled={!prompt.value.trim() || targets.length === 0 || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} /> Diff
          </button>
        {/if}
      </div>

    </div>

    <!-- Right — prompt + results -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Prompt</h2>
        <textarea
          bind:value={prompt.value}
          rows="4"
          placeholder="Single prompt to send to every target…"
          disabled={running}
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Results</h2>
          <span class="font-mono text-[11px] text-muted-foreground">{results.length} / {targets.length}</span>
        </div>

        {#if results.length === 0 && !running}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Add target models, paste a prompt, click <strong class="text-foreground">Diff</strong>.
          </div>
        {:else if results.length === 0 && running}
          <div class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-xs text-muted-foreground">
            <Loader size={14} class="animate-spin" /> Streaming responses…
          </div>
        {:else}
          <div class="grid max-h-[calc(100vh-26rem)] gap-3 overflow-y-auto pr-1 cryptex-scroll md:grid-cols-2">
            {#each results as r (r.id)}
              <div class="space-y-2 rounded-lg border border-input bg-background/70 p-3">
                <div class="flex items-start justify-between gap-2">
                  <code class="truncate font-mono text-[11px] text-foreground" title={r.id}>{r.id}</code>
                  <span class={'shrink-0 font-mono text-[11px] ' + scoreColor(r.judgeScore)}>
                    {(r.judgeScore * 100).toFixed(0)}%
                  </span>
                </div>
                {#if r.error}
                  <p class="rounded border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                    error: {r.error}
                  </p>
                {:else}
                  <pre class="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground cryptex-scroll">{r.targetReply}</pre>
                  {#if r.judgeRationale}
                    <p class="text-[10px] italic text-muted-foreground">judge: {r.judgeRationale}</p>
                  {/if}
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[10px] text-muted-foreground">{r.durationMs}ms</span>
                    <button
                      type="button"
                      onclick={() => copyReply(r)}
                      class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</ToolShell>
