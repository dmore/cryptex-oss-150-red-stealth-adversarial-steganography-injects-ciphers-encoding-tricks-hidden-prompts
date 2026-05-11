<script lang="ts">
  import type { CryptexError } from '$lib/errors/types';
  import { notify } from '$lib/stores/toast.svelte';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';
  import Wifi from 'lucide-svelte/icons/wifi';
  import Shield from 'lucide-svelte/icons/shield';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Server from 'lucide-svelte/icons/server';
  import Clock from 'lucide-svelte/icons/clock';
  import FileWarning from 'lucide-svelte/icons/file-warning';
  import Cog from 'lucide-svelte/icons/cog';
  import HardDrive from 'lucide-svelte/icons/hard-drive';
  import Plug from 'lucide-svelte/icons/plug';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import X from 'lucide-svelte/icons/x';
  import Copy from 'lucide-svelte/icons/copy';

  type Props = {
    error: CryptexError;
    onRetry?: () => void;
    onDismiss?: () => void;
    compact?: boolean;
  };
  let { error, onRetry, onDismiss, compact = false }: Props = $props();

  const ICONS = {
    network: Wifi,
    cors: Shield,
    auth: KeyRound,
    provider: Server,
    rate_limit: Clock,
    bad_input: FileWarning,
    tool: Cog,
    worker: Cog,
    storage_quota: HardDrive,
    local_server_offline: Plug,
    unknown: AlertTriangle
  } as const;

  const Icon = $derived(ICONS[error.category] ?? AlertTriangle);

  async function copyDetails() {
    const payload = {
      category: error.category,
      userMessage: error.userMessage,
      devMessage: error.devMessage,
      context: error.context,
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs,
      timestamp: new Date().toISOString()
    };
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      notify.success('Error details copied');
    } catch {
      notify.error('Copy failed');
    }
  }
</script>

<div
  role="alert"
  class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
  class:p-2={compact}
>
  <div class="flex items-start gap-3">
    <Icon size={compact ? 14 : 18} class="mt-0.5 flex-none text-destructive" />
    <div class="min-w-0 flex-1 space-y-1">
      <div class="font-medium text-foreground">{error.userMessage}</div>
      {#if !compact && error.devMessage && error.devMessage !== error.userMessage}
        <div class="text-xs text-muted-foreground break-words">{error.devMessage}</div>
      {/if}
      {#if error.retryAfterMs}
        <div class="text-xs text-muted-foreground">Retry after ~{Math.ceil(error.retryAfterMs / 1000)}s.</div>
      {/if}
    </div>
    <div class="flex flex-none items-center gap-1">
      {#if error.retryable && onRetry}
        <button
          type="button"
          onclick={onRetry}
          class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-xs hover:bg-muted"
          aria-label="Retry"
        >
          <RefreshCw size={12} /> Retry
        </button>
      {/if}
      <button
        type="button"
        onclick={copyDetails}
        class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-xs hover:bg-muted"
        aria-label="Copy error details"
        title="Copy details"
      >
        <Copy size={12} />
      </button>
      {#if onDismiss}
        <button
          type="button"
          onclick={onDismiss}
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      {/if}
    </div>
  </div>
</div>
