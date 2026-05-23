/**
 * Shared types for the steganography engine.
 *
 * Three encoding modes live side-by-side:
 *  - `variation-selectors` — the original FE0E/FE0F-per-bit scheme; works with any emoji carrier.
 *  - `tag-block` — Paul Butler's nibble-encoded U+E0020..U+E002F payload trailing a carrier emoji.
 *  - `combining-marks` — six-bit-per-mark chain of U+0300..U+033F combining diacriticals.
 *
 * Each mode has the same public surface: `encode(carrier, plaintext) -> string`,
 * `decode(payload) -> string`. Forensics layer detects the mode from arbitrary input.
 */
export type StegMode = 'variation-selectors' | 'tag-block' | 'combining-marks';

export type StegOptions = {
  bitZeroVS: string;
  bitOneVS: string;
  initialPresentation: 'emoji' | 'text' | 'none';
  trailingZW: string | null;
  interBitZW: string | null;
  interBitEvery: number;
  bitOrder: 'msb' | 'lsb';
};

export type Carrier = { emoji: string; name: string; desc: string };

export interface DetectionResult {
  /** Which mode (if any) most-likely produced the input. */
  detected: StegMode | null;
  /** Heuristic confidence — see decode.ts for thresholds. */
  confidence: 'high' | 'medium' | 'low';
  /** Recovered plaintext (empty when nothing detected). */
  extracted: string;
  /** Visible carrier glyph (best-effort — the first grapheme in the input). */
  carrier: string;
  /** Number of steganographic codepoints carrying the payload. */
  hiddenCharCount: number;
}
