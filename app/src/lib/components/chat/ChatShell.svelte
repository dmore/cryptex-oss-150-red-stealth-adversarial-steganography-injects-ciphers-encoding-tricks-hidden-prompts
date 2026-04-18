<script lang="ts">
  import ChatSidebar from './sidebar/ChatSidebar.svelte';
  import TechniquesSidebar from './techniques/TechniquesSidebar.svelte';
  import SelectionPopover from './techniques/SelectionPopover.svelte';
  import DatasetFooter from './footer/DatasetFooter.svelte';
  let { children } = $props();
</script>

<div class="grid h-[calc(100vh-7rem)] gap-3
            grid-cols-[240px_minmax(0,1fr)]
            lg:grid-cols-[240px_minmax(0,1fr)_280px]">
  <aside class="glass rounded-lg border border-white/10 p-3 overflow-hidden">
    <ChatSidebar />
  </aside>
  <section class="glass rounded-lg border border-white/10 p-3 overflow-hidden flex flex-col">
    {@render children?.()}
  </section>
  <aside class="glass rounded-lg border border-white/10 p-3 overflow-hidden hidden lg:block">
    <TechniquesSidebar />
  </aside>
</div>
<SelectionPopover />
<DatasetFooter />
