---
title: Transform
description: The 162-transform registry — encode, decode, chain, favorite.
category: tools
order: 1
---

# Transform

The Transform tab is the heart of Cryptex: 162 transforms across 10 categories
— classical ciphers (Caesar, Vigenère, Playfair, ADFGVX, Bifid, Hill, Porta,
Trifid, …), modern encodings (Base64, Base58, hex, Morse, Baconian, …),
Unicode styling, ancient scripts (hieroglyphs, runes), fantasy alphabets
(Tengwar, Aurebesh, Klingon), steganography, and format tricks.

## What you can do

- **Search** the registry by name or keyword (`rot`, `cyrillic`, `tags`, …).
- **Favorite** any transform — it sticks to the top via `localStorage`.
- **Recents** surface the last 8 you used.
- **Per-transform options** — shift, key, alphabet, preserve case, etc.
- **Encode / decode toggle** on every transform that supports both directions.
- **Live preview** as you type.

## Chain example — Base64 then ROT13

Transforms compose trivially by piping output back in:

```
input:        "Attack at dawn"
→ Base64   →  "QXR0YWNrIGF0IGRhd24="
→ ROT13    →  "DKe0nPxetUT0nT1qAQ=="
(Base64 alphabet letters shift by 13; digits/padding untouched.)
```

Swap output to input, pick the next transform, repeat. The Decoder tab will
unwind the chain for you — ranked candidates with confidence scores.

## CLI parity

Every registered transform is also reachable from the Python CLI:

```bash
uv run cryptex encode --transform base64 --text "Attack at dawn"
uv run cryptex /caesar --shift 5 "Attack at dawn"
```

Same code path, same outputs. The web app and CLI share `src/transformers/`
as a single source of truth.
