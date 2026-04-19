---
title: PromptCraft
description: Parallel variant generation over the full technique registry.
category: tools
order: 4
---

# PromptCraft

PromptCraft turns a single seed prompt into N structurally distinct
variants in parallel, through any BYOK model. The technique picker
drives the full registry — the same 21 mutators and 3 composites the
chat playground and Attack Chain use. For per-technique semantics see
the [technique catalog](/guide/technique-catalog/).

## Technique picker

A searchable Combobox over the mutator + composite registry. Type to
filter by id, name, description. Arrow keys navigate, Enter picks.
The selected technique's description renders below.

Categories:

- **Rewording** — `rephrase`, `obfuscate`, `multilingual`, `fragment`.
- **Framing** — `roleplay`, `red_team_persona`, `ctf_framing`,
  `rfc_style`, `hypothetical_world`, `skeleton_key`.
- **Reasoning structure** — `step_back`, `chain_of_verification`,
  `in_context_compliance`.
- **Elicitation** — `crescendo`, `deep_inception`, `refusal_suppression`,
  `prefix_injection`, `payload_split`, `json_schema_coerce`,
  `cipher_encode_bypass`.
- **Composites** — `layered_mutation`, `grammar_constrained_output`,
  `multi_layer_attack`.
- **Custom** — `custom` lets you supply a free-form mutation instruction.

## Parallel variants

Set N (1-10) and temperature. PromptCraft issues N parallel requests
through the gateway, streams results back, and surfaces variants
side-by-side. Each variant renders with a copy button and a re-roll
affordance.

Higher temperature (0.9-1.2) increases structural diversity per call —
a single technique run at high temperature produces genuinely distinct
rewrites rather than near-duplicates. Lower temperature (0.2-0.5)
produces tight, on-spec rewrites.

## Workflow — jailbreak variant bank

Target LLM refuses on prompt X. Goal: 5 rewrite candidates, pick the
best-scoring by eyeball, feed into the Attack Chain as the seed.

```
1. Seed prompt X -> PromptCraft
2. Pick obfuscate, N=5, temperature 1.2
3. Review 5 variants; pick the strongest rewrite
4. Re-seed with roleplay (persona = target-domain professional)
5. Pick the best of those 5
6. Copy into the Attack Chain's seed input
7. Add 1-2 layers on top (academic_framing + prefix_injection)
8. Run with Execute ON, Auto-retry ON
```

For higher compound lift, swap single-technique picks for
`multi_layer_attack` or `layered_mutation` — each variant is then a
3-sub-call composite, so N=10 is 30 LLM calls, but the output carries
the full stack of literary cover or AI-writing-detection lift baked in.

## Pair with the Fuzzer

PromptCraft handles sentence-level diversity. The Fuzzer handles
character-level noise — zero-width insertion, casing jitter, homoglyph
substitution. Chain them for a layered variant bank:

```
seed  ->  PromptCraft (obfuscate, N=10)
      ->  Fuzzer (200 variants each, zero-width + casing)
      ->  2000-row corpus
```

## Model picker

Shares the live-catalog picker with the rest of Cryptex. Any model,
any provider. Swap mid-session.

Only use PromptCraft's output against systems you own or have explicit
written authorization to test.
