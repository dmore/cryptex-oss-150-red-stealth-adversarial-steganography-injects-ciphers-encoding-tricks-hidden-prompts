<script lang="ts">
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    description: string;
    value: string;
    onChange: (id: string) => void;
    recentsKey: string;
    tip?: Snippet | null;
  };
  let { label, description, value, onChange, recentsKey, tip = null }: Props = $props();
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-baseline gap-2 text-xs">
    <span class="font-medium text-foreground">{label}</span>
    <span class="text-[10px] text-muted-foreground">{description}</span>
  </div>
  <ModelPickerV2
    {value}
    {onChange}
    {recentsKey}
    triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-3 py-1 hover:border-border/70 hover:text-foreground transition-colors w-full justify-between"
  />
  {#if tip}{@render tip()}{/if}
</div>
