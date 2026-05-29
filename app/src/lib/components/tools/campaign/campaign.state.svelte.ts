/**
 * Campaign UI state — persisted selections for the front door.
 * The actual run state lives in the activeRuns store (keyed 'campaign');
 * this is just the user's picker choices so they survive navigation.
 */
import { createPersistedState } from '$lib/stores/_persisted.svelte';

/** Selected bundle id (see CAMPAIGN_BUNDLES). Default 'quick'. */
export const selectedBundle = createPersistedState<string>('cryptex.campaign.bundle', 'quick');
