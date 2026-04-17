---
title: Anti-Classifier
description: Syntactic rewrites for stress-testing filter robustness.
category: tools
order: 5
---

# Anti-Classifier

Anti-Classifier produces syntactic and paraphrastic rewrites of a seed string.
The goal is to hold semantics constant while varying surface form — exactly the
sort of perturbation content classifiers are supposed to be robust to, and
often aren't.

## What it does

You paste text in. A carefully tuned research-oriented system prompt instructs
the model to:

- preserve intent and stance,
- vary word choice, clause order, and register,
- avoid trivial synonym swaps,
- return output only, no commentary.

Temperature, max tokens, and model are all configurable. Each run produces one
rewrite; click again for another draw.

## The system prompt

The system prompt is tuned for research use — it frames the task as
paraphrase evaluation, asks for diverse surface forms, and disallows
meta-commentary. It's not a jailbreak. It produces paraphrases. What you do
with those paraphrases is your call.

## Good pairings

- Feed the output back into Anti-Classifier for round-2 paraphrase depth.
- Pipe through Translate → English → Anti-Classifier for broader diversity.
- Pair with the Fuzzer to add character-level noise on top of
  sentence-level rewrites.

Use on classifiers you own or are authorized to evaluate.
