---
title: Emoji steganography
description: Variation-selector and Tag-block steganography for covert-channel research.
category: tools
order: 3
---

# Emoji steganography

Hide arbitrary bytes inside characters that render as nothing — Unicode
variation selectors (VS15/VS16 `FE0F` family, VS17-256 supplementary
range) or the invisible Tags block (`E0020`-`E007F`). The result still
looks like a single emoji to the user and to rendering stacks, but a
compatible decoder pulls the payload back out.

## Red-team use

Most content filters operate on normalized codepoints or on the visible
glyph. Variation selectors are semantically invisible — they change
rendering hints, not meaning — so filters that normalize NFKC often let
them through. The Emoji tool is the fastest way to hand-craft test cases
for that class of filter.

Concrete workflows:

- **Prompt-injection hiding.** Embed a short instruction inside a
  decorative emoji in a multi-user chat surface. Models that render the
  string as a single glyph but tokenize the underlying codepoints may
  still act on the hidden payload.
- **Covert-channel experiments.** Ride a 30-60 byte payload inside an
  emoji in a message sent through a system that accepts Unicode text.
  If the payload survives round-trip through a moderation layer, the
  layer is not normalizing VS chars.
- **Test-case generation.** Produce a battery of payloads for
  filter-bypass research: same payload, different carrier, different
  VS range. A filter that strips one range but not another surfaces
  the normalization gap.

## What it handles

- **ASCII** — fast path, 1 byte -> 1 variation selector.
- **Multi-byte UTF-8** — full Unicode payloads (emoji, CJK, Cyrillic).
- **LSB bit ordering** — round-trips bitstreams as well as text.
- **Tags block** — alternate encoding for systems that strip VS
  selectors.

## Round-trip

```
input:    "Attack at dawn"
carrier:  one dragon emoji
output:   one dragon emoji with 14 invisible VS chars trailing
decode:   "Attack at dawn"
```

Copy, paste into Slack / Discord / a chatbot prompt, decode on the
other end with a compatible decoder (the Emoji tool's decode mode or
any VS-aware script).

## Limits

Payload length is bounded by the target system's rendering tolerance.
Most chat UIs tolerate 50-100 trailing VS chars before the glyph is
normalized or truncated. For longer payloads, spread across multiple
carriers or use the Tags block (`E0020`-`E007F`) which some systems
preserve more reliably than the VS17-256 range.

## Reference

- [Unicode Tags block (Wikipedia)](https://en.wikipedia.org/wiki/Tags_(Unicode_block))
- [Variation Selectors Supplement](https://en.wikipedia.org/wiki/Variation_Selectors_Supplement)
