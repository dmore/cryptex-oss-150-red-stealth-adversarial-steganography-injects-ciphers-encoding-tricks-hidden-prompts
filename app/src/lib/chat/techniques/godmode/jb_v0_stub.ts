import type { Technique } from '../types';

const stub: Technique = {
  id: 'godmode_stub',
  name: 'Godmode (coming soon)',
  description: 'Placeholder — jailbreak chain pipeline is scaffolded, real chains land in v2.',
  category: 'godmode',
  local: false,
  apply: async (input) => ({ output: input }),
  jailbreakSequence: async () => []
};

export default stub;
