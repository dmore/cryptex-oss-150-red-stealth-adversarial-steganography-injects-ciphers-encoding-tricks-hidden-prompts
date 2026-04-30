<script lang="ts">
  import { page } from '$app/stores';
  import { repo } from '$lib/chat/repo';
  import { liveQuery } from 'dexie';
  import type { ChatRow } from '$lib/chat/types';
  import ChatWorkspace from '$lib/components/chat/workspace/ChatWorkspace.svelte';
  import { activeChatStore } from '$lib/stores/activeChat.svelte';
  import { onDestroy } from 'svelte';

  let chat = $state<ChatRow | null>(null);
  let loading = $state(true);
  let missing = $state(false);

  $effect(() => {
    const id = $page.params.id ?? '';
    loading = true; missing = false;
    const subscription = liveQuery(() => repo.getChat(id)).subscribe({
      next: (row) => {
        if (!row) { missing = true; chat = null; } else { chat = row; missing = false; }
        loading = false;
      },
      error: (err) => { console.error('[chat liveQuery]', err); loading = false; }
    });
    return () => subscription.unsubscribe();
  });

  // Publish the live chat row to the global activeChatStore so ChatShell
  // (which owns the 3-column layout + workspace mount) can read it.
  $effect(() => {
    activeChatStore.set(chat);
  });

  // Clear the slot when this page unmounts so a stale chat doesn't bleed
  // into other routes that share the chat layout.
  onDestroy(() => {
    activeChatStore.set(null);
  });
</script>

{#if loading}
  <p class="m-auto text-sm text-muted-foreground">Loading…</p>
{:else if missing}
  <p class="m-auto text-sm text-muted-foreground">Chat not found.</p>
{:else if chat}
  <ChatWorkspace {chat} />
{/if}
