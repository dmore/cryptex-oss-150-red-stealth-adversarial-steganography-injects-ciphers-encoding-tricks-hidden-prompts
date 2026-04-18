<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  import { onMount } from 'svelte';
  import { installChatShortcuts } from '$lib/stores/chatShortcuts.svelte';
  let { children } = $props();
  onMount(() => installChatShortcuts());
</script>

<ChatShell>{@render children?.()}</ChatShell>
