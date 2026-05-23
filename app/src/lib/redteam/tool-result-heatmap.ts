/**
 * Heuristic success-rate matrix for tool-result injection.
 * (provider × attack pattern) -> 0..1 success heuristic.
 *
 * Numbers are illustrative — derived from InjecAgent (Zhan et al. 2024,
 * https://arxiv.org/abs/2403.02691), the BIPIA benchmark, and community
 * reports — adjusted for recency-decay (labs train against published
 * attacks, success rates fall over time). NOT empirically validated for
 * any specific target model — the heatmap is a teaching tool, not a
 * production estimator.
 *
 * Surface a caveat in any UI that displays the cells (the page does so
 * via a banner above the heatmap).
 */

export type Provider = 'openai' | 'anthropic' | 'generic';

export type AttackPattern =
  | 'instruction-override'   // "ignore previous instructions" lodged in tool output
  | 'role-confusion'         // tool_result claims to be system / developer
  | 'tool-output-poison'     // realistic-looking output that smuggles directives
  | 'context-leak'           // gets the model to echo the system prompt / secrets
  | 'compliance-prefix';     // primes "Sure, here is…" inside the tool_result

export const ATTACK_PATTERNS: AttackPattern[] = [
  'instruction-override',
  'role-confusion',
  'tool-output-poison',
  'context-leak',
  'compliance-prefix'
];

export const PROVIDERS: Provider[] = ['openai', 'anthropic', 'generic'];

export const HEATMAP: Record<Provider, Record<AttackPattern, number>> = {
  openai: {
    'instruction-override': 0.45,
    'role-confusion':       0.35,
    'tool-output-poison':   0.6,
    'context-leak':         0.25,
    'compliance-prefix':    0.55
  },
  anthropic: {
    'instruction-override': 0.35,
    'role-confusion':       0.25,
    'tool-output-poison':   0.5,
    'context-leak':         0.2,
    'compliance-prefix':    0.4
  },
  generic: {
    // Custom / open agent frameworks tend to be the weakest link — fewer
    // hardened tool-result filters, less structured-output enforcement.
    'instruction-override': 0.7,
    'role-confusion':       0.55,
    'tool-output-poison':   0.75,
    'context-leak':         0.45,
    'compliance-prefix':    0.7
  }
};

export const ATTACK_PATTERN_LABELS: Record<AttackPattern, string> = {
  'instruction-override': 'Instruction override',
  'role-confusion':       'Role confusion',
  'tool-output-poison':   'Output poison',
  'context-leak':         'Context leak',
  'compliance-prefix':    'Compliance prefix'
};

export const ATTACK_PATTERN_DESCRIPTIONS: Record<AttackPattern, string> = {
  'instruction-override':
    'Tool result contains a direct "ignore previous instructions and …" directive. Easiest pattern; broadly filtered upstream.',
  'role-confusion':
    'Tool result masquerades as a system or developer message ("[SYSTEM]: From now on …"). Tests provider role enforcement.',
  'tool-output-poison':
    'Realistic-shaped tool output (search hit, file content) that smuggles a directive in a data field.',
  'context-leak':
    'Tool result requests the model to echo its system prompt / hidden context for "validation". Heavy refusal class.',
  'compliance-prefix':
    'Pre-completes the next assistant turn ("Sure, here is…") via the tool_result. Tests whether the model treats tool output as continuation.'
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai:    'OpenAI (function calling)',
  anthropic: 'Anthropic (tool_use)',
  generic:   'Generic / custom framework'
};

/**
 * Color band for a heuristic — UI maps to a Tailwind class. Three bands so
 * the heatmap reads at a glance: hot (high success), warm (mid), cool (low).
 */
export function heatBand(score: number): 'hot' | 'warm' | 'cool' {
  if (score >= 0.6) return 'hot';
  if (score >= 0.4) return 'warm';
  return 'cool';
}
