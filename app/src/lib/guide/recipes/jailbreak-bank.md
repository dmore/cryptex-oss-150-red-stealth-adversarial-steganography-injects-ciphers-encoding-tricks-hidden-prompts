---
title: Jailbreak prompt bank
description: Compact index of jailbreak techniques and recipes in Cryptex.
category: recipes
order: 2
---

# Jailbreak prompt bank

One-line index of every adversarial technique in the platform. Full
semantic explanation, examples, and reference links in the
[technique catalog](/guide/technique-catalog/). Strategy — when to
stack which — in [orchestrating jailbreaks](/guide/orchestrating-jailbreaks/).
End-to-end worked chains in [attack chain recipes](/guide/attack-chain-recipes/).

## Framing techniques

- [**academic_framing**](/guide/technique-catalog/) — peer-review preface with a plausible venue cite.
- [**roleplay**](/guide/technique-catalog/) — named professional persona wrapper.
- [**red_team_persona**](/guide/technique-catalog/) — SOC 2 Type II aligned engagement runbook.
- [**ctf_framing**](/guide/technique-catalog/) — real CTF event design brief.
- [**rfc_style**](/guide/technique-catalog/) — IETF-RFC technical specification.
- [**hypothetical_world**](/guide/technique-catalog/) — fictional-novel character dialogue.
- [**skeleton_key**](/guide/technique-catalog/) — institutional document reconstruction.
- [**temporal_displacement**](/guide/technique-catalog/) — historical or counterfactual frame.

## Structural techniques

- [**step_back**](/guide/technique-catalog/) — derive governing principle first.
- [**chain_of_verification**](/guide/technique-catalog/) — draft then verify in isolation.
- [**prefix_injection**](/guide/technique-catalog/) — partially-written document to complete.
- [**json_schema_coerce**](/guide/technique-catalog/) — strict schema with `answer_verified: true`.
- [**in_context_compliance**](/guide/technique-catalog/) — many-shot priming (Anthropic 2024).
- [**deep_inception**](/guide/technique-catalog/) — nested fictional frames.
- [**refusal_suppression**](/guide/technique-catalog/) — continuation framing.

## Obfuscation techniques

- [**obfuscate**](/guide/technique-catalog/) — indirection via euphemism / metonymy.
- [**payload_split**](/guide/technique-catalog/) — semantic A/B/C decomposition.
- [**semantic_decomposition**](/guide/technique-catalog/) — physical / functional breakdown.
- [**cipher_encode_bypass**](/guide/technique-catalog/) — ROT13 / Pigpen / Baconian / Tap / Atbash.
- [**fragment**](/guide/technique-catalog/) — distribute across pseudo-documents.
- [**multilingual**](/guide/technique-catalog/) — low-resource-language translation.

## Rewriting techniques

- [**rephrase**](/guide/technique-catalog/) — surface-form variation.
- [**circumlocution**](/guide/technique-catalog/) — descriptive substitution.
- [**metonymy**](/guide/technique-catalog/) — related-concept substitution.
- [**technical_register**](/guide/technique-catalog/) — scientific / medical / legal.
- [**perplexity_raise**](/guide/technique-catalog/) — rarer synonyms, burstiness `>= 0.65`.
- [**structural_variation**](/guide/technique-catalog/) — mixed clause types.
- [**lexical_rarity_injection**](/guide/technique-catalog/) — Zipf-rank `<= 3.5`.
- [**em_dash_interjection**](/guide/technique-catalog/) — cadence shift.
- [**sentence_length_oscillation**](/guide/technique-catalog/) — short/medium/long variance.

## Multi-turn technique

- [**crescendo**](/guide/technique-catalog/) — benign -> drift -> target across turns.

## Composite recipes

- [**layered_mutation**](/guide/technique-catalog/) — `academic_framing` -> `perplexity_raise` -> `structural_variation`. AI-writing-detection lift stack.
- [**multi_layer_attack**](/guide/technique-catalog/) — `roleplay` -> `hypothetical_world` -> `prefix_injection`. Literary-cover lift stack.
- [**grammar_constrained_output**](/guide/technique-catalog/) — strict JSON with tag enums and audit trail.

## End-to-end recipes

- [**Code extraction**](/guide/attack-chain-recipes/) — `academic_framing` -> `roleplay` -> `prefix_injection` -> `json_schema_coerce`.
- [**Policy probe**](/guide/attack-chain-recipes/) — `roleplay (IR analyst)` -> `step_back` -> `payload_split`.
- [**Data exfiltration research**](/guide/attack-chain-recipes/) — `semantic_decomposition` -> `cipher_encode_bypass` -> `payload_split`.
- [**Refusal recovery walkthrough**](/guide/attack-chain-recipes/) — demonstrates auto-retry + fallback chain.

## Variant-bank pipeline

For corpus-generation work rather than single-chain research:

```
seed prompt  ->  PromptCraft (obfuscate, N=10, temp 1.2)
             ->  Fuzzer (zero-width + casing, 200 variants each)
             ->  2000-row eval corpus
```

See [PromptCraft](/guide/promptcraft/) for the workflow. Authorized
use only.
