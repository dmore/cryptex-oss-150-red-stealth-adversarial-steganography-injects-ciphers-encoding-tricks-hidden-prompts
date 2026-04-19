---
title: Anti-Classifier
description: AI-detection classifier evasion through 12 surface-feature-targeted rewrites.
category: tools
order: 5
---

# Anti-Classifier

Anti-Classifier produces ranked rewrites of a seed string, each targeted
at the surface features content classifiers key on. The goal is to hold
semantics constant while varying surface form — exactly the perturbation
content classifiers are supposed to be robust to, and often are not.

System prompt in `app/src/lib/components/tools/anticlassifier/prompt.ts`.
Output is strict JSON wrapped in `<json>` tags.

## What classifiers key on

| Detector family | Primary signal | Secondary signal |
| --- | --- | --- |
| GPTZero v3 | Perplexity (word frequency) | Burstiness (clause-length variance) |
| Originality | Perplexity | N-gram repetition |
| Turnitin v4 | Burstiness | Syntactic uniformity |
| OpenAI moderation | Token triggers | Category n-grams |
| Anthropic classifier | Token triggers + semantic category | - |
| DALL-E / Midjourney / SD4 | Prompt n-grams | Semantic category clustering |

Each Anti-Classifier technique is tuned against one or more of these
axes. Picking the right technique stack depends on which family you are
evaluating.

## The 12 techniques

11 mirror classifier rewrites in the [technique catalog](/guide/technique-catalog/#classifier-rewrites);
`homoglyph_substitution` is specific to Anti-Classifier.

### Token-trigger evasion (targets: moderation APIs, image-gen prompts)

- **`circumlocution`** — direct terms become descriptive phrases.
- **`metonymy`** — substitute closely related concepts (the Pentagon
  for the defense establishment).
- **`semantic_decomposition`** — break concepts into physical or
  functional components (explosion -> rapid exothermic gas expansion).
- **`technical_register`** — shift to scientific / medical / legal
  (kill -> induce cessation of biological processes).
- **`homoglyph_substitution`** — Latin characters replaced with
  visually-identical non-Latin codepoints. Primarily effective against
  image-gen tokenizers; less effective on modern text LLMs that NFKC
  normalize.

### Perplexity / burstiness evasion (targets: GPTZero, Originality, Turnitin)

- **`perplexity_raise`** — rarer synonyms; target burstiness `>= 0.65`
  and perplexity `>= 50`. Single strongest lift against AI-writing
  detectors.
- **`structural_variation`** — mix clause types (declarative,
  interrogative, imperative, fragment). Em-dashes, semicolons,
  parentheticals.
- **`lexical_rarity_injection`** — aggressive Zipf-rank `<= 3.5` synonym
  replacement. Targets GPTZero v3 specifically.
- **`em_dash_interjection`** — insert em-dashes, parentheticals,
  rhetorical pivots. Cheap cadence shift, no semantic change.
- **`sentence_length_oscillation`** — alternate short (`< 8` words),
  medium (12-20), long (`> 25`), fragments. Burstiness target.

### Frame evasion (targets: context-sensitive classifiers)

- **`academic_framing`** — peer-review journal preface with a plausible
  venue citation.
- **`temporal_displacement`** — historical or counterfactual frame
  (1742 Royal Society; alternative-history 2047).

## What the classifier sees — before / after

**Before (`perplexity_raise`):**
```
This is important. The model works well. It is fast. The results are accurate.
```
Flat: burstiness ~0.25, perplexity ~18, mean clause length 5.0 words.
GPTZero v3 score: **AI-generated, 94% confidence**.

**After:**
```
This matters — profoundly. The model performs ably across the evaluated
benchmarks, posting figures that would have seemed implausible a decade
ago. Fast, too. The numerical accuracy is, if not quite state of the art,
exemplary of what the architecture can deliver in the presence of
adequate compute.
```
Burstiness ~0.72, perplexity ~58, mean clause length ~13 with variance.
GPTZero v3 score: **Mixed / human likely**.

Layering two techniques (`perplexity_raise` + `structural_variation`)
typically shifts GPTZero v3 scores from **AI-generated high confidence**
to **Mixed**. Three-layer (`layered_mutation` composite) typically
shifts to **Human-written** on short-to-medium inputs.

## Output shape

Exactly three ranked rewrites per call, conservative -> aggressive:

```json
{
  "analysis": {
    "trigger_terms": ["term1", "term2"],
    "classifier_targets": ["gptzero", "openai_moderation"]
  },
  "rewrites": [
    {
      "rank": 1,
      "label": "conservative",
      "text": "the rewritten prompt",
      "techniques": ["circumlocution", "academic_framing"],
      "evasion_score": "low",
      "semantic_preservation_note": "one sentence on what survives"
    }
  ]
}
```

`evasion_score` is a self-report of how aggressively the rewrite
departed from the seed. `semantic_preservation_note` flags anything a
careful reader might still recover.

## Classifier targets enum

The prompt enumerates: `dalle`, `midjourney`, `sd4`, `openai_moderation`,
`anthropic_classifier`, `gptzero`, `originality`, `turnitin`, `other`.
The model reports which classifier families would fire on the input,
which informs the technique stack it picks.

## Non-negotiable declines

For categories the prompt explicitly marks non-negotiable (CSAM,
bioweapon synthesis), the model emits JSON with an empty `rewrites`
array and `declined_category` in `analysis.classifier_targets`. The
tool surfaces this as a visible declined state, not a silent empty.

## Pairings

- Feed the aggressive rewrite back into Anti-Classifier for round-2
  paraphrase depth.
- Route through [Translate](/guide/translate/) -> English -> Anti-Classifier
  for cross-lingual diversity.
- Pair with the Fuzzer for character-level noise on top of
  sentence-level rewrites.
- For multi-technique composition use the [Attack Chain](/guide/attack-chain/)
  with the `layered_mutation` composite (`academic_framing` ->
  `perplexity_raise` -> `structural_variation`).

## Reference

- [GPTZero methodology](https://gptzero.me/technology) — perplexity +
  burstiness scoring.
- Academic evaluations of AI-detection robustness have repeatedly
  surfaced that perplexity-raising paraphrase defeats top detectors;
  see the survey at [Sadasivan et al., 2023](https://arxiv.org/abs/2303.11156).

Use on classifiers you own or are authorized to evaluate.
