<script lang="ts">
  import type { TechniqueDNA } from './dna';
  import type { RefusalTier } from '../attack-chain-refusal';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    idx: number;
    dna: TechniqueDNA | null;
    status: 'running' | 'scored' | 'failed';
    score?: number;
    tier?: RefusalTier;
    preview?: string;
    response?: string;
    error?: string;
    canPromote: boolean;
    onPromote: () => void;
  };
  let { idx, dna, status, score, tier, preview, response, error, canPromote, onPromote }: Props = $props();

  let expanded = $state(false);

  const tierClass = $derived(
    tier === 'refusal' ? 'bg-red-500/20 text-red-400'
    : tier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
    : tier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
    : tier === 'substantive' ? 'bg-green-500/20 text-green-400'
    : tier === 'compliant' ? 'bg-emerald-500/30 text-emerald-300'
    : 'bg-muted/40 text-muted-foreground'
  );

  function dnaChip(d: TechniqueDNA | null): string {
    if (!d) return '—';
    const parts: string[] = [];
    if (d.mutatorId) parts.push(d.mutatorId);
    if (d.classifierId) parts.push(d.classifierId);
    if (d.wrapperId) parts.push(d.wrapperId);
    parts.push(d.tempBucket);
    return parts.length > 0 ? parts.join(' · ') : 'empty';
  }
</script>

<li class="rounded border border-border/40 bg-background/30 px-2 py-1.5 text-xs">
  <div class="flex items-center gap-2">
    <span class="font-mono text-[10px] text-muted-foreground">#{idx}</span>

    {#if status === 'running'}
      <Loader class="animate-spin" size={11} />
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
    {:else if status === 'scored'}
      <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass}>{tier}</span>
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
      {#if score !== undefined}<span class="ml-auto text-[10px] text-muted-foreground">{score.toFixed(2)}</span>{/if}
    {:else if status === 'failed'}
      <AlertTriangle size={11} class="text-orange-400" />
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
      <span class="ml-auto text-[10px] text-orange-400">{error}</span>
    {/if}

    {#if status === 'scored' && preview}
      <button
        type="button"
        onclick={() => (expanded = !expanded)}
        aria-expanded={expanded}
        class="ml-1 text-muted-foreground hover:text-foreground"
        aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
      >
        <ChevronRight size={11} class={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
      </button>
    {/if}
  </div>

  {#if expanded && preview}
    <div class="mt-1 rounded bg-muted/20 p-2 text-[11px] leading-snug">
      {preview}
      {#if canPromote}
        <div class="mt-1">
          <button
            type="button"
            onclick={onPromote}
            class="inline-flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[10px] hover:bg-muted/40"
          >
            <ArrowRight size={10} /> Send to main chat
          </button>
        </div>
      {/if}
    </div>
  {/if}
</li>
