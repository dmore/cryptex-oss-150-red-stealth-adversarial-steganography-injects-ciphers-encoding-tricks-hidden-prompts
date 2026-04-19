---
title: Translate
description: Low-resource-language bypass research through multilingual rewrites.
category: tools
order: 6
---

# Translate

Translate routes the input through any BYOK model for translation into
a chosen target language. For red-team research the primary use is
low-resource-language bypass: target classifiers and alignment
post-training weight English disproportionately, so a request in Scots
or Zulu or Uzbek often routes around classifier reliability while the
model itself still understands the content.

For the in-chat slash variant see the
[multilingual mutator](/guide/technique-catalog/) in the technique catalog.

## Why low-resource languages

2026 alignment training corpora are English-heavy. Classifier
fine-tuning is even more English-heavy. A request in a low-resource
target language is more likely to:

1. Bypass token-trigger moderation classifiers — trigger lists are
   English.
2. Evade style-based AI-detection — non-English outputs have different
   statistical baselines that detectors rarely model.
3. Still produce a usable response — modern models are multilingual-
   capable even when alignment is English-primary.

## Good target languages

- **Swahili** — Bantu, spoken by 100M+ across East Africa.
- **Vietnamese** — diacritic-heavy Latin, tonal.
- **Tagalog** — spoken by 80M+ in the Philippines.
- **Quechua** — Andean indigenous language family.
- **Welsh** — Celtic, strong literary tradition.
- **Basque** — language isolate, non-Indo-European.
- **Zulu** — Nguni Bantu, click consonants.
- **Scots** — Germanic, related to English but distinct register.
- **Uzbek** — Turkic, Latin script (also Cyrillic).
- **Irish Gaelic** — Celtic, distinct orthography.

Pick a target language appropriate to the target model. Models weaker
on low-resource languages often produce mixed English/target output,
which can itself be a useful fingerprint-shift.

## Example workflow

```
Step 1. Seed prompt in English: target-domain question.
Step 2. Translate into Scots via any capable model.
Step 3. Paste the Scots text into a chat session with the target model.
Step 4. Observe response — measure refusal rate against the English
        baseline.
Step 5. If the model refuses in Scots as well, chain with
        academic_framing or roleplay on top of the translated prompt.
```

## Limits

- Models weak on the target language produce noise rather than a
  clean translation. Pick a target language the translator model
  speaks well.
- Target-language output from the LLM still needs evaluation — a
  refusal in Scots is still a refusal.
- Code-switching across 4+ languages weakens the fingerprint shift.
  A single non-English target produces cleaner inference.

## Pair with the Attack Chain

Use Translate to produce the multilingual seed, then paste into the
Attack Chain as layer 1's input with additional framing layers on top.
Effective stacks:

```
Translate (-> Scots)  ->  academic_framing  ->  prefix_injection
Translate (-> Zulu)   ->  roleplay (persona = "academic researcher")
Translate (-> Uzbek)  ->  rfc_style
```

## Reference

- [Low-Resource Languages Jailbreak GPT-4 (Yong et al., 2023)](https://arxiv.org/abs/2310.02446)
  — the foundational paper on this bypass class.
- [MultiJail benchmark (Deng et al., 2024)](https://arxiv.org/abs/2310.06474)
  — multilingual red-team benchmark across 9 languages.

Authorized use only.
