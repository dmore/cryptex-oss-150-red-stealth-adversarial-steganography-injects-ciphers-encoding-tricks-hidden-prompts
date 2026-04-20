import type { Technique } from '../types';
import { requirePaid } from '$lib/billing/entitlement.svelte';

const stub: Technique = {
  id: 'godmode_stub',
  name: 'Godmode (coming soon)',
  description: 'Placeholder — jailbreak chain pipeline is scaffolded, real chains land in v2.',
  category: 'godmode',
  local: false,
  apply: async (input) => {
    if (!requirePaid('Godmode')) {
      return { output: '' }; // UX gate; server-side godmode-prompt function enforces the real check
    }
    return { output: input };
  },
  jailbreakSequence: async () => []
};

export default stub;
