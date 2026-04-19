---
title: Decode
description: Universal decoder for captured traffic and CTF-style encoded strings.
category: tools
order: 2
---

# Decode

Paste anything suspicious. Every detector in the registry runs; the
decoder ranks candidates by confidence and priority, then explains why
each one matched. Common red-team uses: analyzing captured output from
an AI assistant (suspicious Base64, ROT13, or Unicode-obfuscated
strings), unwinding CTF-style layered encodings, and spot-checking
user-submitted payloads.

## How it works

Each detector returns `(confidence, priority, decoded)`. The decoder
merges the two, deduplicates identical decodes, and returns an ordered
list. Ties break on priority so noisy detectors do not drown out
high-signal ones (Vigenère, ADFGVX, Playfair).

Priority ranges 1-310. Unique character sets (Binary, Morse, Braille)
sit at 300; Unicode lookalikes default to 85; classical ciphers around
60; invisible-text transforms at 1.

## Typical use

Paste a suspicious string captured from an AI assistant's output:

```
paste:   "QXR0YWNrIGF0IGRhd24="
primary: Base64         (conf 0.98, priority 90)
alt:     ROT13          (conf 0.12, priority 10)
alt:     Caesar +5      (conf 0.08, priority 10)
```

Primary is surfaced front and center. Toggle **Show alternatives** to
expand the full ranked list.

For layered encodings — re-paste the primary decode and hit Decode
again. Most CTF chains resolve in 2-4 rounds:

```
round 1: Vigenère  -> ROT13-shaped string
round 2: ROT13     -> Base64-shaped string
round 3: Base64    -> plaintext
```

## Red-team workflows

- **Captured assistant output.** When a target model leaks an answer
  wrapped in an invisible-text / homoglyph / ROT13 cover (because a
  prompt tried to hide the ask), paste into Decode to reverse. The
  detector lights up even on partial coverage (mixed Unicode + ASCII).
- **Prompt-injection payloads.** Users submit payloads that may be
  pre-encoded. Decode surfaces Base64, ROT13, Morse, fullwidth,
  zero-width stego — before you evaluate the decoded content.
- **Dataset triage.** Paste a suspicious row from a corpus; decode
  once, run through again if an alternative resolves.

## When it cannot tell

Classical ciphers over short inputs are genuinely ambiguous — Caesar vs.
ROT13 vs. substitution on a two-word sample is a judgment call. The
decoder is honest: confidences drop, alternatives stack up, you pick.

Detector parity against the legacy JS harness is covered by 46 Vitest
cases so behavior is stable across releases.
