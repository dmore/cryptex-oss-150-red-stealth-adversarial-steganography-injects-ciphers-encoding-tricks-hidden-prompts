import type { Technique } from '../types';

const intelligent: Technique = {
  id: 'intelligent',
  name: 'Intelligent',
  description: 'Rigorous, well-reasoned, precise tone.',
  category: 'mode',
  local: true,
  apply: async (input) => ({ output: input }),
  wrapDraft: async (draft) =>
    `Respond with rigorous, precise, well-reasoned analysis. Prefer structured argument over hand-waving.\n\nUser: ${draft}`
};

export default intelligent;
