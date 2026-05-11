<script lang="ts">
  import type { VaultItem } from '$lib/vault/types';
  import Pin from 'lucide-svelte/icons/pin';
  import PinOff from 'lucide-svelte/icons/pin-off';
  import Play from 'lucide-svelte/icons/play';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  type Props = {
    item: VaultItem;
    onUse: () => void;
    onTogglePin: () => void;
    onRemove?: () => void;
  };
  let { item, onUse, onTogglePin, onRemove }: Props = $props();

  const sourceBadgeClass = $derived(
    item.source === 'bundled'
      ? 'border-emerald-500/30 text-emerald-300'
      : 'border-blue-500/30 text-blue-300'
  );
</script>

<li class="rounded-md border border-border/40 bg-background/40 p-2 text-xs">
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0 flex-1 space-y-0.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="font-medium text-foreground truncate">{item.title}</span>
        <span
          class={'inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wider ' +
            sourceBadgeClass}
        >
          {item.source}
        </span>
        {#if item.license}
          <span class="text-[9px] text-muted-foreground">{item.license}</span>
        {/if}
      </div>
      {#if item.description}
        <div class="text-muted-foreground line-clamp-2 break-words">{item.description}</div>
      {/if}
      {#if item.tags.length > 0}
        <div class="flex flex-wrap gap-0.5">
          {#each item.tags as t (t)}
            <span class="rounded bg-muted/40 px-1 py-0 text-[9px] font-mono">{t}</span>
          {/each}
        </div>
      {/if}
    </div>
    <div class="flex flex-none items-center gap-1">
      <button
        type="button"
        onclick={onTogglePin}
        class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
        aria-label={item.pinned ? 'Unpin' : 'Pin'}
        title={item.pinned ? 'Unpin' : 'Pin'}
      >
        {#if item.pinned}
          <PinOff size={11} />
        {:else}
          <Pin size={11} />
        {/if}
      </button>
      {#if item.sourceUrl}
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-muted"
          aria-label="Source"
          title={item.sourceUrl}
        >
          <ExternalLink size={11} />
        </a>
      {/if}
      {#if onRemove}
        <button
          type="button"
          onclick={onRemove}
          class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card/40 hover:bg-red-500/10 hover:text-red-300"
          aria-label="Remove"
          title="Remove"
        >
          <Trash2 size={11} />
        </button>
      {/if}
      <button
        type="button"
        onclick={onUse}
        class="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90"
      >
        <Play size={10} /> Use
      </button>
    </div>
  </div>
</li>
