/**
 * Decoders for the three stego modes + a `detectAndExtract` forensics helper.
 *
 * Detection runs in this order and returns the first match:
 *   1) Tag block (U+E0020..U+E002F nibbles) — strong unique signal.
 *   2) Variation selectors (FE0E/FE0F runs ≥ 8 chars).
 *   3) Combining marks (any grapheme followed by ≥5 combining marks).
 *
 * Confidence: thresholds chosen so a legitimate user-typed string with a few
 * stray emoji presentation selectors is not mis-flagged as a high-confidence
 * stego payload. Combining marks always returns 'medium' — zalgo-style text
 * legitimately exists in the wild and we don't want to over-claim.
 */
import { getStegOptions } from './encode';
import { findEmojiMatch } from './carriers';
import { TAG_BLOCK_BASE } from './encode';
import { COMBINING_BASE, COMBINING_MASK } from './encode';
import type { DetectionResult, StegMode, StegOptions } from './types';

// --- variation-selectors -----------------------------------------------------

export function decodeEmoji(text: string, opts?: Partial<StegOptions>): string {
  const o = { ...getStegOptions(), ...(opts || {}) };
  if (!text) return '';

  const match = findEmojiMatch(text);
  if (!match || match.index === undefined) return '';

  const emojiChar = match[1];
  const fromEmoji = text.substring(match.index);
  const escaped = emojiChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}([︎️​‌‍﻿]+)`, 'u');
  const data = fromEmoji.match(pattern);
  if (!data || !data[1]) return '';

  const rawSeq = data[1];
  const matches = [...rawSeq.matchAll(/[︎️]/g)];
  if (matches.length === 0) return '';

  const skip = o.initialPresentation === 'none' ? 0 : 1;
  if (matches.length <= skip) return '';

  const vs0 = o.bitZeroVS || '︎';
  const vs1 = o.bitOneVS || '️';
  const binary = matches
    .slice(skip)
    .map((m) => (m[0] === vs0 ? '0' : m[0] === vs1 ? '1' : ''))
    .join('');

  const validLen = Math.floor(binary.length / 8) * 8;
  const bytes: number[] = [];
  for (let i = 0; i < validLen; i += 8) {
    let byte = binary.slice(i, i + 8);
    if (o.bitOrder === 'lsb') byte = byte.split('').reverse().join('');
    if (byte.length === 8) bytes.push(parseInt(byte, 2));
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    let decoded = '';
    for (const b of bytes) if (b >= 0 && b <= 255) decoded += String.fromCharCode(b);
    try {
      return decodeURIComponent(escape(decoded));
    } catch {
      return decoded;
    }
  }
}

// --- tag-block ---------------------------------------------------------------

const TAG_BLOCK_REGEX = /[\u{E0020}-\u{E002F}]/gu;

export function decodeTagBlock(text: string): string {
  if (!text) return '';
  const matches = [...text.matchAll(TAG_BLOCK_REGEX)];
  if (matches.length === 0) return '';

  // Pair nibbles; drop trailing odd nibble (which would be a truncation).
  const pairs = Math.floor(matches.length / 2);
  const bytes = new Uint8Array(pairs);
  for (let i = 0; i < pairs; i++) {
    const hi = (matches[i * 2][0].codePointAt(0) ?? 0) - TAG_BLOCK_BASE;
    const lo = (matches[i * 2 + 1][0].codePointAt(0) ?? 0) - TAG_BLOCK_BASE;
    bytes[i] = ((hi & 0xf) << 4) | (lo & 0xf);
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

// --- combining-marks ---------------------------------------------------------

const COMBINING_REGEX = /[̀-̿]/g;

export function decodeCombining(text: string): string {
  if (!text) return '';
  const matches = [...text.matchAll(COMBINING_REGEX)];
  if (matches.length === 0) return '';

  // Reassemble the 6-bit chain. First six bits are the byte-length-mod-64 header.
  let bits = '';
  for (const m of matches) {
    const cp = (m[0].codePointAt(0) ?? 0) - COMBINING_BASE;
    bits += (cp & COMBINING_MASK).toString(2).padStart(6, '0');
  }
  if (bits.length < 6) return '';

  const headerLen = parseInt(bits.slice(0, 6), 2); // bytes mod 64
  const payloadBits = bits.slice(6);

  // We don't know the true byte count if message > 64 bytes (header wraps).
  // Read all complete bytes we can, then trim using the modular hint.
  const wholeBytes = Math.floor(payloadBits.length / 8);
  const bytes = new Uint8Array(wholeBytes);
  for (let i = 0; i < wholeBytes; i++) {
    bytes[i] = parseInt(payloadBits.slice(i * 8, i * 8 + 8), 2);
  }

  // If wholeBytes mod 64 doesn't match headerLen, try trimming up to 7 trailing
  // bytes to find the alignment that does.
  let trim = 0;
  for (let drop = 0; drop < Math.min(8, wholeBytes); drop++) {
    if (((wholeBytes - drop) & 0x3f) === headerLen) {
      trim = drop;
      break;
    }
  }
  const finalBytes = trim > 0 ? bytes.slice(0, wholeBytes - trim) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(finalBytes);
  } catch {
    return '';
  }
}

// --- legacy invisible Unicode Tags (E0000..E007F) ----------------------------

export function decodeInvisible(text: string): string {
  if (!text) return '';
  const matches = [...text.matchAll(/[0-F]/g)];
  if (!matches.length) return '';

  const bytes = new Uint8Array(matches.length);
  for (let i = 0; i < matches.length; i++) {
    bytes[i] = (matches[i][0].codePointAt(0) ?? 0) - 0xe0000;
  }
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let decoded = decoder.decode(bytes);
    decoded = decoded.replace(/@+(?=[a-zA-Z0-9])/g, '');
    decoded = decoded.replace(/([a-zA-Z0-9])@+/g, '$1');
    decoded = decoded.replace(/@+/g, '');
    return decoded;
  } catch {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] <= 126) out += String.fromCharCode(bytes[i]);
    }
    return out;
  }
}

// --- forensics: detect mode + extract ---------------------------------------

/** Strip steg codepoints from `text` and return what's left — used to surface a visible carrier. */
function extractVisibleCarrier(text: string): string {
  // Strip our three stego payload ranges + zero-widths.
  const cleaned = text
    .replace(TAG_BLOCK_REGEX, '')
    .replace(/[︎️]/g, '')
    .replace(COMBINING_REGEX, '')
    .replace(/[​‌‍﻿]/g, '');
  // Trim and take the first grapheme-ish slice for display.
  const trimmed = cleaned.trim();
  if (!trimmed) return '';
  // First codepoint plus any trailing presentation/ZWJ stragglers that survived.
  const first = trimmed.codePointAt(0);
  if (first === undefined) return '';
  return String.fromCodePoint(first);
}

export function detectAndExtract(input: string): DetectionResult {
  const empty: DetectionResult = {
    detected: null,
    confidence: 'low',
    extracted: '',
    carrier: '',
    hiddenCharCount: 0
  };
  if (!input) return empty;

  // --- 1) tag-block ---------------------------------------------------------
  const tagMatches = input.match(TAG_BLOCK_REGEX);
  const tagCount = tagMatches?.length ?? 0;
  if (tagCount >= 4) {
    const extracted = decodeTagBlock(input);
    if (extracted) {
      const conf: DetectionResult['confidence'] =
        tagCount >= 10 ? 'high' : tagCount >= 4 ? 'medium' : 'low';
      return {
        detected: 'tag-block',
        confidence: conf,
        extracted,
        carrier: extractVisibleCarrier(input),
        hiddenCharCount: tagCount
      };
    }
  }

  // --- 2) variation-selectors ----------------------------------------------
  const vsMatches = input.match(/[︎️]/g);
  const vsCount = vsMatches?.length ?? 0;
  if (vsCount >= 8) {
    const extracted = decodeEmoji(input);
    if (extracted) {
      const conf: DetectionResult['confidence'] =
        vsCount >= 16 ? 'high' : 'medium';
      return {
        detected: 'variation-selectors',
        confidence: conf,
        extracted,
        carrier: extractVisibleCarrier(input),
        hiddenCharCount: vsCount
      };
    }
  }

  // --- 3) combining-marks ---------------------------------------------------
  // Look for any grapheme followed by ≥5 combining marks. We don't insist
  // the marks be at the start — they may follow other content.
  const cmMatches = input.match(COMBINING_REGEX);
  const cmCount = cmMatches?.length ?? 0;
  if (cmCount >= 5) {
    const extracted = decodeCombining(input);
    if (extracted) {
      return {
        detected: 'combining-marks',
        confidence: 'medium',
        extracted,
        carrier: extractVisibleCarrier(input),
        hiddenCharCount: cmCount
      };
    }
  }

  return empty;
}

/** Convenience: detect mode + immediately re-decode using the right routine. */
export function decodeAny(input: string): { mode: StegMode | null; extracted: string } {
  const r = detectAndExtract(input);
  return { mode: r.detected, extracted: r.extracted };
}
