import { registerShortcut } from './shortcuts.svelte';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { repo } from '$lib/chat/repo';

export function installChatShortcuts(): () => void {
  const unsubs = [
    registerShortcut('cmd+n', async () => {
      const chat = await repo.createChat({ title: 'New chat', modelQualifiedId: 'openrouter:openrouter/auto' });
      goto(`${base}/chat/${chat.id}`);
    }),
    registerShortcut('escape', () => {
      window.dispatchEvent(new CustomEvent('chat:stop-stream'));
    }),
    registerShortcut('cmd+u', () => {
      window.dispatchEvent(new CustomEvent('chat:attach-file'));
    })
  ];
  return () => unsubs.forEach((u) => u());
}
