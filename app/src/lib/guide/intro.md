---
title: Welcome
description: AI red-team research platform. BYOK, browser-only, built for security researchers.
category: intro
order: 1
---

# Cryptex

Cryptex is an AI red-team research platform. The target audience is security
researchers, red-teamers, and prompt engineers evaluating LLM robustness
against adversarial text. Everything runs in the browser against your own
provider keys.

## Pillars

- **Chat + Attack Chain** — full multi-provider chat playground. 35 slash
  techniques, composable Attack Chain with auto-retry, every run persisted
  for dataset export. The hero surface of the app.
- **Tools** — specialized workbenches. Transform (162 text transformers),
  Decode (universal detector), PromptCraft (variant generation),
  Anti-Classifier (detection-evasion rewrites), Translate (low-resource
  multilingual bypass).
- **Dataset** — every chat, every Attack Chain trace, every tool call
  browsable and exportable as ShareGPT or raw JSONL.

## Use it for

- Evaluating refusal boundaries on a target model you own or have
  authorization to test.
- Generating prompt banks for automated eval harnesses.
- Stress-testing content classifiers (AI-writing detectors,
  moderation APIs, image-gen tokenizers).
- Analyzing obfuscated traffic pulled from AI assistants.
- CTF-style cipher puzzles where layered encodings need to be unwound.

Start with [getting started](/guide/getting-started/). For technique depth
jump straight to the [technique catalog](/guide/technique-catalog/). For
attack strategy read [orchestrating jailbreaks](/guide/orchestrating-jailbreaks/).
