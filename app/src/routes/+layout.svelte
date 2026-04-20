<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import HeaderBar from '$lib/components/shell/HeaderBar.svelte';
  import TabRail from '$lib/components/shell/TabRail.svelte';
  import ToastHost from '$lib/components/shell/ToastHost.svelte';
  import HistoryDrawer from '$lib/components/shell/HistoryDrawer.svelte';
  import ConsentBanner from '$lib/ads/ConsentBanner.svelte';
  import UpgradeModal from '$lib/components/billing/UpgradeModal.svelte';
  import { apply as applyTheme, watchSystemTheme } from '$lib/stores/theme.svelte';
  import { runLegacyMigration } from '$lib/stores/_migrate';
  import { initCatalogStore } from '$lib/ai/catalog.svelte';
  import { ensureAdSenseState } from '$lib/ads/adsense.svelte';
  import { chatMode } from '$lib/stores/chatMode.svelte';

  let { children } = $props();
  let historyOpen = $state(false);

  onMount(() => {
    runLegacyMigration();
    applyTheme();
    initCatalogStore();
    ensureAdSenseState();
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
    {#if chatMode.value === 'tools'}
      <div class="mb-6"><TabRail /></div>
    {/if}
    <div class="fade-in">
      {@render children?.()}
    </div>
  </main>

  <footer class="container py-8 text-xs text-muted-foreground">
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
      <span>
        Cryptex · local-first text lab · 162 transforms, zero telemetry · by
        <a
          href="https://github.com/m4xx101"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline underline-offset-2 hover:text-primary/80"
        >@m4xx101</a>
      </span>
      <a
        href="https://github.com/m4xx101/cryptex"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono hover:text-foreground"
      >
        github.com/m4xx101/cryptex
      </a>
    </div>
  </footer>

  <HistoryDrawer open={historyOpen} onclose={() => (historyOpen = false)} />
  <ConsentBanner />
  <UpgradeModal />
  <ToastHost />
</div>
