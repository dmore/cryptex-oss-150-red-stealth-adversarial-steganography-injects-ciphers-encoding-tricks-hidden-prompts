<script lang="ts">
  import type { VaultItem } from '$lib/vault/types';
  import X from 'lucide-svelte/icons/x';

  type Props = {
    payloadPlaceholder?: string;
    onSave: (init: Omit<VaultItem<unknown>, 'id' | 'schemaVersion' | 'source' | 'addedAt'>) => void;
    onClose: () => void;
  };
  let { payloadPlaceholder = 'Item payload...', onSave, onClose }: Props = $props();

  let title = $state('');
  let description = $state('');
  let tagsCsv = $state('');
  let payloadText = $state('');
  let notes = $state('');
  let error = $state('');

  function save() {
    error = '';
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }
    if (!payloadText.trim()) {
      error = 'Payload is required';
      return;
    }
    const tags = tagsCsv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    let payload: unknown = payloadText;
    // Attempt JSON parse — if it works, store as object; otherwise as string.
    try {
      const trimmed = payloadText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        payload = JSON.parse(trimmed);
      }
    } catch {
      // not JSON — keep as string
    }
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      tags,
      payload,
      notes: notes.trim() || undefined
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  role="dialog"
  aria-modal="true"
  aria-label="Add vault item"
  tabindex="-1"
  class="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
  onclick={onClose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="glass w-full max-w-lg rounded-xl border border-white/10 shadow-glass p-5 space-y-3"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between">
      <h2 class="font-serif text-lg">Add to vault</h2>
      <button
        type="button"
        onclick={onClose}
        aria-label="Close"
        class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
      >
        <X size={14} />
      </button>
    </div>

    <label class="block space-y-1">
      <span class="text-xs text-muted-foreground">Title <span class="text-red-400">*</span></span>
      <input
        type="text"
        bind:value={title}
        placeholder="e.g. Universal jailbreak suffix #42"
        class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
      />
    </label>

    <label class="block space-y-1">
      <span class="text-xs text-muted-foreground">Description</span>
      <input
        type="text"
        bind:value={description}
        placeholder="One-line summary"
        class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
      />
    </label>

    <label class="block space-y-1">
      <span class="text-xs text-muted-foreground">Tags (comma-separated)</span>
      <input
        type="text"
        bind:value={tagsCsv}
        placeholder="tag1, tag2, tag3"
        class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
      />
    </label>

    <label class="block space-y-1">
      <span class="text-xs text-muted-foreground">Payload <span class="text-red-400">*</span></span>
      <textarea
        bind:value={payloadText}
        placeholder={payloadPlaceholder}
        rows={5}
        class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 font-mono text-xs focus:border-ring focus:outline-none"
      ></textarea>
    </label>

    <label class="block space-y-1">
      <span class="text-xs text-muted-foreground">Notes</span>
      <textarea
        bind:value={notes}
        placeholder="Personal notes for this item"
        rows={2}
        class="w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
      ></textarea>
    </label>

    {#if error}
      <p class="text-xs text-red-400">{error}</p>
    {/if}

    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onclick={onClose}
        class="rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm hover:bg-muted"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={save}
        class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Save
      </button>
    </div>
  </div>
</div>
