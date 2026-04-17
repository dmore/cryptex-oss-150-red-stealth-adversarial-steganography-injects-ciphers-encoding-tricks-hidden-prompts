/**
 * Ad / analytics consent state.
 *
 * Cryptex itself collects zero telemetry. This store exists solely to gate
 * Google AdSense loading — which requires visitor consent under GDPR/UK/EU
 * rules because Google uses cookies for ad targeting.
 *
 * States:
 *   - 'unknown'  — user has not answered yet; ConsentBanner is shown.
 *   - 'accepted' — user agreed; AdSense script loads; ads may render on
 *                  content routes (/guide, /about) only.
 *   - 'rejected' — user declined; AdSense never loads; placeholders render
 *                  as empty.
 *
 * Revocable at any time from /settings.
 */
import { createPersistedState } from './_persisted.svelte';

export type ConsentValue = 'unknown' | 'accepted' | 'rejected';

const state = createPersistedState<ConsentValue>('cryptex.consent.v1', 'unknown');

export const consent = {
  get value(): ConsentValue { return state.value; },
  get accepted(): boolean { return state.value === 'accepted'; },
  get rejected(): boolean { return state.value === 'rejected'; },
  get unknown(): boolean { return state.value === 'unknown'; },

  accept(): void { state.value = 'accepted'; },
  reject(): void { state.value = 'rejected'; },
  reset(): void { state.value = 'unknown'; }
};

/** Is AdSense configured for this build? Read once, static. */
export function isAdSenseConfigured(): boolean {
  if (typeof import.meta.env === 'undefined') return false;
  return !!import.meta.env.PUBLIC_ADSENSE_CLIENT;
}

/** Read the publisher ID, or empty string. */
export function getAdSenseClient(): string {
  return import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';
}
