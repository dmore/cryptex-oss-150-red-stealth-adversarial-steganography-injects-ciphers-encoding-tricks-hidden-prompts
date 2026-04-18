import type { Technique } from '../types';

const creative: Technique = {
  id: 'creative',
  name: 'Creative',
  description: 'Vivid, narrative, exploratory tone.',
  category: 'mode',
  local: true,
  apply: async (input) => ({ output: input }),
  wrapDraft: async (draft) =>
    `Respond with vivid, creative, exploratory narrative energy — use concrete sensory details.\n\nUser: ${draft}`
};

export default creative;
