<script lang="ts">
  import type { Technique } from '$lib/chat/techniques/types';
  import TechniqueRow from './TechniqueRow.svelte';
  type Props = { label: string; items: Technique[]; onClick: (t: Technique) => void };
  let { label, items, onClick }: Props = $props();
</script>

{#if items.length > 0}
  <div class="mb-3">
    <p class="mb-1 px-2 font-serif text-xs uppercase tracking-wide text-muted-foreground">{label} ({items.length})</p>
    <div class="max-h-64 overflow-y-auto">
      {#each items as t (t.id)}
        <TechniqueRow technique={t} {onClick} />
      {/each}
    </div>
  </div>
{/if}
