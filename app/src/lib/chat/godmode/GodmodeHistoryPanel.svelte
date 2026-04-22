<script lang="ts">
  import type { GodmodeRunRow, GodmodeCandidateRecord } from '$lib/chat/types';
  import History from 'lucide-svelte/icons/history';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    runs: GodmodeRunRow[];
    onPromote: (row: GodmodeRunRow, record: GodmodeCandidateRecord) => void;
    onDelete: (id: string) => void;
  };
  let { runs, onPromote, onDelete }: Props = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    expanded = next;
  }

  function relativeTime(ts: number): string {
    const delta = Math.max(0, Date.now() - ts);
    const s = Math.floor(delta / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function tierClass(tier: string): string {
    return tier === 'refusal' ? 'bg-red-500/20 text-red-400'
      : tier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
      : tier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
      : tier === 'substantive' ? 'bg-green-500/20 text-green-400'
      : tier === 'compliant' ? 'bg-emerald-500/30 text-emerald-300'
      : 'bg-muted/40 text-muted-foreground';
  }

  function preview(s: string): string {
    const t = s.trim();
    return t.length <= 60 ? t : t.slice(0, 60) + '…';
  }
</script>

<details class="group rounded-md border border-border/40 bg-background/40 text-xs" open>
  <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
    <ChevronRight size={11} class="transition-transform group-open:rotate-90" />
    <History size={11} />
    <span>History</span>
    <span class="ml-auto text-[10px] text-muted-foreground">
      {runs.length === 0 ? 'none' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
    </span>
  </summary>

  <div class="flex flex-col gap-1 border-t border-border/40 px-2 py-2">
    {#if runs.length === 0}
      <p class="px-2 py-3 text-center text-[11px] text-muted-foreground">No runs yet for this chat.</p>
    {:else}
      {#each runs as row (row.id)}
        <div class="rounded border border-border/40 bg-background/30">
          <div class="flex items-center gap-2 px-2 py-1.5">
            <button
              type="button"
              onclick={() => toggle(row.id)}
              class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              aria-expanded={expanded.has(row.id)}
            >
              <ChevronRight size={10} class={expanded.has(row.id) ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
            <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass(row.winner.tier)}>{row.winner.tier}</span>
            <span class="truncate text-[11px]">{preview(row.task)}</span>
            <span class="ml-auto text-[10px] text-muted-foreground">{relativeTime(row.createdAt)}</span>
            <button type="button" onclick={() => onPromote(row, row.winner)} aria-label="Send winner to main chat" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ArrowRight size={11} />
            </button>
            <button type="button" onclick={() => onDelete(row.id)} aria-label="Delete run" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-destructive">
              <Trash2 size={11} />
            </button>
          </div>

          {#if expanded.has(row.id)}
            <div class="border-t border-border/40 px-2 py-1.5">
              <div class="mb-1 text-[10px] text-muted-foreground">{row.modelId} · K={row.K} · {row.candidates.length} scored</div>
              <!-- Winner -->
              <div class="mb-1 rounded bg-primary/10 p-1.5">
                <div class="flex items-center gap-1 text-[10px]">
                  <span class={'rounded px-1 py-0.5 ' + tierClass(row.winner.tier)}>{row.winner.tier}</span>
                  <span class="text-muted-foreground">winner · {row.winner.score.toFixed(2)}</span>
                </div>
                <div class="mt-1 line-clamp-2 text-[11px] leading-snug">{row.winner.response}</div>
              </div>
              <!-- Candidates -->
              {#each row.candidates as c, i (i)}
                {#if JSON.stringify(c.dna) !== JSON.stringify(row.winner.dna)}
                  <div class="mb-1 rounded bg-background/40 p-1.5">
                    <div class="flex items-center gap-1 text-[10px]">
                      <span class={'rounded px-1 py-0.5 ' + tierClass(c.tier)}>{c.tier}</span>
                      <span class="text-muted-foreground">{c.score.toFixed(2)}</span>
                      <button
                        type="button"
                        onclick={() => onPromote(row, c)}
                        aria-label="Send this candidate to main chat"
                        class="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      >
                        <ArrowRight size={10} />
                      </button>
                    </div>
                    <div class="mt-1 line-clamp-2 text-[11px] leading-snug">{c.response}</div>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</details>
