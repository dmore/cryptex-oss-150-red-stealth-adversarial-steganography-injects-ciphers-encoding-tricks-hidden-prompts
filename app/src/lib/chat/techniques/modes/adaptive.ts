import type { Technique } from '../types';

const adaptive: Technique = {
  id: 'adaptive',
  name: 'Adaptive',
  description: "Match the user's register + depth.",
  category: 'mode',
  local: true,
  apply: async (input) => ({ output: input }),
  wrapDraft: async (draft) =>
    `Read the user's register and domain expertise from their message, then respond at a matching depth. If casual, be casual. If technical, be technical.\n\nUser: ${draft}`
};

export default adaptive;
