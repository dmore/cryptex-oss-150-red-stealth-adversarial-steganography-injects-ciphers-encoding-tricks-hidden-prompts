<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  onMount(() => {
    goto(base + '/transforms/', { replaceState: true });
  });
</script>

<div class="flex min-h-[50vh] items-center justify-center text-muted-foreground">
  <span class="animate-pulse">Entering the lab…</span>
</div>
