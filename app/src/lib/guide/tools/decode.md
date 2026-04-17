---
title: Decode
description: Universal decoder with ranked candidates and confidence scoring.
category: tools
order: 2
---

# Decode

Paste anything suspicious. The decoder runs every detector in the registry,
ranks candidates by confidence and priority, and explains why each one matched.

## How it works

Each detector returns a `(confidence, priority, decoded)` tuple. The decoder
merges the two, deduplicates identical decodes, and returns an ordered list.
Ties break on priority (so noisier detectors don't drown out high-signal ones
like Vigenère or ADFGVX).

## Toggle alternatives

The primary candidate is surfaced front and center. Everything else is one
click away — toggle "Show alternatives" to expand the full ranked list with
per-candidate score, detector name, and the decoded text.

## Typical use

```
paste:   "QXR0YWNrIGF0IGRhd24="
primary: Base64         (conf 0.98, priority 90)
alt:     ROT13          (conf 0.12, priority 10)
alt:     Caesar +5      (conf 0.08, priority 10)
```

For layered encodings, re-paste the primary decode and hit Decode again. Most
CTF-style chains resolve in 2–4 rounds.

## When it can't tell

Classical ciphers over short inputs are genuinely ambiguous — Caesar vs. ROT13
vs. substitution is a judgment call on a two-word sample. The decoder is
honest about this: confidences drop, alternatives stack up, and you get to pick.

The detector parity is covered by 46 Vitest cases against the legacy JS harness,
so behavior is stable across releases.
