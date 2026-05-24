<script lang="ts">
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import BijectionTool from '$lib/components/tools/bijection/BijectionTool.svelte';
</script>

<ToolShell
  toolId="bijection"
  title="Bijection alphapr"
  accent="alphapr"
  description={'Generate character-to-token substitution mappings and wrap your input in a teaching prompt ("learn my language called alphapr"). Multiple variants per run for research-grade prompt fuzzing.'}
  usage={{
    title: 'Bijection alphapr · Usage',
    bullets: [
      'Generates char→token bijections wrapped in a teaching prompt.',
      'Budget controls how many variants per run.',
      'Larger fixed-size = more leading chars un-mapped (lower noise).',
      'Use Shuffle to permute the same mapping; Regen for a new one.',
      '1 MB input cap — payload size is bounded per pass.'
    ]
  }}
>
  <BijectionTool />
</ToolShell>
