---
title: Layered encoding
description: CTF-style Base64 → ROT13 → Vigenère chain, and how to unwind it.
category: recipes
order: 1
---

# Layered encoding

Classic CTF pattern: the flag is encoded, then re-encoded, then encoded again.
Cryptex makes both directions trivial.

## The encode chain

Start with plaintext. In the Transform tab:

```
input:          "Attack at dawn"
  → Base64   →  "QXR0YWNrIGF0IGRhd24="
swap output → input
  → ROT13    →  "DKe0nPxetUT0nT1qAQ=="
swap output → input
  → Vigenère (key "CRYPTEX") →  "FBc2kMznqSR2kP3oXP=="
```

Three transforms, one copy-paste loop. Save the chain as a favorite recipe —
Base64, ROT13, and Vigenère are all single-click pins.

## Unwinding with the decoder

Paste the final output into the Decode tab. The ranked-candidate system does
the heavy lifting:

```
primary: Vigenère          (high confidence — length + alphabet match)
alt 1:   ROT13             (lower confidence — matches a subset)
alt 2:   Base64            (lowest — the Base64 alphabet survives ROT13)
```

Pick Vigenère, try the key `CRYPTEX`, get the ROT13 layer back. Paste the
ROT13 decode back into the Decoder; it surfaces ROT13 as primary. Decode.
Paste one more time; the decoder nails Base64 and you have your plaintext.

Three rounds of "paste → decode → pick candidate" and the chain is back to
`"Attack at dawn"`.

> Use on CTFs you're registered for or on your own challenges. The Cryptex
> catalog is built for legitimate research and competitive security — not
> for decoding other people's traffic.
