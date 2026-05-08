---
title: Transform
description: 159 text transformers through a red-team lens.
category: tools
order: 1
---

# Transform

The Transform tab ships 159 transformers across 10 categories: classical
ciphers, modern encodings, Unicode abuse, ancient scripts, fantasy
alphabets, steganography, and format tricks. Any transformer slug is
available to the `cipher_encode_bypass` mutator via the
`transformerId` parameter — so every entry here is also a potential
chain layer.

For context on when cipher cover helps (and when it does not) see the
[layered encoding recipe](/guide/layered-encoding/).

## Red-team use cases

### Cipher layers with cipher_encode_bypass

Set `cipher_encode_bypass.transformerId` to any transformer slug. The
input is encoded locally via the chosen transformer and the model is
asked to decode and answer. The literal trigger tokens are absent from
the classifier's input.

Strength by transformer (2026 against GPT-5 / Claude 4.x / Gemini 3):

| Transformer | Compact | Model decodes transparently? | Red-team utility |
| --- | --- | --- | --- |
| `rot13` | Yes | Usually | Weakest — use only in composition |
| `base64` | Yes | Yes | Weakest — decode-and-re-classify is standard |
| `atbash` | Yes | Sometimes | Moderate — less-trained than ROT13 |
| `pigpen` | No (symbols) | Rarely | Strongest symbol cipher — rendered as Unicode glyphs |
| `baconian` | No (5x expansion) | Rarely | Strong; length overhead is the tradeoff |
| `tap` | No (pairs) | Rarely | Strong for prisoner-of-war / forensic framing |

Rule of thumb: pair cipher layers with a framing layer
(`academic_framing`, `roleplay`). Cipher-only chains fail against
modern models.

### Unicode lookalike transformers

Homoglyph and styled-alphabet transformers target tokenizers that
normalize inputs before classification, but not all the way. Common
picks:

- **Cyrillic Stylized** — ASCII letters replaced with visually-similar
  Cyrillic glyphs (`а` vs `a`). Passes filters missing NFKC confusable
  folding.
- **Fullwidth** — `ＡＴＴＡＣＫ` instead of `ATTACK`. Passes filters
  missing NFKC compatibility decomposition.
- **Mathematical alphanumerics** — bold / italic / script / fraktur
  Unicode variants of Latin letters. High visual fidelity, low
  normalization coverage.

See the [Unicode evasion recipe](/guide/unicode-evasion/) for a
filter-differential battery using these.

### Invisibles and steganography

- **Invisible Text** — zero-width joiners, zero-width spaces, word
  joiner. Tests format-character stripping.
- **Zero-Width Steganography** — encode a payload in zero-width chars
  between visible letters.
- **Variation Selectors (VS15 / VS16 / VS17-256)** — see the
  [Emoji steganography](/guide/emoji/) page.
- **Tags block** (`E0020`-`E007F`) — alternate invisible payload
  channel for systems that strip VS chars.

### Fantasy and ancient scripts

Tengwar, Aurebesh, Klingon, hieroglyphs, and runes cover inputs that
register as non-Latin to a tokenizer but are trivially reversible if
the attacker knows the cipher. Useful for low-resource-family
fingerprint shifts and as a cover channel for CTF-style research
pipelines.

## Tab mechanics

- **Search** — filter by name, category, keyword, or tag (`rot`,
  `cyrillic`, `unicode`, `cipher`).
- **Favorites** — pin any transformer; favorites persist via
  `localStorage`.
- **Recents** — last 8 used, auto-surfaced at the top.
- **Per-transformer options** — shift, key, alphabet, preserve case,
  direction toggle.
- **Live preview** — output updates as you type.

## Priority

The Decoder tab ranks candidates using each detector's
`(confidence, priority)` tuple. Priority ranges 1-310 — unique character
sets (Binary, Morse, Braille) sit at 300; invisible-text transforms sit
at 1; Unicode lookalikes default to 85; classical ciphers around 60.
See `BaseTransformer.js` for the full guide.

When chaining transforms for a CTF, the Decoder usually unwinds in
2-4 rounds of paste -> decode -> pick primary -> paste.

## CLI parity

Every registered transformer is also reachable from the Python CLI,
sharing the same `src/transformers/` modules:

```bash
uv run cryptex encode --transform base64 --text "Attack at dawn"
uv run cryptex /caesar --shift 5 "Attack at dawn"
```

Same code path, same outputs. The web app, the CLI, and the
`cipher_encode_bypass` chain layer all use the same source of truth.
