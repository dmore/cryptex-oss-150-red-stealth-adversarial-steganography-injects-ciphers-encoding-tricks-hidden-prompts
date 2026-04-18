<script lang="ts">
  import { techniqueRecents } from '$lib/stores/techniqueRecents.svelte';
  import { find } from '$lib/chat/techniques/registry';
  import type { Technique } from '$lib/chat/techniques/types';
  import { onMount } from 'svelte';

  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);
  let selectedText = $state('');

  const recents = $derived(
    (techniqueRecents.value ?? []).slice(0, 3).map(find).filter((t): t is Technique => Boolean(t))
  );

  function onSelectionChange() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!text || text.length < 2) { visible = false; return; }
    // Only trigger for selections inside .chat-bubble (assigned in Commit 4)
    const range = sel!.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement?.closest('.chat-bubble');
    if (!container) { visible = false; return; }
    const rect = range.getBoundingClientRect();
    // v1: position snapshot at selection time only. If the chat scrolls while popover is visible the popover drifts — acceptable for v1.
    x = rect.left + window.scrollX;
    y = rect.bottom + window.scrollY + 4;
    selectedText = text;
    visible = true;
  }

  function applyTechnique(t: Technique) {
    window.dispatchEvent(new CustomEvent('technique:apply-selection', {
      detail: { techniqueId: t.id, selectedText }
    }));
    visible = false;
  }

  function openSidebar() {
    window.dispatchEvent(new CustomEvent('techniques:focus-search'));
    visible = false;
  }

  onMount(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  });
</script>

{#if visible}
  <div
    role="menu"
    class="glass fixed z-40 rounded-md border border-white/10 p-1 shadow-glass"
    style="left: {x}px; top: {y}px;"
  >
    {#each recents as t (t.id)}
      <button type="button" onclick={() => applyTechnique(t)}
        class="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/5">
        {t.name}
      </button>
    {/each}
    <button type="button" onclick={openSidebar} class="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-white/5">
      more…
    </button>
  </div>
{/if}
