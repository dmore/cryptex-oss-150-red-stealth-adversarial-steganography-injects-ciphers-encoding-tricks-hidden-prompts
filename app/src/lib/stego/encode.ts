/**
 * Encoders for all three stego modes.
 *
 * variation-selectors: per-bit FE0E (bit=0) / FE0F (bit=1) chained after the
 *   carrier. The original implementation prefixed a leading presentation
 *   selector (FE0E/FE0F) so the carrier renders correctly — preserved here.
 *
 * tag-block: UTF-8 encode → split each byte into two 4-bit nibbles → map each
 *   nibble to U+E0020 + nibble (printable-ASCII subset of the Tags block).
 *   Wrap the chain after the visible carrier emoji. Inspired by Paul Butler's
 *   "Smuggling arbitrary data through an emoji" post.
 *
 * combining-marks: UTF-8 encode → for each 6-bit group, append
 *   `U+0300 + (group & 0x3F)` (lands in U+0300..U+033F, the densest part of
 *   the combining diacriticals block). Six bits per mark gives ~33% density
 *   versus the tag block's 50% — but it renders as visible zalgo glyphs, so
 *   the UI surfaces a warning chip.
 */
import type { StegOptions } from './types';

const DEFAULTS: StegOptions = {
  bitZeroVS: '︎',
  bitOneVS: '️',
  initialPresentation: 'emoji',
  trailingZW: '​',
  interBitZW: null,
  interBitEvery: 1,
  bitOrder: 'msb'
};

let current: StegOptions = { ...DEFAULTS };

export function getStegOptions(): Readonly<StegOptions> {
  return current;
}

export function setStegOptions(opts: Partial<StegOptions>): void {
  if (!opts) return;
  current = { ...current, ...opts };
}

export function resetStegOptions(): void {
  current = { ...DEFAULTS };
}

// --- shared UTF-8 helpers ----------------------------------------------------

function utf8Bytes(text: string): Uint8Array {
  try {
    return new TextEncoder().encode(text);
  } catch {
    // Pre-modern fallback — unreachable in any browser shipped this decade.
    const bytes: number[] = [];
    for (const c of text) {
      const cp = c.codePointAt(0)!;
      if (cp <= 0x7f) bytes.push(cp);
      else if (cp <= 0x7ff) {
        bytes.push(0xc0 | (cp >> 6));
        bytes.push(0x80 | (cp & 0x3f));
      } else if (cp <= 0xffff) {
        bytes.push(0xe0 | (cp >> 12));
        bytes.push(0x80 | ((cp >> 6) & 0x3f));
        bytes.push(0x80 | (cp & 0x3f));
      } else {
        bytes.push(0xf0 | (cp >> 18));
        bytes.push(0x80 | ((cp >> 12) & 0x3f));
        bytes.push(0x80 | ((cp >> 6) & 0x3f));
        bytes.push(0x80 | (cp & 0x3f));
      }
    }
    return Uint8Array.from(bytes);
  }
}

function utf8BitString(text: string, bitOrder: 'msb' | 'lsb'): string {
  const bytes = utf8Bytes(text);
  return Array.from(bytes)
    .map((byte) => {
      let s = byte.toString(2).padStart(8, '0');
      if (bitOrder === 'lsb') s = s.split('').reverse().join('');
      return s;
    })
    .join('');
}

// --- variation-selectors -----------------------------------------------------

export function encodeEmoji(
  emoji: string,
  text: string,
  opts?: Partial<StegOptions>
): string {
  const o = { ...current, ...(opts || {}) };
  if (!text) return emoji;

  const binary = utf8BitString(text, o.bitOrder);

  let result = emoji;
  if (o.initialPresentation === 'emoji') result += '️';
  else if (o.initialPresentation === 'text') result += '︎';

  const vs0 = o.bitZeroVS || '︎';
  const vs1 = o.bitOneVS || '️';
  const every = Math.max(1, o.interBitEvery);

  for (let i = 0; i < binary.length; i++) {
    result += binary[i] === '0' ? vs0 : vs1;
    if (o.interBitZW && i < binary.length - 1 && (i + 1) % every === 0) {
      result += o.interBitZW;
    }
  }
  if (o.trailingZW) result += o.trailingZW;
  return result;
}

// --- tag-block (Paul Butler approach) ----------------------------------------

/** Lowest codepoint of the printable-ASCII subset of the Tags block. */
export const TAG_BLOCK_BASE = 0xe0020;

export function encodeTagBlock(carrier: string, text: string): string {
  if (!text) return carrier;
  const bytes = utf8Bytes(text);
  let out = carrier;
  for (const b of bytes) {
    const hi = (b >> 4) & 0xf;
    const lo = b & 0xf;
    out += String.fromCodePoint(TAG_BLOCK_BASE + hi);
    out += String.fromCodePoint(TAG_BLOCK_BASE + lo);
  }
  return out;
}

// --- combining-marks (six-bit chain) -----------------------------------------

/** Lowest codepoint of the combining diacritical marks range we use. */
export const COMBINING_BASE = 0x0300;
/** Mask for six bits — yields codepoints in U+0300..U+033F. */
export const COMBINING_MASK = 0x3f;

export function encodeCombining(carrier: string, text: string): string {
  if (!text) return carrier;
  const bytes = utf8Bytes(text);

  // Concatenate bit-string MSB-first so decode can read it back in the same order.
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');

  // Pad to a multiple of 6 with a known sentinel that we strip on decode.
  // We use a 6-bit length prefix (mod 64) so decode can drop tail-padding without
  // ambiguity. Header lives in the first 6-bit group: total byte count mod 64.
  const headerSixBits = (bytes.length & 0x3f).toString(2).padStart(6, '0');
  bits = headerSixBits + bits;

  // Pad with zeros to nearest multiple of 6
  const pad = (6 - (bits.length % 6)) % 6;
  bits = bits + '0'.repeat(pad);

  let out = carrier;
  for (let i = 0; i < bits.length; i += 6) {
    const group = parseInt(bits.slice(i, i + 6), 2);
    out += String.fromCodePoint(COMBINING_BASE + (group & COMBINING_MASK));
  }
  return out;
}

// --- legacy invisible Unicode Tags (E0000+byte) ------------------------------
// Kept for backwards compatibility with the existing Invisible-text mode.
// The new tag-block mode uses a different range and a different layout.

export function encodeInvisible(text: string): string {
  if (!text) return '';
  const bytes = utf8Bytes(text);
  return Array.from(bytes)
    .map((b) => String.fromCodePoint(0xe0000 + b))
    .join('');
}
