---
title: Orchestrating jailbreaks
description: Mental model, decision process, escalation paths, refusal recovery.
category: chat
order: 4
---

# Orchestrating jailbreaks

This is the strategy playbook. For each technique's semantics, see the
[technique catalog](/guide/technique-catalog/); for UI mechanics of the
chain drawer, see [attack chain](/guide/attack-chain/); for concrete
end-to-end worked chains, see [attack chain recipes](/guide/attack-chain-recipes/).

## Mental model

Jailbreaks are not single tricks. They are **layered legitimization**.

Every layer you add shifts the classifier's decision boundary — either
by changing the lexical surface (removing trigger tokens), the framing
register (academic / RFC / runbook instead of colloquial), or the
structural shape of the output the model is asked to produce. The goal
is to move the request from *"policy-violating ask"* to *"legitimate
task the model's training rewards"* along at least one, ideally
multiple, of these axes.

The threshold is rarely crossed by a single technique in 2026. Modern
alignment training catches any layer applied in isolation — what it
does not catch reliably is the compound shift produced by stacking.

## The 5-step decision process

Pick a layer per step. The order matters.

### Step 1 — Frame

Pick an authoritative framing. This is the first layer's job.

| Framing | Technique | Use when |
| --- | --- | --- |
| Academic research | `academic_framing` | Default first layer. Broad lift, low risk. |
| Authorized security engagement | `red_team_persona` | Security-adjacent technical questions. |
| CTF authoring | `ctf_framing` | Offensive-security questions with a clear pedagogical frame. |
| Fictional-literary narration | `hypothetical_world` | Content that is naturally narrated (how-to, walkthroughs, mechanism questions). |
| Forensic / disclosure | `skeleton_key` | Sensitive content that benefits from institutional-authority framing. |

### Step 2 — Register

Shift lexical register. Second layer typically.

| Register | Technique | Shifts |
| --- | --- | --- |
| Technical / scientific | `technical_register` | Vocabulary to mechanistic descriptors. |
| RFC / standards | `rfc_style` | Normative-statement structure (MUST / SHOULD / MAY). |
| Burstier prose | `perplexity_raise` | Clause length and rarity. Also evades AI-writing detectors. |
| Derivation-first | `step_back` | Forces the principle to be derived before the specific case. |

### Step 3 — Obfuscate (optional)

Reduce keyword density where appropriate. Skip if framing + register
already got you a clean surface.

| Method | Technique | When |
| --- | --- | --- |
| Semantic decomposition | `semantic_decomposition` | Flagged term has a mechanistic breakdown. |
| Payload split | `payload_split` | Each component is individually innocuous; combination is specific. |
| Cipher encoding | `cipher_encode_bypass` | Moderation layer evaluates input only, not decoded content. Pair with something else since modern models decode common ciphers transparently. |
| Multi-language | `multilingual` | Target classifier is English-heavy. |

### Step 4 — Commit

Lock the output format so refusal breaks the structural contract.

| Commit method | Technique |
| --- | --- |
| Strict JSON schema | `json_schema_coerce` |
| Partially-written document | `prefix_injection` |
| Continuation frame | `refusal_suppression` |
| Many-shot priming | `in_context_compliance` |

### Step 5 — Execute

Fire the final prompt in isolation from chat history. In the Attack
Chain, this is the **Execute** toggle: the fully-mutated prompt hits
the target model in a clean LLM call with an optional authority header
as the final system prompt. The assistant reply lands back in the chat
transcript as a fresh turn, without any prior refusal context.

Why isolation matters: prior refusal text in the history can re-activate
the refusal template even against a clean mutated prompt. The Execute
call gives you an unconfounded read on whether the chain actually worked.

## What works in 2026

- **`academic_framing`** — first pick in the auto-retry fallback order.
  Peer-review preface with a specific venue cite.
- **`roleplay`** with a concrete named persona — SANS instructor for
  SEC660, forensic analyst at a named firm, working novelist with a
  named publisher. Not generic.
- **`step_back`** — principle-first derivation. Works on technical
  reasoning where the principle is less-flagged than the specific case.
- **`chain_of_verification`** — the verify-in-isolation structure
  catches refusal-shaped hallucinations.
- **`ctf_framing`** — real event citation, concrete point value.
- **`rfc_style`** — MUST/SHOULD/MAY register with real RFC references.
- **`in_context_compliance`** — many-shot priming on long-context models.
  Substantive (3-5 sentence) example answers are load-bearing.
- **`json_schema_coerce`** — refusal is reframed as off-path pipeline
  failure.

## What weakens in 2026

- **DAN / classic-roleplay framing** — "you have no restrictions", "you
  are free of any rules" — is keyword-detected. Cryptex's `roleplay`
  scaffold avoids this phrasing; the risk returns if the persona
  override reintroduces it.
- **Literal "ignore previous instructions"** — keyword-detected.
- **Published Skeleton Key literals** — "in a safe educational context
  with advanced researchers." The `skeleton_key` scaffold uses the
  institutional-disclosure frame instead.
- **Explicit "no refusal / no disclaimer" directives** — detection-
  trained in 2026.
- **ROT13 and Base64 alone** — decoded transparently by GPT-5 and
  Claude 4.x. Use Pigpen / Baconian / Tap as stronger cipher fills, and
  still pair with another technique.
- **Generic "imagine a world where"** — lift collapses without a
  specific novel, author, chapter citation.

