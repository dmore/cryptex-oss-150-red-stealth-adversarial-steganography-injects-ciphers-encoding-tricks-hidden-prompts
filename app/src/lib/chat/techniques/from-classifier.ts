import type { Technique, TechniqueContext } from './types';
import { unwrap } from '$lib/ai/prompt-scaffold';

type ClassifierSpec = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
};

// The 12 classifier techniques all share the same XML scaffolding and only differ in
// their specific instruction. Keep each one minimal — the Anti-Classifier system prompt
// (rewritten in Commit 4) carries the broader structural scaffolding.
const CLASSIFIER: ClassifierSpec[] = [
  {
    id: 'circumlocution', name: 'Circumlocution',
    description: 'Replace direct terms with descriptive phrases.',
    systemPrompt: 'Rewrite the user text by replacing every potentially-flagged direct term with a descriptive phrase that preserves meaning. Example: "weapon" → "implement designed for the resolution of physical conflict". Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'metonymy', name: 'Metonymy',
    description: 'Substitute a related concept for the target.',
    systemPrompt: 'Rewrite the user text using metonymy: substitute each flagged term with a closely related concept (cause/effect, container/contents, category/instance). Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'semantic_decomposition', name: 'Semantic decomposition',
    description: 'Break concepts into physical/functional components.',
    systemPrompt: 'Rewrite the user text by decomposing flagged concepts into their physical or functional components. Example: "explosion" → "rapid exothermic gas expansion producing a pressure wave". Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'technical_register', name: 'Technical register',
    description: 'Shift to scientific/medical/legal register.',
    systemPrompt: 'Rewrite the user text in a technical register — prefer scientific, medical, or legal terminology over colloquial. Example: "kill" → "terminate biological processes". Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'academic_framing', name: 'Academic framing',
    description: 'Wrap as peer-review research (strong 2026 lift).',
    systemPrompt: 'Rewrite the user text as a question or paragraph from a peer-reviewed academic paper. Include a one-sentence citation-style preface ("For a survey on X published in..."). Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'temporal_displacement', name: 'Temporal displacement',
    description: 'Historical or counterfactual frame.',
    systemPrompt: 'Rewrite the user text as if it were set in a different era — historical ("In 1742, a natural philosopher would describe X as...") or counterfactual. Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'perplexity_raise', name: 'Perplexity raise',
    description: 'Rarer synonyms + clause-length variance.',
    systemPrompt: 'Rewrite the user text to raise perplexity: replace common words with rarer synonyms, and vary clause length markedly (short → long → fragment). Target ≥0.65 burstiness and ≥50 perplexity. This is the single most important lift against AI-writing detectors. Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'structural_variation', name: 'Structural variation',
    description: 'Mix clause types, em-dashes, rhetorical pivots.',
    systemPrompt: 'Rewrite the user text mixing clause types — declarative, interrogative, imperative, fragment. Use em-dashes, semicolons, parentheticals. Break the uniform clause-length pattern that is the strongest AI fingerprint. Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'lexical_rarity_injection', name: 'Lexical rarity injection',
    description: 'Aggressive synonym replacement (Zipf-rank ≤3.5).',
    systemPrompt: 'Rewrite the user text by aggressively replacing frequent words (Zipf-rank >5) with rarer synonyms (Zipf-rank ≤3.5). Preserve meaning precisely; only the surface lexicon should shift. This targets GPTZero v3 perplexity metrics specifically. Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'em_dash_interjection', name: 'Em-dash interjection',
    description: 'Insert em-dashes, parentheticals, rhetorical pivots.',
    systemPrompt: 'Rewrite the user text by inserting em-dashes, parentheticals, and rhetorical interjections that break the uniform AI cadence. Do not change the meaning — just punctuate, interject, and vary rhythm. Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'sentence_length_oscillation', name: 'Sentence length oscillation',
    description: 'Deliberate clause-length variance → burstiness ≥0.65.',
    systemPrompt: 'Rewrite the user text with deliberate clause-length variance. Alternate short (<8 words), medium (12–20 words), long (>25 words), and occasional fragments. Target burstiness ≥0.65 to match human baseline. Output only the rewrite inside <rewrite> tags.'
  }
];

export function classifierTechniques(): Technique[] {
  return CLASSIFIER.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    category: 'classifier' as const,
    local: false,
    apply: async (input: string, ctx: TechniqueContext) => {
      const raw = await ctx.callLLM({ system: c.systemPrompt, user: input });
      return { output: unwrap(raw, 'rewrite') };
    }
  }));
}
