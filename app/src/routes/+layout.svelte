<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import HeaderBar from '$lib/components/shell/HeaderBar.svelte';
  import TabRail from '$lib/components/shell/TabRail.svelte';
  import ToastHost from '$lib/components/shell/ToastHost.svelte';
  import HistoryDrawer from '$lib/components/shell/HistoryDrawer.svelte';
  import { apply as applyTheme, watchSystemTheme } from '$lib/stores/theme.svelte';
  import { runLegacyMigration } from '$lib/stores/_migrate';
  import { initCatalogStore } from '$lib/ai/catalog.svelte';

  let { children } = $props();
  let historyOpen = $state(false);

  // TabRail visible on tool routes + the home redirect. Hidden on:
  //   - auth-form pages (login / signup / auth callback) — focus the form
  //   - legal / content pages (privacy / terms / about) — read top-to-bottom
  //   - settings — has its own internal sidebar nav
  //   - guide — has its own internal sidebar nav
  const hideTabRail = $derived.by(() => {
    const p = page.url?.pathname ?? '';
    const trimmed = p.endsWith('/') ? p.slice(0, -1) : p;
    return (
      trimmed === `${base}/login` ||
      trimmed === `${base}/signup` ||
      trimmed.startsWith(`${base}/auth/`) ||
      trimmed === `${base}/privacy` ||
      trimmed === `${base}/terms` ||
      trimmed === `${base}/about` ||
      trimmed === `${base}/settings` ||
      trimmed === `${base}/guide` ||
      trimmed.startsWith(`${base}/guide/`)
    );
  });

  onMount(() => {
    runLegacyMigration();
    applyTheme();
    initCatalogStore();
    return watchSystemTheme();
  });
</script>

<div class="relative min-h-screen">
  <!-- Subtle radial backdrop (premium cryptography lab vibe) -->
  <div
    aria-hidden="true"
    class="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
  >
    <div
      class="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 60%);"
    ></div>
    <div
      class="absolute -bottom-40 right-1/4 h-[30rem] w-[30rem] rounded-full opacity-20 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--accent) / 0.3), transparent 60%);"
    ></div>
  </div>

  <HeaderBar onopenHistory={() => (historyOpen = true)} />

  <main class="container pt-6 pb-20">
    {#if !hideTabRail}
      <div class="mb-6"><TabRail /></div>
    {/if}
    <div class="fade-in">
      {@render children?.()}
    </div>
  </main>

  <footer class="container py-6 text-xs text-muted-foreground">
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
      <span class="font-mono text-[11px] tracking-wide">
        © {new Date().getFullYear()} Cryptex
      </span>
      <nav aria-label="Footer" class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-wide">
        <a href={base + '/privacy/'} class="transition-colors hover:text-foreground">Privacy</a>
        <a href={base + '/terms/'} class="transition-colors hover:text-foreground">Terms</a>
        <a href={base + '/about/'} class="transition-colors hover:text-foreground">About</a>
        <a
          href="https://github.com/m4xx101"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          aria-label="github.com/m4xx101"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
          </svg>
          github.com/m4xx101
        </a>
      </nav>
    </div>
  </footer>

  <HistoryDrawer open={historyOpen} onclose={() => (historyOpen = false)} />
  <ToastHost />
</div>
