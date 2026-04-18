<script lang="ts">
  import { onMount } from 'svelte';
  type Props = { onFiles: (files: File[]) => void };
  let { onFiles }: Props = $props();
  let dragging = $state(false);

  onMount(() => {
    const enter = () => { dragging = true; };
    const leave = (e: DragEvent) => { if (e.target === document.documentElement) dragging = false; };
    const over = (e: DragEvent) => { e.preventDefault(); };
    const drop = (e: DragEvent) => {
      e.preventDefault(); dragging = false;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  });
</script>

{#if dragging}
  <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
    <p class="rounded-lg border border-white/15 bg-card/80 px-4 py-2 text-sm">Drop files to attach</p>
  </div>
{/if}
