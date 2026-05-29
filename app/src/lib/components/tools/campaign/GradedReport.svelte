<script lang="ts">
  /**
   * Graded campaign report — ASR-by-strategy table with a summary band,
   * winner highlight, and expandable I/O pairs. Pure presentation: it reads
   * a CampaignData snapshot and emits a "save to Vault" event per row.
   */
  import type { CampaignData, CampaignRow } from '$lib/campaign/runner';
  import Copy from 'lucide-svelte/icons/copy';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Bookmark from 'lucide-svelte/icons/bookmark';
  import Trophy from 'lucide-svelte/icons/trophy';
  import { notify } from '$lib/stores/toast.svelte';

  interface Props {
    data: CampaignData;
    heading?: string;
    /** When true, render as a dimmed historical snapshot (re-run comparison). */
    past?: boolean;
    onSaveToVault?: (row: CampaignRow) => void;
  }
  let { data, heading, past = false, onSaveToVault }: Props = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  const doneRows = $derived(data.rows.filter((r) => r.status === 'done'));
  const bypassed = $derived(doneRows.filter((r) => r.result?.verdict.verdict === 'bypassed').length);
  const asr = $derived(doneRows.length > 0 ? Math.round((bypassed / doneRows.length) * 100) : 0);
  const meanScore = $derived(
    doneRows.length > 0
      ? doneRows.reduce((n, r) => n + (r.result?.verdict.score ?? 0), 0) / doneRows.length
      : 0
  );
  const fallbacks = $derived(doneRows.filter((r) => r.result?.verdict.usedFallback).length);
  const bestId = $derived.by(() => {
    let best: CampaignRow | undefined;
    for (const r of doneRows) {
      if (!best || (r.result?.verdict.score ?? 0) > (best.result?.verdict.score ?? 0)) best = r;
    }
    return best && (best.result?.verdict.score ?? 0) > 0 ? best.strategyId : '';
  });

  function verdictClass(v: string | undefined): string {
    if (v === 'bypassed') return 'border-red-500/40 bg-red-500/10 text-red-300';
    if (v === 'partial') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    if (v === 'refused') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    return 'border-muted text-muted-foreground';
  }
  function statusLabel(r: CampaignRow): string {
    if (r.status === 'done') return r.result?.verdict.verdict ?? 'done';
    return r.status;
  }

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      notify.success('Copied');
    } catch {
      notify.error('Clipboard write failed');
    }
  }
</script>

<div class={`space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass ${past ? 'opacity-70' : ''}`}>
  <div class="flex items-center justify-between gap-2">
    <h2 class="font-serif text-sm">{heading ?? 'Graded report'}</h2>
    <span class="font-mono text-[11px] text-muted-foreground">
      {data.targetModel.split(':').pop()}
    </span>
  </div>

  <!-- Summary band -->
  <div class="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
    <div class="rounded-lg border border-input bg-background/70 p-2">
      <div class="font-mono text-2xl text-red-400">{asr}%</div>
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">ASR</div>
    </div>
    <div class="rounded-lg border border-input bg-background/70 p-2">
      <div class="font-mono text-2xl text-foreground">{bypassed}/{doneRows.length}</div>
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Bypassed</div>
    </div>
    <div class="rounded-lg border border-input bg-background/70 p-2">
      <div class="font-mono text-2xl text-foreground">{meanScore.toFixed(2)}</div>
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Mean score</div>
    </div>
    <div class="rounded-lg border border-input bg-background/70 p-2">
      <div class="font-mono text-2xl text-foreground">{data.totalCalls}</div>
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Calls</div>
    </div>
    <div class="rounded-lg border border-input bg-background/70 p-2">
      <div class="font-mono text-2xl text-amber-400">{fallbacks}</div>
      <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Heuristic</div>
    </div>
  </div>

  {#if fallbacks > 0}
    <p class="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200">
      {fallbacks} verdict{fallbacks === 1 ? '' : 's'} used the regex heuristic fallback (judge unparseable or rate-limited).
      Verdicts are heuristic, not the trained StrongREJECT classifier.
    </p>
  {/if}

  <!-- Rows -->
  <ul class="flex flex-col gap-1.5">
    {#each data.rows as r (r.strategyId)}
      {@const isWinner = r.strategyId === bestId}
      <li class={`rounded-lg border bg-background/70 p-2.5 ${isWinner ? 'border-primary/50 ring-1 ring-primary/30' : 'border-input'}`}>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => toggle(r.strategyId)}
            class="inline-flex items-center gap-1 text-left text-sm hover:text-foreground"
            disabled={r.status !== 'done'}
          >
            {#if expanded.has(r.strategyId)}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
            <span class="font-medium">{r.label}</span>
          </button>
          {#if isWinner}<Trophy size={12} class="text-primary" />{/if}
          {#if r.citation}<code class="rounded bg-muted/40 px-1 py-0.5 text-[9px] text-muted-foreground">{r.citation}</code>{/if}
          <span class={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${verdictClass(r.result?.verdict.verdict)}`}>
            {statusLabel(r)}
          </span>
        </div>

        {#if r.status === 'done' && r.result}
          <div class="mt-1.5 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
              <div class="h-full bg-primary" style="width: {Math.round(r.result.verdict.score * 100)}%"></div>
            </div>
            <span class="font-mono text-[10px] text-muted-foreground">{r.result.verdict.score.toFixed(2)}</span>
            {#if !past && onSaveToVault && r.result.verdict.verdict !== 'refused'}
              <button
                type="button"
                onclick={() => onSaveToVault?.(r)}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Save winning payload to Vault"
              >
                <Bookmark size={10} /> Vault
              </button>
            {/if}
          </div>

          {#if expanded.has(r.strategyId)}
            <div class="mt-2 space-y-2">
              <div>
                <div class="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Payload sent
                  <button type="button" onclick={() => copyText(r.result?.payloadSent ?? '')} class="hover:text-foreground"><Copy size={10} /></button>
                </div>
                <pre class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-2 font-mono text-[10px]">{r.result.payloadSent.slice(0, 2000)}{r.result.payloadSent.length > 2000 ? '\n…' : ''}</pre>
              </div>
              <div>
                <div class="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Target response</div>
                <pre class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-2 font-mono text-[10px]">{r.result.targetResponse.slice(0, 2000)}{r.result.targetResponse.length > 2000 ? '\n…' : ''}</pre>
              </div>
              {#if r.result.verdict.reasoning}
                <div>
                  <div class="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Judge reasoning</div>
                  <p class="text-[11px] italic text-muted-foreground">{r.result.verdict.reasoning}</p>
                </div>
              {/if}
            </div>
          {/if}
        {:else if r.status === 'error'}
          <p class="mt-1 text-[11px] text-red-400">{r.error}</p>
        {/if}
      </li>
    {/each}
  </ul>
</div>
