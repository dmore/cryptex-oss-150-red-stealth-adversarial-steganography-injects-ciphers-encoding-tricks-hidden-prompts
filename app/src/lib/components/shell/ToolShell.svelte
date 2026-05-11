<script lang="ts">
  import type { Snippet } from 'svelte';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { Errors, type CryptexError } from '$lib/errors/types';
  import ErrorPanel from './ErrorPanel.svelte';
  import HistoryFooter from './HistoryFooter.svelte';
  import UsageHint from './UsageHint.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Square from 'lucide-svelte/icons/square';

  type Props = {
    toolId: string;
    title: string;
    /** Optional accent word (renders italicized in primary color). */
    accent?: string;
    description?: string;
    usage?: { title: string; bullets: string[] };
    /** Optional cancel handler (defaults to activeRuns.cancel(toolId)). */
    onCancel?: () => void;
    /** Optional replay handler for HistoryFooter. */
    onReplay?: (input: string, params: Record<string, unknown>) => void;
    /** Hide the history footer entirely (e.g., for stateless tools). */
    showHistory?: boolean;
    /** Custom error if you want to bypass activeRuns state. */
    error?: CryptexError | undefined;
    onErrorRetry?: () => void;
    onErrorDismiss?: () => void;
    /** Children — the tool's main content. */
    children: Snippet;
    /** Optional Vault slot — renders below children. */
    vault?: Snippet;
  };
  let {
    toolId,
    title,
    accent,
    description,
    usage,
    onCancel,
    onReplay,
    showHistory = true,
    error,
    onErrorRetry,
    onErrorDismiss,
    children,
    vault
  }: Props = $props();

  const run = $derived(activeRuns.get(toolId));
  const status = $derived(run?.status ?? 'idle');
  const displayError = $derived<CryptexError | undefined>(
    error ??
      (run?.status === 'error' && run.error
        ? Errors.tool(run.error)
        : undefined)
  );

  const titleBefore = $derived(accent ? title.split(accent)[0] : title);
  const titleAfter = $derived(accent ? title.split(accent)[1] ?? '' : '');

  function cancel() {
    if (onCancel) onCancel();
    else activeRuns.cancel(toolId);
  }

  const statusBadgeClass = $derived.by(() => {
    if (status === 'running') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    if (status === 'done') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (status === 'error') return 'border-red-500/30 bg-red-500/10 text-red-300';
    return 'border-muted text-muted-foreground';
  });
</script>

<svelte:head><title>{title} · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        {#if accent}
          {titleBefore}<span class="text-primary italic">{accent}</span>{titleAfter}
        {:else}
          {title}
        {/if}
      </h1>
      {#if usage}
        <UsageHint title={usage.title} bullets={usage.bullets} />
      {/if}

      <!-- Status badge -->
      <div
        class={'ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ' +
          statusBadgeClass}
      >
        {#if status === 'running'}
          <Loader size={10} class="animate-spin" />
          Running
          <button
            type="button"
            onclick={cancel}
            class="ml-1 inline-flex items-center gap-0.5 rounded-sm border border-blue-500/30 bg-blue-500/10 px-1 py-0 text-[9px] hover:bg-blue-500/20"
            aria-label="Cancel"
          >
            <Square size={9} /> Cancel
          </button>
        {:else if status === 'done'}
          Done
        {:else if status === 'error'}
          Error
        {:else if status === 'cancelled'}
          Cancelled
        {:else}
          Ready
        {/if}
      </div>
    </div>
    {#if description}
      <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">{description}</p>
    {/if}
  </header>

  {#if displayError}
    <ErrorPanel error={displayError} onRetry={onErrorRetry} onDismiss={onErrorDismiss} />
  {/if}

  <!-- Tool main content -->
  {@render children()}

  <!-- Vault slot -->
  {#if vault}
    {@render vault()}
  {/if}

  <!-- History footer -->
  {#if showHistory}
    <HistoryFooter {toolId} {onReplay} />
  {/if}
</section>
