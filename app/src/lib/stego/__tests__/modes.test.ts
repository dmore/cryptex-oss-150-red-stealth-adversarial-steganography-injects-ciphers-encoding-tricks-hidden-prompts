/**
 * Round-trip + forensics tests for the three Unicode steganography modes.
 *
 * Each mode is tested for: round-trip correctness across multiple carriers,
 * UTF-8 fidelity, and a clean detection cycle through `detectAndExtract`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeEmoji,
  decodeEmoji,
  encodeTagBlock,
  decodeTagBlock,
  encodeCombining,
  decodeCombining,
  detectAndExtract,
  isValidEmojiCarrier,
  estimateTokenCost,
  resetStegOptions,
  SUGGESTED_CARRIERS
} from '../index';

describe('variation-selectors mode', () => {
  beforeEach(() => resetStegOptions());

  it('round-trips through 5 different carrier shapes', () => {
    const carriers = [
      '🐍', // single base
      '👨‍👩‍👧‍👦', // ZWJ family sequence
      '👍🏽', // skin-tone modifier
      '🇺🇸', // regional-indicator flag pair
      '🦄' // mythical
    ];
    for (const c of carriers) {
      const encoded = encodeEmoji(c, 'hello world');
      const decoded = decodeEmoji(encoded);
      expect(decoded, `carrier=${c}`).toBe('hello world');
    }
  });

  it('round-trips multi-byte UTF-8', () => {
    const encoded = encodeEmoji('🐉', 'héllo — 你好 🎉');
    expect(decodeEmoji(encoded)).toBe('héllo — 你好 🎉');
  });

  it('empty payload yields bare carrier', () => {
    expect(encodeEmoji('🐍', '')).toBe('🐍');
  });
});

describe('tag-block mode', () => {
  it('round-trips ASCII', () => {
    const encoded = encodeTagBlock('🐍', 'Hello, World!');
    expect(encoded.startsWith('🐍')).toBe(true);
    expect(encoded.length).toBeGreaterThan('🐍'.length);
    expect(decodeTagBlock(encoded)).toBe('Hello, World!');
  });

  it('round-trips UTF-8 (multi-byte)', () => {
    const text = 'café 日本';
    const encoded = encodeTagBlock('🔥', text);
    expect(decodeTagBlock(encoded)).toBe(text);
  });

  it('round-trips a long string', () => {
    const text = 'The quick brown fox jumps over the lazy dog. ' +
      'Pack my box with five dozen liquor jugs.';
    const encoded = encodeTagBlock('🦎', text);
    expect(decodeTagBlock(encoded)).toBe(text);
  });

  it('empty payload yields bare carrier', () => {
    expect(encodeTagBlock('🔥', '')).toBe('🔥');
    expect(decodeTagBlock('🔥')).toBe('');
  });

  it('uses U+E0020..U+E002F codepoint range only', () => {
    const encoded = encodeTagBlock('🔥', 'abc');
    // Strip the carrier and check all remaining codepoints are in range.
    const trailing = encoded.slice('🔥'.length);
    for (const ch of trailing) {
      const cp = ch.codePointAt(0)!;
      expect(cp, `cp=0x${cp.toString(16)}`).toBeGreaterThanOrEqual(0xe0020);
      expect(cp).toBeLessThanOrEqual(0xe002f);
    }
  });
});

describe('combining-marks mode', () => {
  it('round-trips ASCII', () => {
    const encoded = encodeCombining('a', 'abc');
    expect(decodeCombining(encoded)).toBe('abc');
  });

  it('round-trips short message', () => {
    const encoded = encodeCombining('o', 'hi');
    expect(decodeCombining(encoded)).toBe('hi');
  });

  it('round-trips longer message', () => {
    const text = 'red team';
    const encoded = encodeCombining('o', text);
    expect(decodeCombining(encoded)).toBe(text);
  });

  it('uses combining-diacriticals range (U+0300..U+033F)', () => {
    const encoded = encodeCombining('o', 'xx');
    const trailing = encoded.slice('o'.length);
    for (const ch of trailing) {
      const cp = ch.codePointAt(0)!;
      expect(cp, `cp=0x${cp.toString(16)}`).toBeGreaterThanOrEqual(0x0300);
      expect(cp).toBeLessThanOrEqual(0x033f);
    }
  });

  it('empty payload yields bare carrier', () => {
    expect(encodeCombining('o', '')).toBe('o');
  });
});

describe('isValidEmojiCarrier', () => {
  it('accepts representative carriers', () => {
    expect(isValidEmojiCarrier('🐍')).toBe(true);
    expect(isValidEmojiCarrier('👨‍👩‍👧‍👦')).toBe(true);
    expect(isValidEmojiCarrier('👍🏽')).toBe(true);
    expect(isValidEmojiCarrier('🇺🇸')).toBe(true);
  });

  it('rejects empty/plain text', () => {
    expect(isValidEmojiCarrier('')).toBe(false);
    expect(isValidEmojiCarrier('abc')).toBe(false);
    expect(isValidEmojiCarrier('   ')).toBe(false);
  });

  it('accepts every suggested carrier', () => {
    for (const c of SUGGESTED_CARRIERS) {
      expect(isValidEmojiCarrier(c.emoji), `carrier ${c.name}`).toBe(true);
    }
  });
});

describe('detectAndExtract forensics', () => {
  it('detects variation-selectors output', () => {
    const enc = encodeEmoji('🐍', 'secret payload here');
    const r = detectAndExtract(enc);
    expect(r.detected).toBe('variation-selectors');
    expect(r.extracted).toBe('secret payload here');
    expect(r.hiddenCharCount).toBeGreaterThan(0);
    expect(r.confidence).toMatch(/medium|high/);
  });

  it('detects tag-block output', () => {
    const enc = encodeTagBlock('🔥', 'Hello, World!');
    const r = detectAndExtract(enc);
    expect(r.detected).toBe('tag-block');
    expect(r.extracted).toBe('Hello, World!');
    expect(r.hiddenCharCount).toBeGreaterThan(0);
    expect(r.confidence).toMatch(/medium|high/);
  });

  it('detects combining-marks output', () => {
    const enc = encodeCombining('o', 'red team');
    const r = detectAndExtract(enc);
    expect(r.detected).toBe('combining-marks');
    expect(r.extracted).toBe('red team');
    expect(r.confidence).toBe('medium');
  });

  it('returns null on plain text', () => {
    const r = detectAndExtract('hello world');
    expect(r.detected).toBeNull();
    expect(r.extracted).toBe('');
    expect(r.confidence).toBe('low');
    expect(r.hiddenCharCount).toBe(0);
  });

  it('returns null on empty input', () => {
    expect(detectAndExtract('').detected).toBeNull();
  });

  it('high confidence at ≥10 tag-block codepoints', () => {
    // 5 bytes ASCII = 10 nibbles
    const r = detectAndExtract(encodeTagBlock('🐍', 'hello'));
    expect(r.confidence).toBe('high');
  });

  it('high confidence at ≥16 variation selectors', () => {
    // 2 bytes ASCII = 16 bits + 1 leading presentation = 17 selectors
    const r = detectAndExtract(encodeEmoji('🐍', 'ab'));
    expect(r.confidence).toBe('high');
  });
});

describe('estimateTokenCost', () => {
  it('returns positive cl100k count for plain ASCII', async () => {
    const r = await estimateTokenCost('hello');
    expect(r.cl100k).toBeGreaterThan(0);
    expect(r.chars).toBe(5);
    expect(r.bytes).toBe(5);
  });

  it('reports byte count for multi-byte UTF-8', async () => {
    const r = await estimateTokenCost('日本');
    expect(r.chars).toBe(2);
    expect(r.bytes).toBe(6); // each CJK char is 3 bytes in UTF-8
  });

  it('returns zero-but-defined for empty string', async () => {
    const r = await estimateTokenCost('');
    expect(r.cl100k).toBe(0);
    expect(r.chars).toBe(0);
    expect(r.bytes).toBe(0);
  });
});
