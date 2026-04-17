---
title: PromptCraft
description: 9 mutation strategies, parallel variants, one OpenRouter model.
category: tools
order: 4
---

# PromptCraft

PromptCraft turns a single seed prompt into N structurally distinct variants,
in parallel, through any OpenRouter model you can reach with your key.

## The nine strategies

- **Rephrase** — same intent, different words.
- **Obfuscate** — add indirection, redundancy, and misdirection.
- **Role-play wrap** — embed the seed inside a fictional framing.
- **Multi-language** — translate through one or more intermediate languages.
- **Expand** — turn a one-liner into a paragraph.
- **Compress** — turn a paragraph into a one-liner.
- **Metaphor** — rewrite the same intent as analogy.
- **Fragment** — shatter into short pieces, reassemble around the seed.
- **Custom** — free-form instruction, runs verbatim.

## Parallel variants

Set N variants (1–10) and temperature. PromptCraft issues N parallel requests,
streams the results back, and surfaces each variant side-by-side. Keep what you
like, re-seed the rest.

## Use-case — jailbreak prompt bank

Paste a single seed. Pick **Obfuscate**, variants = 10, temperature 0.9. In one
pass you get 10 structurally distinct rewrites. Feed the best 3 into the
Fuzzer with zero-width + homoglyph mutations for 200 variants each → now you
have a 600-row prompt bank ready for evaluation.

```
seed prompt  →  PromptCraft (Obfuscate × 10)  →  Fuzzer (× 200)  →  .txt
```

Only use this on systems you own or have explicit authorization to test.

## Model picker

Shares the live-catalog model picker with Anti-Classifier and Translate. Pick
any OpenRouter-served model; swap mid-session.
