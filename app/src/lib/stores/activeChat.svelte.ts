import type { ChatRow } from '$lib/chat/types';

/**
 * Reactive holder for the currently-loaded chat row.
 *
 * The chat page (`/chat/[id]/+page.svelte`) populates this whenever its
 * Dexie liveQuery resolves a row; the chat shell (`ChatShell.svelte`)
 * reads it to drive layout (sidebar widths, workspace open/closed).
 *
 * v1: single global slot — there is only ever one active chat in the UI.
 */
class ActiveChatStore {
  chat = $state<ChatRow | null>(null);
  set(c: ChatRow | null) {
    this.chat = c;
  }
}

export const activeChatStore = new ActiveChatStore();
