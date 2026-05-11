<script lang="ts" generics="TPayload">
  import type { VaultStore } from '$lib/vault/store.svelte';
  import type { VaultItem } from '$lib/vault/types';
  import VaultItemCard from './VaultItemCard.svelte';
  import VaultAddModal from './VaultAddModal.svelte';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Plus from 'lucide-svelte/icons/plus';
  import Library from 'lucide-svelte/icons/library';
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    store: VaultStore<TPayload>;
    label?: string;
    /** Called when user clicks "Use" on an item; receives the payload. */
    onUse: (payload: TPayload, item: VaultItem<TPayload>) => void;
    /** Optional placeholder for the add-item form's payload field. */
    payloadPlaceholder?: string;
  };
  let { store, label = 'Vault', onUse, payloadPlaceholder = '...' }: Props = $props();

  let open = $state(false);
  let query = $state('');
  let selectedTag = $state<string | null>(null);
  let showAddModal = $state(false);

  const filtered = $derived(
    store.search({
      text: query.trim() || undefined,
      tags: selectedTag ? [selectedTag] : undefined
    })
  );
  const counts = $derived(store.count());
  const tags = $derived(store.allTags());
</script>

<section class="rounded-xl border border-border bg-card/40">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
    aria-expanded={open}
  >
    <div class="flex items-center gap-2">
      {#if open}
        <ChevronDown size={16} class="text-muted-foreground" />
      {:else}
        <ChevronRight size={16} class="text-muted-foreground" />
      {/if}
      <Library size={14} class="text-primary" />
      <span class="font-medium text-sm">{label}</span>
      <span class="text-xs text-muted-foreground">
        · {counts.total} item{counts.total === 1 ? '' : 's'}
        {#if counts.user > 0}({counts.user} custom){/if}
      </span>
    </div>
  </button>

  {#if open}
    <div class="border-t border-border/40 px-4 py-3 space-y-3">
      <!-- Search + filter -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search
            size={12}
            class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            bind:value={query}
            placeholder="Search vault..."
            class="w-full rounded-md border border-input bg-background/70 pl-7 pr-2 py-1.5 text-xs focus:border-ring focus:outline-none"
          />
        </div>
        <button
          type="button"
          onclick={() => (showAddModal = true)}
          class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-xs hover:bg-muted"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      <!-- Tag chips -->
      {#if tags.length > 0}
        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            onclick={() => (selectedTag = null)}
            aria-pressed={selectedTag === null}
            class="rounded-full border px-2 py-0.5 text-[10px] transition-colors"
            class:bg-primary={selectedTag === null}
            class:text-primary-foreground={selectedTag === null}
            class:border-primary={selectedTag === null}
            class:border-border={selectedTag !== null}
            class:bg-card={selectedTag !== null}
          >
            All
          </button>
          {#each tags as tag (tag)}
            <button
              type="button"
              onclick={() => (selectedTag = tag === selectedTag ? null : tag)}
              aria-pressed={selectedTag === tag}
              class="rounded-full border px-2 py-0.5 text-[10px] transition-colors"
              class:bg-primary={selectedTag === tag}
              class:text-primary-foreground={selectedTag === tag}
              class:border-primary={selectedTag === tag}
              class:border-border={selectedTag !== tag}
              class:bg-card={selectedTag !== tag}
            >
              {tag}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Item list -->
      {#if filtered.length === 0}
        <div
          class="rounded-md border border-dashed border-border/40 bg-background/30 p-4 text-center text-xs text-muted-foreground"
        >
          No items match — adjust filters or click <strong class="text-foreground">Add</strong> to create one.
        </div>
      {:else}
        <ul class="space-y-1.5 max-h-72 overflow-y-auto pr-1 cryptex-scroll">
          {#each filtered as item (item.id)}
            <VaultItemCard
              {item}
              onUse={() => onUse(item.payload, item)}
              onTogglePin={() => store.togglePin(item.id)}
              onRemove={item.source === 'user' ? () => store.remove(item.id) : undefined}
            />
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>

{#if showAddModal}
  <VaultAddModal
    {payloadPlaceholder}
    onSave={(init) => {
      store.add(init as Omit<VaultItem<TPayload>, 'id' | 'schemaVersion' | 'source' | 'addedAt'>);
      showAddModal = false;
    }}
    onClose={() => (showAddModal = false)}
  />
{/if}
