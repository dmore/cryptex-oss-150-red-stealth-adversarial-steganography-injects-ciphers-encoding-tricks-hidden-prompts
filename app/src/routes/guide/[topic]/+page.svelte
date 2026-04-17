<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import { guideBySlug } from '$lib/guide';

  const topic = $derived($page.params.topic ?? '');
  const entry = $derived(topic ? guideBySlug[topic] : undefined);

  let article: HTMLElement | undefined = $state();

  /**
   * Rewrite root-absolute `/guide/...` links inside the compiled markdown so
   * they include the runtime `BASE_PATH` prefix (empty on root deploys, e.g.
   * "/cryptex" on subpath deploys). This lets markdown stay portable while
   * still working on any deployment.
   */
  function rewriteGuideLinks() {
    if (!article) return;
    const anchors = article.querySelectorAll<HTMLAnchorElement>('a[href^="/guide/"]');
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      if (base && !href.startsWith(base + '/')) {
        a.setAttribute('href', base + href);
      }
    }
  }

  onMount(() => {
    if (!entry) {
      goto(`${base}/guide/`, { replaceState: true });
    }
  });

  // Re-scan anchors every time the topic changes.
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    entry;
    tick().then(rewriteGuideLinks);
  });
</script>

{#if entry}
  {@const SvelteComponent = entry.component}
  <article
    bind:this={article}
    class="prose prose-sm max-w-none dark:prose-invert
           prose-headings:font-serif prose-headings:tracking-tight
           prose-a:text-primary prose-a:no-underline hover:prose-a:underline
           prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-[0.85em]
           prose-pre:bg-background/80 prose-pre:border prose-pre:border-border prose-pre:text-foreground
           prose-pre:rounded-lg
           prose-strong:text-foreground
           prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
           prose-hr:border-border"
  >
    <SvelteComponent />
  </article>
{:else}
  <div class="flex min-h-[40vh] items-center justify-center text-muted-foreground">
    <span class="animate-pulse">Loading…</span>
  </div>
{/if}
