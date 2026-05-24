<script lang="ts">
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import TokenadeTool from '$lib/components/tools/tokenade/TokenadeTool.svelte';
</script>

<ToolShell
  toolId="tokenade"
  title="Tokenade"
  description="Depth × breadth × repeats = a controlled payload explosion. Uses emoji carriers, variation selectors, and zero-width noise to generate high-token-cost strings for stress testing."
  usage={{
    title: 'Tokenade · Usage',
    bullets: [
      'Pick a carrier (emoji or text), set depth × breadth × repeats.',
      'Length estimate updates live — watch the danger threshold.',
      'Variation selectors + ZWNJ = high token-per-codepoint inflation.',
      'Use a preset for known-good token-bomb shapes.'
    ]
  }}
>
  <TokenadeTool />
</ToolShell>
