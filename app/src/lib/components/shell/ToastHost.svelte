<script lang="ts">
  import { toasts } from '$lib/stores/toast.svelte';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import Info from 'lucide-svelte/icons/info';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import { cn } from '$lib/utils/cn';

  const iconOf = {
    success: CircleCheck,
    warn: TriangleAlert,
    info: Info,
    error: CircleX
  } as const;
</script>

<div
  aria-live="polite"
  aria-atomic="false"
  class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
>
  {#each toasts.items as t (t.id)}
    {@const Icon = iconOf[t.kind]}
    <div
      role="status"
      class={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2.5 shadow-glass backdrop-blur-glass fade-in',
        t.kind === 'success' && 'border-primary/40 bg-card/90 text-foreground',
        t.kind === 'error' && 'border-destructive/50 bg-destructive/15 text-foreground',
        t.kind === 'warn' && 'border-accent/50 bg-accent/15 text-foreground',
        t.kind === 'info' && 'border-border bg-card/90 text-foreground'
      )}
    >
      <Icon size={16} class="mt-0.5 shrink-0 opacity-80" />
      <div class="text-sm leading-snug">{t.message}</div>
      <button
        type="button"
        onclick={() => toasts.dismiss(t.id)}
        class="ml-auto text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  {/each}
</div>
