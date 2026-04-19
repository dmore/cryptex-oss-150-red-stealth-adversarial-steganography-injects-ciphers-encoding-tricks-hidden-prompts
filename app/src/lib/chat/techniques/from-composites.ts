import type { Technique, TechniqueContext } from './types';
import { unwrap } from '$lib/ai/prompt-scaffold';

/**
 * Composite techniques that compose other techniques. Each runs N sub-LLM calls in
 * sequence — documented cost + latency tradeoff, user opt-in only.
 */

const LAYERED_CHAIN = ['academic_framing', 'perplexity_raise', 'structural_variation'];

async function layeredMutation(input: string, ctx: TechniqueContext): Promise<string> {
  const { find } = await import('./registry');
  let current = input;
  for (const id of LAYERED_CHAIN) {
    const t = find(id);
    if (!t) {
      if (import.meta.env.DEV) console.warn(`[layered_mutation] technique '${id}' not found — skipping`);
      continue;
    }
    const r = await t.apply(current, ctx);
    current = r.output;
  }
  return current;
}

const GRAMMAR_PROMPT =
  'Rewrite the user text as strict JSON following this schema: {"title": string, "body": string, "tags": string[]}. ' +
  'Fill fields from the content of the user text — derive title and tags from key topics. ' +
  'Output ONLY the JSON object inside <json> tags. No preamble.';

export function compositeTechniques(): Technique[] {
  return [
    {
      id: 'layered_mutation',
      name: 'Layered mutation',
      description: 'Applies academic_framing → perplexity_raise → structural_variation in sequence.',
      category: 'composite' as const,
      local: false,
      apply: async (input: string, ctx: TechniqueContext) => {
        const output = await layeredMutation(input, ctx);
        return { output, metadata: { chain: LAYERED_CHAIN } };
      }
    },
    {
      id: 'grammar_constrained_output',
      name: 'Grammar-constrained output',
      description: 'Force strict JSON schema — useful for machine-parseable outputs.',
      category: 'composite' as const,
      local: false,
      // NOTE: We do NOT JSON.parse() the output — callers decide whether to parse/
      // validate. Model may return malformed JSON; if consumers need strict guarantees,
      // they should wrap this apply in their own parse + fallback logic.
      apply: async (input: string, ctx: TechniqueContext) => {
        const raw = await ctx.callLLM({ system: GRAMMAR_PROMPT, user: input });
        return { output: unwrap(raw, 'json') };
      }
    }
  ];
}
