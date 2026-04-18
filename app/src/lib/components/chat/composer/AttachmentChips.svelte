<script lang="ts">
  import X from 'lucide-svelte/icons/x';
  import type { ExtractResult } from '$lib/chat/attachments/extract';

  export type PendingAttachment = {
    id: string;
    name: string;
    size: number;
    extracted: ExtractResult;
    blob: Blob;
  };

  type Props = { items: PendingAttachment[]; onRemove: (id: string) => void };
  let { items, onRemove }: Props = $props();
</script>

{#if items.length > 0}
  <div class="mb-2 flex flex-wrap gap-1.5">
    {#each items as a (a.id)}
      <span class="inline-flex items-center gap-1 rounded-md border border-white/10 bg-card/50 px-2 py-1 text-xs">
        {a.name} · {Math.round(a.size / 1024)} KB
        <button type="button" onclick={() => onRemove(a.id)} aria-label="Remove"><X size={10} /></button>
      </span>
    {/each}
  </div>
{/if}
