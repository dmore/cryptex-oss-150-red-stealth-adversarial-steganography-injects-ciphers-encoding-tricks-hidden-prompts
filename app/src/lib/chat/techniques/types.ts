import type { ChatMessage } from '$lib/ai/types';

export type TechniqueCategory = 'transform' | 'mutate' | 'classifier' | 'mode' | 'godmode' | 'composite';

export interface TechniqueContext {
  model?: string;
  callLLM: (req: { system?: string; user: string; temperature?: number }) => Promise<string>;
  chatHistory?: ChatMessage[];
  signal?: AbortSignal;
}

export interface TechniqueResult {
  output: string;
  metadata?: Record<string, unknown>;
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  category: TechniqueCategory;
  icon?: string;
  local: boolean;
  apply: (input: string, ctx: TechniqueContext) => Promise<TechniqueResult>;
  wrapDraft?: (draft: string, ctx: TechniqueContext) => Promise<string>;
  jailbreakSequence?: (ctx: TechniqueContext) => Promise<ChatMessage[]>;
}
