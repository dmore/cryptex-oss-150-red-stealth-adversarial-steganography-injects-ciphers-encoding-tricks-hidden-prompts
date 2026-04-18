<script lang="ts">
  import type { ToolCallLog } from '$lib/chat/types';
  import InlineErrorCard from './InlineErrorCard.svelte';
  type Props = { call: ToolCallLog };
  let { call }: Props = $props();
</script>

{#if call.errorMessage}
  <InlineErrorCard message={call.errorMessage} />
{/if}

<details class="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
  <summary class="cursor-pointer text-primary">
    {call.source}: {call.toolName}
  </summary>
  <div class="mt-2 space-y-1">
    <p class="text-muted-foreground">Input:</p>
    <pre class="whitespace-pre-wrap rounded bg-muted/50 p-1 text-[11px]">{JSON.stringify(call.input, null, 2)}</pre>
    <p class="text-muted-foreground">Output:</p>
    <pre class="whitespace-pre-wrap rounded bg-muted/50 p-1 text-[11px]">{JSON.stringify(call.output, null, 2)}</pre>
  </div>
</details>
