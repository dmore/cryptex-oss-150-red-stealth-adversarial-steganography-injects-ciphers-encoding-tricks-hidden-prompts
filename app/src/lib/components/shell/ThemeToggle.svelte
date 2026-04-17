<script lang="ts">
  import { theme } from '$lib/stores/theme.svelte';
  import Sun from 'lucide-svelte/icons/sun';
  import Moon from 'lucide-svelte/icons/moon';
  import Monitor from 'lucide-svelte/icons/monitor';

  function onClick() { theme.cycle(); }
</script>

<button
  type="button"
  onclick={onClick}
  class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  title={`Theme: ${theme.mode} (resolved: ${theme.resolved}) — click to cycle`}
  aria-label={`Cycle theme (current: ${theme.mode})`}
>
  {#if theme.mode === 'light'}
    <Sun size={16} />
  {:else if theme.mode === 'dark'}
    <Moon size={16} />
  {:else}
    <Monitor size={16} />
  {/if}
</button>
