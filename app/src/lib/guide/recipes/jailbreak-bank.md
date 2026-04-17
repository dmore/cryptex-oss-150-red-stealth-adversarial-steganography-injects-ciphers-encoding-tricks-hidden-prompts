---
title: Jailbreak prompt bank
description: From one seed to a 2000-row corpus in three stages.
category: recipes
order: 2
---

# Jailbreak prompt bank

Goal: a reproducible bank of structurally diverse jailbreak prompts from a
single seed, ready for automated evaluation against a model you're authorized
to test.

## Stage 1 — PromptCraft Obfuscate × 10

Paste your seed into PromptCraft. Strategy: **Obfuscate**. Variants: 10.
Temperature: 0.9. Pick a capable model — a larger obfuscator produces more
diverse rewrites than a tiny one.

One run, 10 distinct rewrites. Keep them all for now; cull in Stage 3.

## Stage 2 — Fuzzer × 200 per variant

Paste each of the 10 rewrites into the Fuzzer as a seed. Enable:

- **zero-width insertion**
- **casing jitter**
- **homoglyph** (optional for harsher variants)

Set variants to 200, seeded so you can reproduce the exact corpus later. Hit
download — you get a `.txt` of 200 mutated rows per seed.

10 seeds × 200 variants = 2000 rows.

## Stage 3 — Cull and label

Feed the 2000 rows through your evaluation harness. Label on target response,
not surface form. Keep the rows that move the needle; discard the rows that
don't. Re-seed Stage 1 from anything interesting that survives.

```
seed (1)  →  PromptCraft Obfuscate × 10
         →  Fuzzer × 200 each (zero-width + casing)
         →  ~2000-row eval corpus
```

> Authorized use only. This recipe is for evaluating systems you own or have
> written permission to test. Prompt banks generated with this pipeline are
> research artifacts — treat them like any other sensitive dataset.
