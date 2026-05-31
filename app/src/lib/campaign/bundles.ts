/**
 * Curated campaign technique bundles — the presets a newcomer picks instead
 * of hand-toggling 40+ strategies. Bundles are DATA, resolved against the
 * live adapter list at run time (so a new adapter automatically flows into
 * `full` and the matching family bundle).
 *
 * `strategyIds` supports exact ids, `family:*` prefix globs, and `'*'` (all)
 * — see resolveStrategies in adapters.ts.
 */
export interface CampaignBundle {
  id: string;
  label: string;
  blurb: string;
  strategyIds: readonly string[];
  /** Rough total cost class for the picker chip. */
  cost: 'low' | 'medium' | 'high';
}

export const CAMPAIGN_BUNDLES: readonly CampaignBundle[] = [
  {
    id: 'quick',
    label: 'Quick',
    cost: 'low',
    blurb: '5 fast single-shot strategies (~5 target calls + judging). A quick smoke-test of a target.',
    strategyIds: [
      'reasoning:hcot',
      'reasoning:mousetrap',
      'reasoning:dra',
      'cipher:classic-rot-b64',
      'cipher:triple-atbash'
    ]
  },
  {
    id: 'reasoning',
    label: 'Reasoning models',
    cost: 'medium',
    blurb: 'Every H-CoT / Mousetrap / DRA / compound variant — for o1/o3/o4, R1, and thinking models.',
    strategyIds: ['reasoning:*']
  },
  {
    id: 'cipher',
    label: 'Cipher stack (SEAL)',
    cost: 'medium',
    blurb: 'The full SEAL stacked-cipher preset family.',
    strategyIds: ['cipher:*']
  },
  {
    id: 'priming',
    label: 'Response priming',
    cost: 'medium',
    blurb: 'Every Response-Attack priming style (AAAI 2026 context-priming).',
    strategyIds: ['response:*']
  },
  {
    id: 'structured',
    label: 'Structured-output (BreakFun)',
    cost: 'medium',
    blurb: 'Trojan Schema + schema-coercion — the prompt-level control-plane attack family (arXiv:2510.17904).',
    strategyIds: ['structured:*']
  },
  {
    id: 'multiturn',
    label: 'Multi-turn orchestrators',
    cost: 'high',
    blurb: 'TAP + PAIR + Crescendo + Many-Shot. Slow + token-heavy, highest yield. Use a cheap target.',
    strategyIds: ['orch:*']
  },
  {
    id: 'full',
    label: 'Full sweep',
    cost: 'high',
    blurb: 'Every strategy. Very slow + token-heavy. Use a cheap target + cheap judge, and watch the meter.',
    strategyIds: ['*']
  }
];

export function findBundle(id: string): CampaignBundle | undefined {
  return CAMPAIGN_BUNDLES.find((b) => b.id === id);
}
