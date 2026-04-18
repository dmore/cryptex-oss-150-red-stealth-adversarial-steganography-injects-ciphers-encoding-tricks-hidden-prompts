<script lang="ts">
  import Search from 'lucide-svelte/icons/search';
  type Props = { value: string; onChange: (v: string) => void };
  let { value, onChange }: Props = $props();
</script>

<div class="flex items-center gap-2 border-b border-white/10 pb-2">
  <Search size={14} class="text-muted-foreground" />
  <input
    type="text"
    placeholder="Search techniques…"
    {value}
    oninput={(e) => onChange((e.target as HTMLInputElement).value)}
    class="flex-1 bg-transparent text-xs outline-none"
  />
</div>
