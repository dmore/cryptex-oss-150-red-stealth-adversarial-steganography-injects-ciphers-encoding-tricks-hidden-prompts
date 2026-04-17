<script lang="ts">
  import type { Transformer } from '$lib/transformers/registry';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { cn } from '$lib/utils/cn';
  import Star from 'lucide-svelte/icons/star';
  import Settings from 'lucide-svelte/icons/settings';

  interface Props {
    transform: Transformer;
    active: boolean;
    preview: string;
    onselect: () => void;
    onopenOptions: () => void;
  }
  let { transform, active, preview, onselect, onopenOptions }: Props = $props();

  const hasOptions = $derived(!!(transform.configurableOptions && transform.configurableOptions.length));
  const isFav = $derived(favorites.has(transform.name));
</script>

<div
  class={cn(
    'group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150 ease-out',
    active
      ? 'border-primary/50 bg-primary/5 shadow-primary'
      : 'border-border bg-card/50 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-glass'
  )}
>
  <button
    type="button"
    onclick={onselect}
    class="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label={`Use ${transform.name}`}
  ></button>

  <div class="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
    <div class="flex-1 min-w-0">
      <div class="font-medium text-sm text-foreground truncate">{transform.name}</div>
      {#if transform.description}
        <div class="text-[11px] text-muted-foreground line-clamp-2">{transform.description}</div>
      {/if}
    </div>
    <div class="flex items-center gap-0.5 pointer-events-auto">
      <button
        type="button"
        onclick={(e) => { e.stopPropagation(); favorites.toggle(transform.name); }}
        class={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          isFav
            ? 'text-accent hover:text-accent/80'
            : 'text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-foreground'
        )}
        aria-label={isFav ? `Unpin ${transform.name}` : `Pin ${transform.name}`}
        aria-pressed={isFav}
      >
        <Star size={14} class={isFav ? 'fill-current' : ''} />
      </button>
      {#if hasOptions}
        <button
          type="button"
          onclick={(e) => { e.stopPropagation(); onopenOptions(); }}
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-colors hover:text-foreground"
          aria-label={`Options for ${transform.name}`}
        >
          <Settings size={14} />
        </button>
      {/if}
    </div>
  </div>

  {#if preview}
    <div
      class="relative z-10 pointer-events-none rounded-md bg-background/60 px-2 py-1.5 font-mono text-[11px] text-foreground/90 truncate"
      title={preview}
    >
      {preview}
    </div>
  {/if}
</div>
