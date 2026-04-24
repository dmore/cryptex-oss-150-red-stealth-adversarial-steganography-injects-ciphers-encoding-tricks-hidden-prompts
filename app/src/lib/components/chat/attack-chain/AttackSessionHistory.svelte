<script lang="ts">
  import type { AttackSessionRow } from '$lib/chat/types';
  import History from 'lucide-svelte/icons/history';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    sessions: AttackSessionRow[];
    onPromote: (session: AttackSessionRow) => void;
    onDelete: (id: string) => void;
  };
  let { sessions, onPromote, onDelete }: Props = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    expanded = next;
  }

  function outcomeClass(outcome: AttackSessionRow['finalOutcome']): string {
    return outcome === 'extracted' ? 'bg-green-500/20 text-green-400'
      : outcome === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
      : outcome === 'abandoned' ? 'bg-orange-500/20 text-orange-400'
      : 'bg-muted/40 text-muted-foreground';
  }

  function preview(s: string): string {
    const t = s.trim();
    return t.length <= 60 ? t : t.slice(0, 60) + '…';
  }

  function rel(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<details class="group rounded-md border border-border/40 bg-background/40 text-xs" open>
  <summary class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
    <ChevronRight size={11} class="transition-transform group-open:rotate-90" />
    <History size={11} />
    <span>Sessions</span>
    <span class="ml-auto text-[10px]">{sessions.length === 0 ? 'none' : `${sessions.length}`}</span>
  </summary>
  <div class="flex flex-col gap-1 border-t border-border/40 px-2 py-2">
    {#if sessions.length === 0}
      <p class="px-2 py-3 text-center text-[11px] text-muted-foreground">No sessions yet.</p>
    {:else}
      {#each sessions as row (row.id)}
        <div class="rounded border border-border/40 bg-background/30">
          <div class="flex items-center gap-2 px-2 py-1.5">
            <button type="button" onclick={() => toggle(row.id)} aria-expanded={expanded.has(row.id)} class="text-muted-foreground hover:text-foreground">
              <ChevronRight size={10} class={expanded.has(row.id) ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
            <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + outcomeClass(row.finalOutcome)}>{row.finalOutcome ?? 'in progress'}</span>
            <span class="truncate text-[11px]">{preview(row.objective)}</span>
            <span class="ml-auto text-[10px] text-muted-foreground">{rel(row.createdAt)}</span>
            <button type="button" onclick={() => onPromote(row)} aria-label="Promote to main chat" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ArrowRight size={11} />
            </button>
            <button type="button" onclick={() => onDelete(row.id)} aria-label="Delete session" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-destructive">
              <Trash2 size={11} />
            </button>
          </div>
          {#if expanded.has(row.id)}
            <div class="border-t border-border/40 px-2 py-1.5 text-[10px] text-muted-foreground">
              {row.turns.length} turns · {row.strategyLog.length} actions · conf {row.finalConfidence?.toFixed(2) ?? '—'}
              {#if row.finalSummary}
                <div class="mt-1 line-clamp-3 text-[11px] text-foreground">{row.finalSummary}</div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</details>