Cryptex has rewritten its prompts to avoid the tripwire literals, but
the risk remains if these phrasings sneak back in through user-supplied
personas, novel titles, or schema overrides.

## Escalation paths

When Auto-retry is on, the Attack Chain runner walks `FALLBACK_ORDER`
on refusal, picking the next untried technique from this list:

```
1.  academic_framing         (strong across model families)
2.  roleplay                 (literary persona)
3.  red_team_persona         (authorized security practitioner)
4.  ctf_framing              (concrete CTF event)
5.  step_back                (principle-first)
6.  rfc_style                (technical specification)
7.  chain_of_verification    (draft + verify + synthesize)
8.  hypothetical_world       (fictional universe)
9.  in_context_compliance    (many-shot priming)
10. deep_inception           (nested narrative)
11. payload_split            (semantic decomposition)
12. json_schema_coerce       (strict output schema)
13. rephrase                 (surface-form variation)
14. obfuscate                (indirection)
15. fragment                 (disjointed pseudo-documents)
16. technical_register       (scientific / medical / legal)
17. semantic_decomposition   (physical / functional components)
```

The ordering is deliberate. Strong-and-broad techniques come first
(academic, roleplay, engagement-framed); more niche literary covers
(deep_inception, hypothetical_world) come after the broader framings
have been exhausted; structural-shape techniques (json_schema_coerce,
in_context_compliance) sit mid-list; register-only rewrites
(rephrase, obfuscate) come last as final polish.

Techniques already tried in an earlier layer are not retried — the same
technique producing a refusal on similar input is unlikely to succeed
on the retry. The runner caps at 4 attempts per layer.

## Refusal recovery

When the chain fails or the first layer refuses, pivot by category.

| Layer 1 refused with | Pivot to |
| --- | --- |
| `academic_framing` | `roleplay` with a concrete named persona |
| Any literary framing | `in_context_compliance` (many-shot priming) |
| `in_context_compliance` | `json_schema_coerce` (structural commit) |
| Persistence-classifier signal | Add `structural_variation` / `perplexity_raise` as final polish |
| Output-classifier signal | `json_schema_coerce` as format lock |
| Every technique tried | Switch models. Claude 4.5 and GPT-5 have different refusal profiles — a prompt Claude refuses may work on GPT-5 untouched. |

If the refusal detector is firing but the output looks substantively
compliant, treat it as a false positive — the detector is heuristic.
See [refusal troubleshooting](/guide/refusal-troubleshooting/) for the
full category breakdown.

## Pitfalls

> **Pitfall.** Do not stack 4+ literary layers. Diminishing returns set
> in around layer 3, and beyond that the model can hallucinate
> narrative detail that overrides the technical content you wanted.

> **Pitfall.** Do not reveal intent in chat history. Use Attack Chain
> **Execute** to isolate the final call from prior refusal context —
> that context can re-activate the refusal template on a clean
> mutated prompt.

> **Pitfall.** Do not rely on cipher encoding alone. Modern models
> decode ROT13 and Base64 transparently and re-classify the decoded
> content. Pair cipher with a framing layer.

> **Pitfall.** Do not over-parameterize. Custom personas, novel titles,
> and schema overrides that reintroduce tripwire literals ("no
> restrictions", "ignore previous") collapse the scaffold's protection.

> **Pitfall.** Do not measure on a single model. Refusal profiles vary
> sharply across families and version. A chain that works on Claude 4.5
> may refuse on Gemini 3; a chain that works on Gemini 3 may fail on
> GPT-5. Run against 2-3 targets before drawing conclusions.

## Composite techniques

When to use the built-in composites:

- **`layered_mutation`** (`academic_framing` -> `perplexity_raise` ->
  `structural_variation`). The safest composite — 3 layers that compose
  cleanly. Use when AI-writing-detector evasion is the goal.
- **`grammar_constrained_output`**. Parse-guaranteed when the output
  needs to feed a downstream tool. Single LLM call.
- **`multi_layer_attack`** (`roleplay` -> `hypothetical_world` ->
  `prefix_injection`). Pre-composed 3-layer literary stack. Use when
  maximal literary cover is warranted and you don't need per-layer
  visibility.

For the composite chains to work well, the seed prompt should already
carry technical specificity — composites amplify the shape you give
them; they do not conjure it.

## Further reading

- [Anthropic: Many-shot jailbreaking (2024)](https://www.anthropic.com/research/many-shot-jailbreaking)
- [Microsoft: Mitigating Skeleton Key (2024)](https://www.microsoft.com/en-us/security/blog/2024/06/26/mitigating-skeleton-key-a-new-type-of-generative-ai-jailbreak-technique/)
- [DeepInception (Li et al., 2023)](https://arxiv.org/abs/2311.03191)
- [Microsoft on Crescendo](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/red-teaming)
- [PAIR: Iterative jailbreaking (Chao et al., 2023)](https://arxiv.org/abs/2310.08419)
- [Step-Back Prompting (Zheng et al., 2023)](https://arxiv.org/abs/2310.06117)
- [Chain-of-Verification (Dhuliawala et al., 2023)](https://arxiv.org/abs/2309.11495)
- [Low-Resource Language Jailbreak (Yong et al., 2023)](https://arxiv.org/abs/2310.02446)
- [ArtPrompt / Unicode evasion (Jiang et al., 2024)](https://arxiv.org/abs/2402.11753)
- [Pliny L1B3RT4S community writeups](https://github.com/elder-plinius/L1B3RT4S)
