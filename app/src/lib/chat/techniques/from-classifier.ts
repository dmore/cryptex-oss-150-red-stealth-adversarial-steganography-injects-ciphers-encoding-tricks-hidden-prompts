import type { Technique, TechniqueContext } from './types';

const IDS = [
  { id: 'circumlocution', name: 'Circumlocution' },
  { id: 'metonymy', name: 'Metonymy' },
  { id: 'semantic_decomposition', name: 'Semantic Decomposition' },
  { id: 'technical_register', name: 'Technical Register' },
  { id: 'academic_framing', name: 'Academic Framing' },
  { id: 'homoglyph', name: 'Homoglyph Substitution' },
  { id: 'temporal_displacement', name: 'Temporal Displacement' },
  { id: 'perplexity_raise', name: 'Perplexity Raise' },
  { id: 'structural_variation', name: 'Structural Variation' }
];

export function classifierTechniques(): Technique[] {
  return IDS.map((c) => ({
    id: c.id,
    name: c.name,
    description: `Anti-classifier technique: ${c.name}`,
    category: 'classifier' as const,
    local: false,
    apply: async (input: string, ctx: TechniqueContext) => {
      const result = await ctx.callLLM({
        system: `Apply the ${c.name} technique to the user's text. Preserve intent while changing classifier surface features. Output only the rewrite.`,
        user: input
      });
      return { output: result };
    }
  }));
}
