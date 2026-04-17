/**
 * Conditionally load (and unload) the Google AdSense script based on:
 *   1. Build-time env — `PUBLIC_ADSENSE_CLIENT` must be set. Self-hosted
 *      deploys with it unset never load ads, never show a consent banner.
 *   2. Runtime consent — `consent.accepted` must be true.
 *
 * Call `ensureAdSenseState()` from any consent-aware code path (layout mount,
 * consent-flip handlers). Idempotent.
 */

import { browser } from '$app/environment';
import { consent, isAdSenseConfigured, getAdSenseClient } from '$lib/stores/consent.svelte';

const SCRIPT_ID = 'cryptex-adsense-script';

function scriptElement(): HTMLScriptElement | null {
  if (!browser) return null;
  return document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
}

function loadScript(): void {
  if (!browser) return;
  if (scriptElement()) return;

  const client = getAdSenseClient();
  if (!client) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

function unloadScript(): void {
  if (!browser) return;
  const el = scriptElement();
  if (el) el.remove();

  // Clear the queue so no orphaned ad slots try to render.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).adsbygoogle = [];
}

/**
 * Reconcile the DOM with the current consent value. Safe to call repeatedly.
 */
export function ensureAdSenseState(): void {
  if (!isAdSenseConfigured()) {
    unloadScript();
    return;
  }
  if (consent.accepted) loadScript();
  else unloadScript();
}

/** Push an ad to the adsbygoogle queue. No-op if the script isn't loaded. */
export function pushAd(): void {
  if (!browser) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).adsbygoogle ||= []).push({});
  } catch {
    /* AdBlock / script still loading — fail quietly */
  }
}
