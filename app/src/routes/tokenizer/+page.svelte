<script lang="ts">
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import TokenizerTool from '$lib/components/tools/tokenizer/TokenizerTool.svelte';
</script>

<ToolShell
  toolId="tokenizer"
  title="Tokenizer"
  description="Visualize how models segment your text. Toggle between UTF-8 bytes, naive word splits, and the BPE encoders used by GPT-3.5, GPT-4, and GPT-4o."
  usage={{
    title: 'Tokenizer · Usage',
    bullets: [
      'Compare different BPE vocabularies on the same input.',
      'Each token is colored so boundaries are visible.',
      'Useful for verifying token-bomb output and prompt cost.',
      'cl100k = GPT-3.5/4, o200k = GPT-4o, p50k/r50k = older models.'
    ]
  }}
>
  <TokenizerTool />
</ToolShell>
