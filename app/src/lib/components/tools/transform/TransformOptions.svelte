<script lang="ts">
  import type { Transformer } from '$lib/transformers/registry';
  import { getMergedTransformOptions, setTransformOption, resetTransformOptions } from '$lib/transformers/options';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';

  interface Props {
    transform: Transformer;
    oninvalidate?: () => void;
  }
  let { transform, oninvalidate }: Props = $props();

  let values = $state<Record<string, unknown>>({});

  $effect(() => {
    values = { ...getMergedTransformOptions(transform) };
  });

  function update(id: string, value: unknown) {
    values = { ...values, [id]: value };
    setTransformOption(transform.name, id, value);
    oninvalidate?.();
  }

  function resetAll() {
    resetTransformOptions(transform.name);
    values = { ...getMergedTransformOptions(transform) };
    oninvalidate?.();
  }
</script>

{#if transform.configurableOptions && transform.configurableOptions.length}
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="font-serif text-sm text-foreground">{transform.name} options</h3>
      <button
        type="button"
        onclick={resetAll}
        class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <RotateCcw size={11} />
        Reset
      </button>
    </div>

    <div class="space-y-2.5">
      {#each transform.configurableOptions as opt (opt.id)}
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground block" for="opt-{opt.id}">{opt.label}</label>

          {#if opt.type === 'boolean'}
            <label class="inline-flex items-center gap-2">
              <input
                id="opt-{opt.id}"
                type="checkbox"
                checked={!!values[opt.id]}
                onchange={(e) => update(opt.id, (e.currentTarget as HTMLInputElement).checked)}
                class="h-4 w-4 rounded border-input accent-primary"
              />
              <span class="text-xs">{values[opt.id] ? 'On' : 'Off'}</span>
            </label>
          {:else if opt.type === 'select' && opt.options}
            <select
              id="opt-{opt.id}"
              value={String(values[opt.id])}
              onchange={(e) => {
                const raw = (e.currentTarget as HTMLSelectElement).value;
                const match = opt.options!.find((o) => String(o.value) === raw);
                update(opt.id, match ? match.value : raw);
              }}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm focus:border-ring focus:outline-none"
            >
              {#each opt.options as choice (String(choice.value))}
                <option value={String(choice.value)}>{choice.label}</option>
              {/each}
            </select>
          {:else if opt.type === 'number'}
            <input
              id="opt-{opt.id}"
              type="number"
              min={opt.min}
              max={opt.max}
              step={opt.step}
              value={Number(values[opt.id]) || 0}
              oninput={(e) => update(opt.id, Number((e.currentTarget as HTMLInputElement).value))}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm focus:border-ring focus:outline-none"
            />
          {:else}
            <input
              id="opt-{opt.id}"
              type="text"
              value={String(values[opt.id] ?? '')}
              oninput={(e) => update(opt.id, (e.currentTarget as HTMLInputElement).value)}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 text-sm font-mono focus:border-ring focus:outline-none"
            />
          {/if}
        </div>
      {/each}
    </div>
  </div>
{:else}
  <p class="text-xs text-muted-foreground italic">No configurable options.</p>
{/if}
