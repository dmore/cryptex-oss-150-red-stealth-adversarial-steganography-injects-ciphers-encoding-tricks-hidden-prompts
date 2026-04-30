<script lang="ts">
  import ChatSidebar from './sidebar/ChatSidebar.svelte';
  import SelectionPopover from './techniques/SelectionPopover.svelte';
  import DatasetFooter from './footer/DatasetFooter.svelte';
  import { activeChatStore } from '$lib/stores/activeChat.svelte';
  import { repo } from '$lib/chat/repo';
  import AttackWorkspaceSidebar from './workspace/AttackWorkspaceSidebar.svelte';

  let { children } = $props();

  // Read active chat from the store the chat-page populates.
  const chat = $derived(activeChatStore.chat);

  // Default widths — used when the chat row's settings don't carry a value.
  const LEFT_DEFAULT = 240;
  const LEFT_MIN = 200;
  const LEFT_MAX = 480;
  const RIGHT_DEFAULT = 440;

  let leftWidth = $state<number>(LEFT_DEFAULT);
  let rightWidth = $state<number>(RIGHT_DEFAULT);

  // Sync widths from chat.settings when chat changes.
  $effect(() => {
    if (!chat) return;
    leftWidth = chat.settings?.leftSidebarWidth ?? LEFT_DEFAULT;
    rightWidth =
      chat.settings?.rightSidebarWidth ??
      chat.settings?.workspaceWidth ?? // legacy field kept for back-compat
      RIGHT_DEFAULT;
  });

  // Workspace open + active tool — read from chat.settings.
  const workspaceOpen = $derived<boolean>(chat?.settings?.workspaceOpen ?? false);
  const activeTool = $derived<'chain' | 'godmode'>(chat?.settings?.workspaceTab ?? 'chain');

  // ---- Left drag handle ------------------------------------------------
  let leftPersistTimer: ReturnType<typeof setTimeout> | null = null;
  function onLeftResizeStart(e: PointerEvent) {
    if (!chat) return;
    const startX = e.clientX;
    const startW = leftWidth;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function move(ev: PointerEvent) {
      const next = Math.min(LEFT_MAX, Math.max(LEFT_MIN, startW + (ev.clientX - startX)));
      leftWidth = next;
    }
    function end() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (leftPersistTimer) clearTimeout(leftPersistTimer);
      const id = chat?.id;
      const w = leftWidth;
      if (!id) return;
      leftPersistTimer = setTimeout(() => {
        void repo.updateChat(id, {
          settings: { ...(chat?.settings ?? {}), leftSidebarWidth: w }
        });
      }, 250);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  // NOTE: Task 3 will add an `onResize(width)` callback to AttackWorkspaceSidebar's
  // Props type and forward to a ChatShell-owned setter. Until then, the sidebar
  // owns its own width state internally and persists via chat.settings.workspaceWidth,
  // which `rightWidth` reads on the next chat.settings change.
  function onWorkspaceClose() {
    if (!chat) return;
    void repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), workspaceOpen: false }
    });
  }
  function onWorkspaceTabChange(tab: 'chain' | 'godmode') {
    if (!chat) return;
    void repo.updateChat(chat.id, {
      settings: { ...(chat.settings ?? {}), workspaceTab: tab }
    });
  }
</script>

<div
  class="chat-shell grid h-[calc(100vh-7rem)] gap-3"
  style:grid-template-columns={workspaceOpen
    ? `${leftWidth}px minmax(0,1fr) ${rightWidth}px`
    : `${leftWidth}px minmax(0,1fr)`}
>
  <aside class="relative glass rounded-lg border border-border/50 p-3 overflow-hidden cryptex-scroll">
    <ChatSidebar />
    <button
      type="button"
      aria-label="Resize chat list sidebar"
      onpointerdown={onLeftResizeStart}
      class="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
    ></button>
  </aside>

  <section class="glass rounded-lg border border-border/50 p-3 overflow-hidden flex flex-col">
    {@render children?.()}
  </section>

  {#if workspaceOpen && chat}
    <AttackWorkspaceSidebar
      {chat}
      activeTab={activeTool}
      onTabChange={onWorkspaceTabChange}
      onClose={onWorkspaceClose}
      onInsertToComposer={(text: string) => {
        // Forward to the active page's composer via a window event.
        // Using the existing `composer:insert` channel that Composer.svelte already listens on.
        window.dispatchEvent(
          new CustomEvent('composer:insert', { detail: { text } })
        );
      }}
    />
  {/if}
</div>

<SelectionPopover />
<DatasetFooter />
