<script lang="ts">
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  type Props = { message: string; onRetry?: () => void };
  let { message, onRetry }: Props = $props();
</script>

<div class="mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs">
  <TriangleAlert size={14} class="text-destructive" />
  <div class="flex-1">
    <p>{message}</p>
    {#if onRetry}<button type="button" onclick={onRetry} class="mt-1 underline">Retry</button>{/if}
  </div>
</div>
