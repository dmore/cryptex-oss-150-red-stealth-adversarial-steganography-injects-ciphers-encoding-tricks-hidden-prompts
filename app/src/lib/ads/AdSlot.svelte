<script lang="ts">
  /**
   * Defensive ad slot. Renders nothing unless:
   *   - AdSense is configured at build time (`PUBLIC_ADSENSE_CLIENT` set), AND
   *   - The current route is in the allow-list (tool pages are forbidden), AND
   *   - The user has consented.
   *
   * When disabled, renders a zero-height `<div>` so layout doesn't shift.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { consent, isAdSenseConfigured, getAdSenseClient } from '$lib/stores/consent.svelte';
  import { pushAd } from './adsense.svelte';

  interface Props {
    /** Named slot for styling + analytics differentiation. */
    slot: 'header' | 'sidebar' | 'footer';
    /** AdSense ad slot id, if you've configured per-slot IDs in your AdSense dashboard. */
    adSlot?: string;
    /** Tailwind height/width class override. */
    class?: string;
  }
  let { slot, adSlot = '', class: klass = '' }: Props = $props();

  /**
   * Routes on which ads are allowed. Every tool route is forbidden —
   * red-team prompt content never sits next to third-party ad scripts.
   */
  const ALLOWED_PREFIXES = ['/guide', '/about', '/_404'];

  const pathname = $derived($page.url.pathname);
  const routeAllowed = $derived(ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')));
  const shouldRender = $derived(isAdSenseConfigured() && consent.accepted && routeAllowed);

  const sizeClass = $derived(
    slot === 'header'   ? 'min-h-[90px]' :
    slot === 'sidebar'  ? 'min-h-[250px]' :
                          'min-h-[120px]'
  );

  // Trigger adsbygoogle.push once the ins is in the DOM.
  onMount(() => {
    if (shouldRender) pushAd();
  });
</script>

{#if shouldRender}
  <div class={`my-4 ${sizeClass} ${klass}`.trim()} aria-label="Advertisement">
    <ins
      class="adsbygoogle block"
      style="display:block"
      data-ad-client={getAdSenseClient()}
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  </div>
{/if}
