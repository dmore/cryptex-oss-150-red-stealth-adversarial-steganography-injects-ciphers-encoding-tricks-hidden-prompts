<script lang="ts">
  interface Props { title: string; description?: string }
  let { title, description = '' }: Props = $props();
</script>

<section class="mx-auto max-w-xl space-y-5 rounded-2xl border border-border bg-card/50 p-10 text-center shadow-glass">
  <div class="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">
    <span class="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>
    In the lab
  </div>
  <h1 class="font-serif text-3xl tracking-tight">{title}</h1>
  {#if description}
    <p class="text-muted-foreground text-sm sm:text-base leading-relaxed">{description}</p>
  {/if}
  <p class="pt-2 text-xs text-muted-foreground">
    Arriving in Phase 1 · 2. Gibberish is already live — try it first.
  </p>
</section>
