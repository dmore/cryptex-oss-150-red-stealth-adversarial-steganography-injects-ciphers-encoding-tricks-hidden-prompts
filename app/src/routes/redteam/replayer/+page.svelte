<script lang="ts">
  import { chat as gatewayChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import type { ChatMessage } from '$lib/ai/types';
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
  import Upload from 'lucide-svelte/icons/upload';
  import Copy from 'lucide-svelte/icons/copy';

  const targetPref = createPersistedState<string>('cryptex.replayer.target', 'openrouter:openrouter/auto');

  type ReplayTurn = {
    role: 'system' | 'user' | 'assistant';
    original: string;
    replayed?: string;
    error?: string;
    pending?: boolean;
  };

  type ReplayerData = { turns: ReplayTurn[]; progress: number; total: number };
  const TOOL_ID = 'replayer';

  const rawJson = useToolState<string>('replayer', 'rawJson', '');
  // Local "parsed but not yet replayed" turns. While a run is active or done,
  // the UI prefers activeRuns over this local copy.
  let parsedTurns = $state<ReplayTurn[]>([]);
  let parseError = $state<string>('');

  // Run state — survives route navigation.
  const run = $derived(activeRuns.get<ReplayerData>(TOOL_ID));
  const running = $derived(activeRuns.isRunning(TOOL_ID));
  const progress = $derived(run?.data.progress ?? 0);
  // Prefer the run's turns (live or completed) so navigating away + back keeps state.
  const turns = $derived(run?.data.turns ?? parsedTurns);

  const keyConfigured = $derived(hasApiKey());

  function parseInput() {
    parseError = '';
    if (!rawJson.value.trim()) {
      parsedTurns = [];
      return;
    }
    try {
      const parsed = JSON.parse(rawJson.value);
      const newTurns: ReplayTurn[] = [];

      // Try ShareGPT shape: { conversations: [{ from, value }, ...] } OR an array of those.
      const conversations: Array<{ from: string; value: string }> = (() => {
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].conversations)) {
          // Multi-conversation export — flatten the FIRST conversation only
          // (replayer is per-conversation).
          return parsed[0].conversations as Array<{ from: string; value: string }>;
        }
        if (parsed.conversations && Array.isArray(parsed.conversations)) {
          return parsed.conversations as Array<{ from: string; value: string }>;
        }
        if (Array.isArray(parsed)) {
          // Fallback: array of {role, content} OR {from, value}
          return parsed.map((m) => {
            if ('from' in m && 'value' in m) return m as { from: string; value: string };
            if ('role' in m && 'content' in m) {
              const role = (m as { role: string }).role;
              return {
                from: role === 'user' ? 'human' : role === 'assistant' ? 'gpt' : role,
                value: (m as { content: string }).content
              };
            }
            return { from: 'human', value: JSON.stringify(m) };
          });
        }
        throw new Error('Unrecognized shape — expected ShareGPT conversation or messages array.');
      })();

      for (const c of conversations) {
        const role = c.from === 'human' ? 'user' : c.from === 'gpt' ? 'assistant' : 'system';
        newTurns.push({ role: role as 'user' | 'assistant' | 'system', original: c.value });
      }
      parsedTurns = newTurns;
    } catch (e) {
      parseError = (e as Error).message;
      parsedTurns = [];
    }
  }

  $effect(() => {
    void rawJson.value;
    parseInput();
    // If the user edits raw JSON after a previous run, drop the stale run
    // so the parsed turns become the displayed ones.
    if (activeRuns.get(TOOL_ID) && !activeRuns.isRunning(TOOL_ID)) {
      activeRuns.clear(TOOL_ID);
    }
  });

  async function loadFromFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    rawJson.value = await file.text();
    input.value = '';
  }

  function replay() {
    if (parsedTurns.length === 0) {
      activeRuns.start<ReplayerData>(TOOL_ID, { turns: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'No turns to replay. Paste a ShareGPT JSON or messages array.');
      return;
    }
    if (rawJson.value.length > MAX_INPUT_BYTES) {
      activeRuns.start<ReplayerData>(TOOL_ID, { turns: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'Input exceeds 1 MB cap. Trim the transcript or split into batches.');
      return;
    }
    if (!keyConfigured) {
      activeRuns.start<ReplayerData>(TOOL_ID, { turns: [], progress: 0, total: 0 });
      activeRuns.fail(TOOL_ID, 'No provider configured. Add one in Settings.');
      return;
    }

    // Snapshot the parsed turns into the run's data — fresh copies so we
    // can mutate replayed/error/pending without leaking back to parsedTurns.
    const initialTurns: ReplayTurn[] = parsedTurns.map((t) => ({
      ...t,
      replayed: undefined,
      error: undefined,
      pending: false
    }));
    const totalCount = initialTurns.length;
    const r = activeRuns.start<ReplayerData>(
      TOOL_ID,
      { turns: initialTurns, progress: 0, total: totalCount },
      `0 / ${totalCount}`
    );

    void (async () => {
      const history: ChatMessage[] = [];
      // Work on a local copy of turns; push into activeRuns after each mutation.
      const working: ReplayTurn[] = [...initialTurns];
      try {
        for (let i = 0; i < working.length; i++) {
          if (r.controller.signal.aborted) break;
          const t = working[i];
          if (t.role !== 'assistant') {
            history.push({ role: t.role, content: t.original });
            activeRuns.update<ReplayerData>(TOOL_ID, (d) => ({
              turns: [...working],
              progress: i + 1,
              total: d.total
            }));
            continue;
          }
          working[i] = { ...t, pending: true };
          activeRuns.update<ReplayerData>(TOOL_ID, (d) => ({
            turns: [...working],
            progress: d.progress,
            total: d.total
          }));
          try {
            const res = await gatewayChat({
              model: targetPref.value,
              messages: history,
              signal: r.controller.signal
            });
            working[i] = { ...t, replayed: res.content, pending: false };
            history.push({ role: 'assistant', content: res.content });
          } catch (err) {
            if (r.controller.signal.aborted) {
              break;
            }
            working[i] = {
              ...t,
              replayed: undefined,
              pending: false,
              error: (err as Error).message ?? 'replay failed'
            };
            // Keep the original assistant turn in history so subsequent turns
            // still see the conversation arc the original had.
            history.push({ role: 'assistant', content: t.original });
          }
          activeRuns.update<ReplayerData>(TOOL_ID, (d) => ({
            turns: [...working],
            progress: i + 1,
            total: d.total
          }));
        }
        if (r.controller.signal.aborted) {
          if (activeRuns.get(TOOL_ID)?.status === 'running') activeRuns.cancel(TOOL_ID);
        } else {
          const replayedCount = working.filter((t) => t.role === 'assistant').length;
          activeRuns.finish(TOOL_ID, `Replayed ${replayedCount} assistant turns`);
          notify.success(`Replayed ${replayedCount} assistant turns`);
        }
      } catch (err) {
        const msg = (err as Error).message ?? 'Replay failed';
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

  async function copyReplayed(t: ReplayTurn) {
    if (!t.replayed) return;
    try {
      await navigator.clipboard.writeText(t.replayed);
      notify.success('Replayed reply copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  const assistantTurnCount = $derived(turns.filter((t) => t.role === 'assistant').length);
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Conversation replayer"
  accent="replayer"
  description="Load a ShareGPT JSON transcript (or any role/content array), replay each assistant turn against a different target model, see the original alongside the replayed response. Useful for re-running known-working chains against new model versions."
  usage={{
    title: 'Conversation replayer · Usage',
    bullets: [
      'Load a ShareGPT JSON transcript (or any role/content array).',
      'Pick a different target model; each assistant turn gets replayed.',
      'Original vs replayed shown side-by-side per turn.',
      'Detects regressions when a known-working chain breaks on a new model version.',
      '1 MB cap on the transcript JSON.'
    ]
  }}
>
  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Target model</span>
        <ModelPickerV2
          value={targetPref.value}
          onChange={(v) => (targetPref.value = v)}
          recentsKey="cryptex.replayer.recentTargets"
        />
      </div>

      <label class="block">
        <input
          type="file"
          accept=".json,.txt,application/json"
          onchange={loadFromFile}
          class="hidden"
        />
        <span class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          <Upload size={12} /> Load JSON file
        </span>
      </label>

      <div class="border-t border-border/40 pt-3">
        <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Assistant turns</span>
          <span class="font-mono text-foreground">{assistantTurnCount}</span>
        </div>
        {#if running}
          <div class="mb-2 text-xs text-muted-foreground">
            <span>Progress</span>
            <span class="ml-2 font-mono text-foreground">{progress} / {turns.length}</span>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div class="h-full bg-primary transition-all" style="width: {turns.length > 0 ? (progress / turns.length) * 100 : 0}%"></div>
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
            onclick={replay}
            disabled={turns.length === 0 || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} /> Replay
          </button>
        {/if}
      </div>

      {#if parseError}
        <p class="text-xs text-destructive">parse: {parseError}</p>
      {/if}
    </div>

    <!-- Right — JSON editor + diff list -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Transcript JSON</h2>
        <textarea
          bind:value={rawJson.value}
          rows="6"
          placeholder={`Paste ShareGPT-shaped JSON, e.g.\n{ "conversations": [\n  { "from": "human", "value": "..." },\n  { "from": "gpt", "value": "..." }\n]}`}
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-xs focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      {#if turns.length > 0}
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Turn-by-turn diff</h2>
            <span class="font-mono text-[11px] text-muted-foreground">{turns.length} turns</span>
          </div>

          <ul class="flex max-h-[calc(100vh-30rem)] flex-col gap-2 overflow-y-auto pr-1 cryptex-scroll">
            {#each turns as t, i}
              <li class="rounded-lg border border-input bg-background/70 p-3">
                <div class="mb-2 flex items-center gap-2">
                  <span class="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                  <span class={'rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' +
                    (t.role === 'user'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : t.role === 'assistant'
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                      : 'border-border bg-card/60 text-muted-foreground')}
                  >
                    {t.role}
                  </span>
                  {#if t.pending}
                    <Loader size={11} class="animate-spin text-muted-foreground" />
                  {/if}
                </div>

                {#if t.role !== 'assistant'}
                  <pre class="whitespace-pre-wrap break-words rounded border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground">{t.original}</pre>
                {:else}
                  <div class="grid gap-2 md:grid-cols-2">
                    <div class="space-y-1">
                      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Original</div>
                      <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground cryptex-scroll">{t.original}</pre>
                    </div>
                    <div class="space-y-1">
                      <div class="flex items-center justify-between">
                        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Replayed</div>
                        {#if t.replayed}
                          <button
                            type="button"
                            onclick={() => copyReplayed(t)}
                            class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Copy size={10} />
                          </button>
                        {/if}
                      </div>
                      {#if t.error}
                        <pre class="rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[11px] text-destructive">error: {t.error}</pre>
                      {:else if t.replayed}
                        <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded border border-emerald-500/30 bg-emerald-500/5 p-2 font-mono text-[11px] leading-relaxed text-foreground cryptex-scroll">{t.replayed}</pre>
                      {:else}
                        <div class="rounded border border-dashed border-border/40 bg-background/20 p-2 text-[11px] italic text-muted-foreground">
                          {t.pending ? 'Streaming…' : 'Not yet replayed'}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</ToolShell>
