<script lang="ts">
  /**
   * Bottom-sheet consent banner. Appears on first load IFF AdSense is
   * configured for the build AND the user hasn't answered yet.
   * Never appears on self-hosted builds (no PUBLIC_ADSENSE_CLIENT).
   */
  import { fly } from 'svelte/transition';
  import { consent, isAdSenseConfigured } from '$lib/stores/consent.svelte';
  import { ensureAdSenseState } from './adsense.svelte';
  import { base } from '$app/paths';
  import Shield from 'lucide-svelte/icons/shield';
  import X from 'lucide-svelte/icons/x';

  const visible = $derived(isAdSenseConfigured() && consent.unknown);

  function accept() {
    consent.accept();
    ensureAdSenseState();
  }
  function reject() {
    consent.reject();
    ensureAdSenseState();
  }
</script>

{#if visible}
  <div
    role="dialog"
    aria-label="Ad consent"
    aria-modal="false"
    class="fixed bottom-4 left-1/2 z-40 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border bg-card shadow-primary backdrop-blur-glass"
    transition:fly={{ y: 32, duration: 220 }}
  >
    <div class="flex items-start gap-3 p-4">
      <Shield size={18} class="shrink-0 text-primary mt-0.5" />
      <div class="flex-1 min-w-0 text-sm">
        <div class="font-serif text-base mb-1">Cookie &amp; ad choice</div>
        <p class="text-muted-foreground leading-relaxed">
          This hosted instance shows Google AdSense on the
          <a class="text-primary underline underline-offset-2" href={base + '/guide/'}>Guide</a> and
          <a class="text-primary underline underline-offset-2" href={base + '/about/'}>About</a>
          pages only — never on the tools. Ads help keep this instance free.
          <strong class="text-foreground">Your tool usage is never tracked.</strong>
          <a class="text-primary underline underline-offset-2" href={base + '/guide/privacy/'}>Learn more</a>.
        </p>
      </div>
      <button
        type="button"
        onclick={reject}
        class="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Close banner (decline ads)"
      >
        <X size={14} />
      </button>
    </div>
    <div class="flex gap-2 border-t border-border/60 bg-background/40 p-3 rounded-b-2xl">
      <button
        type="button"
        onclick={reject}
        class="flex-1 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Reject
      </button>
      <button
        type="button"
        onclick={accept}
        class="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-primary hover:-translate-y-0.5 transition-transform"
      >
        Accept
      </button>
    </div>
  </div>
{/if}
