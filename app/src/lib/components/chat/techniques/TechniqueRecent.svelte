<script lang="ts">
  import { techniqueRecents } from '$lib/stores/techniqueRecents.svelte';
  import { find } from '$lib/chat/techniques/registry';
  import TechniqueRow from './TechniqueRow.svelte';
  import type { Technique } from '$lib/chat/techniques/types';
  type Props = { onClick: (t: Technique) => void };
  let { onClick }: Props = $props();

  const items = $derived(
    (techniqueRecents.value ?? [])
      .map((id) => find(id))
      .filter((t): t is Technique => Boolean(t))
  );
</script>

{#if items.length > 0}
  <div class="mb-3">
    <p class="mb-1 px-2 font-serif text-xs uppercase tracking-wide text-muted-foreground">Recent</p>
    {#each items as t (t.id)}
      <TechniqueRow technique={t} {onClick} />
    {/each}
  </div>
{/if}
