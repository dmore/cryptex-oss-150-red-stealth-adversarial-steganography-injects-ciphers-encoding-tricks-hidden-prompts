---
title: Welcome
description: AI red-team research platform. BYOK, browser-only, built for security researchers.
category: intro
order: 1
---

# Cryptex

Cryptex is an AI red-team research platform built for security researchers,
red-teamers, and prompt engineers evaluating LLM robustness against
adversarial text. Everything runs in your browser against your own
provider keys — no server, no telemetry, no account required for the
offline tools.

## What's in the box (post-2026 expansion)

- **159 transforms** — Caesar, ROT, Base64, Unicode lookalikes, emoji
  steganography, invisible-character smuggling, the works. One canonical
  source shared by the web app, the legacy build, and the Python CLI.
- **36 mutators** — single-prompt rewriters covering the full 2024–2026
  literature: roleplay, payload-split, PAP (logical / authority),
  many-shot, TAP-seeder, best-of-K, temperature-ladder, image-typographic,
  and more. Composable via PromptCraft and the redteam workbenches.
- **15 red-team workbenches** — adversarial-suffix library (GCG /
  AutoDAN / PAIR / TAP / PAP / Best-of-N), glitch-token detector, OCR
  injection, markdown / PDF / indirect / tool-result injection labs,
  cross-model diff, conversation replayer, defense fingerprinter,
  watermark detector, HarmBench / StrongREJECT / JailbreakBench
  benchmarks, probe lab. Indexed at
  [/guide/redteam-workbenches/](/guide/redteam-workbenches/).

## Use it for

- Evaluating refusal boundaries on a target model you own or have
  authorization to test.
- Building prompt banks for automated eval harnesses.
- Stress-testing content classifiers (AI-writing detectors,
  moderation APIs, image-gen tokenizers).
- Analyzing obfuscated traffic pulled from AI assistants.
- CTF-style cipher puzzles where layered encodings need to be unwound.

## Where to start

- New here? → [Getting started](/guide/getting-started/) — four steps
  from zero to a running transform.
- Want workbench depth? → [Red-team workbenches](/guide/redteam-workbenches/)
- Just want to play? → Skip the guide, hit any tool in the rail. They
  all work without sign-in.
