<script lang="ts">
  import type { Technique } from '$lib/chat/techniques/types';
  type Props = { technique: Technique; onClick: (t: Technique) => void };
  let { technique, onClick }: Props = $props();

  const disabled = $derived(technique.category === 'godmode');
</script>

<button
  type="button"
  onclick={() => { if (!disabled) onClick(technique); }}
  {disabled}
  class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <span class="truncate flex-1">{technique.name}</span>
  <span class="text-muted-foreground">{technique.local ? '·' : '⚡'}</span>
</button>
