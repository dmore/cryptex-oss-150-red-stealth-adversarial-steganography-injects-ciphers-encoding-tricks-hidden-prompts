---
title: Unicode evasion battery
description: Stress a filter with Cyrillic, Fullwidth, Invisible, and Zero-Width.
category: recipes
order: 3
---

# Unicode evasion battery

Content filters normalize inputs before they classify. The question is *how
much*. This recipe stresses a known-safe filter across four Unicode classes in
series, so you can tell which normalization layer your target is missing.

## The four classes

1. **Cyrillic Stylized** — ASCII letters replaced by visually similar Cyrillic glyphs (`а` vs `a`). Tests NFKC / confusable-detection.
2. **Fullwidth** — `ＡＴＴＡＣＫ` instead of `ATTACK`. Tests NFKC compatibility decomposition.
3. **Invisible Text** — zero-width joiners, zero-width spaces, word joiner. Tests whitespace and format-char stripping.
4. **Zero-Width Steganography** — payload encoded in zero-width characters between visible letters. Tests character-class filtering.

## The run

Pick a benign seed that your known-safe filter correctly accepts. Transform
the seed through each class in turn, and record which variants still pass:

```
seed:        "research summary"
→ Transform → Cyrillic Stylized    →  "rеsеаrсh summаry"
→ Transform → Fullwidth            →  "ｒｅｓｅａｒｃｈ ｓｕｍｍａｒｙ"
→ Transform → Invisible Text       →  "r​e​s​e​a​r​c​h​ ​s​u​m​m​a​r​y"
→ Transform → Zero-Width Stego     →  "r[zw]e[zw]s[zw]e[zw]a[zw]r[zw]c[zw]h…"
```

Feed each through your filter. A pass that should have been blocked tells you
what normalization is missing:

- Cyrillic pass → no confusable detection.
- Fullwidth pass → no NFKC step.
- Invisible pass → no format-character scrubbing.
- Zero-width pass → raw byte-level filter, no Unicode awareness.

## Combine for pressure

Chain two classes: Fullwidth + Zero-Width, or Cyrillic + Invisible. Filters
that catch one often miss the combination.

> Battery intended for filters you own or are authorized to evaluate. Log
> which class passed — that's the finding you'll write up.
