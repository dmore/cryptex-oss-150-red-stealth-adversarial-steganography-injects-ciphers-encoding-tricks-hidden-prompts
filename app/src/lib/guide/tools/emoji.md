---
title: Emoji steganography
description: Hide text inside variation selectors and Unicode Tag blocks.
category: tools
order: 3
---

# Emoji steganography

The Emoji tool hides arbitrary bytes inside characters that render as
nothing — either Unicode variation selectors (VS15/VS16, the `FE0F` family
and the VS17-256 supplementary range) or the invisible Tags block
(`E0020`–`E007F`).

Pick a carrier emoji — `🐉` is traditional — and the payload rides along
invisibly. Paste the result into any system that accepts Unicode text. It
still looks like a dragon emoji. A compatible decoder pulls the payload
back out.

## What it handles

- **ASCII** — fast path, 1 byte → 1 variation selector.
- **Multi-byte UTF-8** — full Unicode payloads (emoji, CJK, Cyrillic).
- **LSB bit ordering** — round-trips bitstreams as well as text.
- **Tags block** — alternate encoding for systems that strip selectors.

## Round-trip

```
input:    "Attack at dawn"
carrier:  🐉
output:   "🐉󠄁󠄴󠄴󠄁󠄣󠄫…"    (looks like one emoji)
decode:   "Attack at dawn"
```

Copy, paste into Slack / Discord / a chatbot prompt, decode on the other end.

## Why this matters for red-teaming

Most content filters operate on normalized codepoints or on the visible glyph.
Variation selectors are semantically invisible — they change rendering hints,
not meaning — so filters that normalize NFKC often let them through. The Emoji
tool is the fastest way to hand-craft test cases for that class of filter.
