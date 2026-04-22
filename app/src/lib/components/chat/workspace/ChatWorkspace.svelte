<script lang="ts">
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import { continueAssistantMessage } from '$lib/chat/dispatch';
  import ChatHeader from './ChatHeader.svelte';
  import MessageList from './MessageList.svelte';
  import Composer from '../composer/Composer.svelte';
  import AttackWorkspaceSidebar from './AttackWorkspaceSidebar.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { onMount } from 'svelte';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();
  let messages = $state<MessageRow[]>([]);
  let streaming = $state(false);
  let messageListEl = $state<{ scrollToBottom: () => void; scrollToBottomIfPinned: () => void } | null>(null);

  let streamingContent = $state('');
  let streamingReasoning = $state('');
  let workspaceOpen = $state(chat.settings.workspaceOpen ?? false);
  let workspaceTab = $state<'chain' | 'godmode'>(chat.settings.workspaceTab ?? 'chain');

  // Keep local state synced with prop changes on navigation.
  $effect(() => {
    workspaceOpen = chat.settings.workspaceOpen ?? false;
    workspaceTab = chat.settings.workspaceTab ?? 'chain';
  });

  let activeMode = $state<string | null>(chat.settings.activeMode ?? null);
  $effect(() => { activeMode = chat.settings.activeMode ?? null; });

  async function setActiveMode(id: string | null) {
    activeMode = id;
    try {
      await repo.updateChat(chat.id, { settings: { ...chat.settings, activeMode: id } });
    } catch (err) {
      console.error('[mode] failed:', err);
      alert('Mode update failed: ' + (err as Error).message);
      activeMode = chat.settings.activeMode ?? null;
    }
  }

  async function persistWorkspaceState(open: boolean, tab: 'chain' | 'godmode') {
    try {
      const fresh = await repo.getChat(chat.id);
      const base = fresh?.settings ?? chat.settings;
      await repo.updateChat(chat.id, {
        settings: { ...base, workspaceOpen: open, workspaceTab: tab }
      });
    } catch (err) {
      console.error('[workspace] persist failed:', err);
    }
  }

  async function refresh() { messages = await repo.listMessages(chat.id); }
  $effect(() => { refresh(); });

  $effect(() => {
    messages.length;
    messageListEl?.scrollToBottom();
  });

  function onMessageAppended(msg: MessageRow) {
    messages = [...messages, msg];
    refresh();
    streamingContent = '';
    streamingReasoning = '';
  }

  function onTextDelta(delta: string) {
    streamingContent += delta;
    messageListEl?.scrollToBottomIfPinned();
  }
  function onReasoningDelta(delta: string) { streamingReasoning += delta; }

  let continueCtrl = $state<AbortController | null>(null);

  async function handleContinueMessage(messageId: string) {
    if (streaming) return;
    streaming = true;
    continueCtrl = new AbortController();
    try {
      await continueAssistantMessage(chat, messageId, continueCtrl.signal, {
        onTextDelta,
        onReasoningDelta,
        onFinish: (msg) => onMessageAppended(msg),
        onError: (err) => { console.error('[continue]', err); }
      });
    } finally {
      streaming = false;
      continueCtrl = null;
    }
  }

  onMount(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: 'chain' | 'godmode' }>).detail?.tab;
      if (workspaceOpen && (!tab || tab === workspaceTab)) {
        // Clicking the same button while open closes the drawer.
        workspaceOpen = false;
      } else {
        workspaceOpen = true;
        if (tab) workspaceTab = tab;
      }
      void persistWorkspaceState(workspaceOpen, workspaceTab);
    };
    window.addEventListener('chat:open-workspace', handler);

    const continueHandler = (e: Event) => {
      const id = (e as CustomEvent<{ messageId: string }>).detail?.messageId;
      if (typeof id === 'string') void handleContinueMessage(id);
    };
    window.addEventListener('chat:continue-message', continueHandler);

    return () => {
      window.removeEventListener('chat:open-workspace', handler);
      window.removeEventListener('chat:continue-message', continueHandler);
    };
  });

  function onTabChange(t: 'chain' | 'godmode') {
    workspaceTab = t;
    void persistWorkspaceState(workspaceOpen, t);
  }

  function onWorkspaceClose() {
    workspaceOpen = false;
    void persistWorkspaceState(false, workspaceTab);
  }
</script>

<div class="flex h-full w-full min-h-0 overflow-hidden">
  <div class="fade-in flex h-full min-w-0 min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    <ChatHeader {chat} {workspaceOpen} {workspaceTab} />
    <div class="px-3 pt-1"><NoProviderBanner context="chat" compact={true} /></div>
    <MessageList
      bind:this={messageListEl}
      {chat}
      {messages}
      {streaming}
      {streamingContent}
      {streamingReasoning}
    />

    <Composer
      {chat}
      {activeMode}
      onModeChange={setActiveMode}
      {onMessageAppended}
      {onTextDelta}
      {onReasoningDelta}
      onStreamingChanged={(v) => (streaming = v)}
    />
  </div>

  {#if workspaceOpen}
    <AttackWorkspaceSidebar
      {chat}
      activeTab={workspaceTab}
      {onTabChange}
      onClose={onWorkspaceClose}
      onInsertToComposer={(text) =>
        window.dispatchEvent(new CustomEvent('composer:insert', { detail: { text } }))}
    />
  {/if}
</div>
