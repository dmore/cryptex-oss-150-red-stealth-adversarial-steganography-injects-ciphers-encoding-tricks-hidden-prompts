<script lang="ts">
  import { history } from '$lib/history/store.svelte';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Clock from 'lucide-svelte/icons/clock';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import Pin from 'lucide-svelte/icons/pin';

  type Props = {
    toolId: string;
    onReplay?: (input: string, params: Record<string, unknown>) => void;
  };
  let { toolId, onReplay }: Props = $props();

  let open = $state(false);
  const recent = $derived(history.list(toolId, 10));

  async function handleReplay(runId: string) {
    if (!onReplay) return;
    const run = recent.find((r) => r.id === runId);
    if (!run) return;
    const full = await history.getPayload(runId);
    onReplay(full?.input ?? run.inputSummary, run.params);
  }

  function statusBadge(s: 'done' | 'error' | 'cancelled'): string {
    if (s === 'done') return 'border-emerald-500/30 text-emerald-300';
    if (s === 'error') return 'border-red-500/30 text-red-300';
    return 'border-muted text-muted-foreground';
  }
</script>

<section class="rounded-xl border border-border bg-card/40">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
    aria-expanded={open}
  >
    <div class="flex items-center gap-2">
      {#if open}
        <ChevronDown size={16} class="text-muted-foreground" />
      {:else}
        <ChevronRight size={16} class="text-muted-foreground" />
      {/if}
      <Clock size={14} class="text-muted-foreground" />
      <span class="font-medium text-sm">Recent runs</span>
      <span class="text-xs text-muted-foreground">· {recent.length}</span>
    </div>
  </button>

  {#if open}
    <div class="border-t border-border/40 px-4 py-3">
      {#if recent.length === 0}
        <p class="text-xs text-muted-foreground">No runs yet for this tool.</p>
      {:else}
        <ul class="space-y-1.5">
          {#each recent as run (run.id)}
            <li
              class="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-background/40 p-2 text-xs"
            >
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center gap-1.5">
                  {#if run.pinned}<Pin size={10} class="text-amber-400" />{/if}
                  <span class="text-muted-foreground font-mono text-[10px]">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                  <span
                    class={'rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wider ' +
                      statusBadge(run.status)}>{run.status}</span
                  >
                  <span class="text-[10px] text-muted-foreground">· {run.durationMs}ms</span>
                </div>
                <div class="text-foreground line-clamp-1 break-words">
                  {run.inputSummary || '(empty)'}
                </div>
              </div>
              {#if onReplay}
                <button
                  type="button"
                  onclick={() => handleReplay(run.id)}
                  class="inline-flex flex-none items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[10px] hover:bg-muted"
                  aria-label="Replay this run"
                >
                  <RotateCcw size={10} /> Replay
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>
