<script lang="ts">
  import { allTechniques, byCategory, search } from '$lib/chat/techniques/registry';
  import { pushRecent } from '$lib/stores/techniqueRecents.svelte';
  import type { Technique, TechniqueCategory } from '$lib/chat/techniques/types';
  import TechniqueSearchInput from './TechniqueSearchInput.svelte';
  import TechniqueGroup from './TechniqueGroup.svelte';
  import TechniqueRecent from './TechniqueRecent.svelte';

  let query = $state('');

  const filtered = $derived(query.trim() ? search(query) : allTechniques());

  function items(cat: TechniqueCategory): Technique[] {
    return filtered.filter((t) => t.category === cat);
  }

  const transform = $derived(items('transform'));
  const mutate = $derived(items('mutate'));
  const classifier = $derived(items('classifier'));
  const mode = $derived(items('mode'));
  const godmode = $derived(items('godmode'));

  function handleClick(t: Technique) {
    pushRecent(t.id);
    window.dispatchEvent(new CustomEvent('technique:select', { detail: { id: t.id } }));
  }
</script>

<div class="flex h-full flex-col">
  <TechniqueSearchInput value={query} onChange={(v) => (query = v)} />
  <div class="mt-2 flex-1 overflow-y-auto">
    {#if !query}<TechniqueRecent onClick={handleClick} />{/if}
    <TechniqueGroup label="Transform" items={transform} onClick={handleClick} />
    <TechniqueGroup label="Mutate" items={mutate} onClick={handleClick} />
    <TechniqueGroup label="Classifier" items={classifier} onClick={handleClick} />
    <TechniqueGroup label="Mode" items={mode} onClick={handleClick} />
    <TechniqueGroup label="Godmode" items={godmode} onClick={handleClick} />
  </div>
</div>
