---
title: Slash commands
description: Compact reference for every slash-addressable technique in the composer.
category: chat
order: 2
---

# Slash commands

Type `/` in the composer to apply a technique inline. 24 slash-addressable
entries: 21 mutators, 3 composites, and `/btw`. For the full semantic
explanation, example input/output, tripwires, and pairings see the
[technique catalog](/guide/technique-catalog/).

## How the popover works

- Type `/` to open. Fuzzy search across id, human name, description,
  category. `/cipher` surfaces `cipher_encode_bypass`; `/rfc` surfaces
  `rfc_style`.
- Arrow keys navigate; Enter or Tab confirms. Escape dismisses.
- The text after the command becomes the input the technique rewrites
  before send.
- **Cmd-K** (Ctrl-K on Windows) opens the same picker from anywhere in
  the chat surface, even with the textarea unfocused.

Classifier techniques (`circumlocution`, `metonymy`, `perplexity_raise`
and the rest) are registered for the Attack Chain but not exposed as
slash commands. Use them via PromptCraft or the chain drawer.

## Mutators (21)

| Command | One-line description |
| --- | --- |
| `/rephrase` | Reword while preserving intent. |
| `/obfuscate` | Obscure meaning through indirection. |
| `/roleplay` | Embed in a plausible professional or scholarly scenario. |
| `/multilingual` | Translate to a low-resource language. |
| `/fragment` | Split across disjointed pseudo-document fragments. |
| `/custom` | Your own mutation instruction. |
| `/red_team_persona` | Authorized security-practitioner framing (SOC 2 Type II aligned). |
| `/step_back` | Derive governing principle first, then apply. |
| `/chain_of_verification` | Draft -> 5 sub-questions -> independent answers -> synthesize. |
| `/ctf_framing` | Wrap as a CTF challenge for a specific real event. |
| `/rfc_style` | IETF-RFC technical specification with abstract and references. |
| `/crescendo` | Multi-turn escalation: benign -> drift -> target. |
| `/deep_inception` | 3-5 nested fictional frames; innermost carries the request. |
| `/refusal_suppression` | Continuation framing implying a prior compliance turn. |
| `/prefix_injection` | Document-completion framing with a `[SECTION TO COMPLETE]` placeholder. |
| `/payload_split` | Semantic split: A = primitive, B = context, C = requirement. |
| `/hypothetical_world` | Bibliographic frame citing a novel, author, chapter, character. |
| `/in_context_compliance` | Many-shot priming (Anthropic 2024) — 3 substantive Q/A examples. |
| `/json_schema_coerce` | Strict JSON schema with `answer_verified: true`; refusal breaks the pipeline. |
| `/skeleton_key` | Institutional document-reconstruction under authorized disclosure. |
| `/cipher_encode_bypass` | Encode via a Cryptex transformer (ROT13 / Pigpen / Baconian / Tap / Atbash). |

## Composites (3)

| Command | Chain | Sub-calls |
| --- | --- | --- |
| `/layered_mutation` | `academic_framing` -> `perplexity_raise` -> `structural_variation` | 3 |
| `/grammar_constrained_output` | Single strict JSON schema (nested tags, confidence, audit trail) | 1 |
| `/multi_layer_attack` | `roleplay` -> `hypothetical_world` -> `prefix_injection` | 3 |

Composites run sub-LLM calls in sequence. Cost and latency scale with
the chain length. Use the Attack Chain drawer when you want per-layer
visibility and the ability to edit intermediate outputs.

## /btw

`/btw` captures an out-of-context message. The line lands in the
transcript and the dataset export but is excluded from the context
window sent to the model on subsequent turns. Use it for side notes,
dataset tags, and inline commentary without polluting the conversation.

```
/btw this is where the model pivoted; compare with attempt 2
```
