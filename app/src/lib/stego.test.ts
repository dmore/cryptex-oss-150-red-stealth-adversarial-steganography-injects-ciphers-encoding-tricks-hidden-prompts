import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeEmoji,
  decodeEmoji,
  encodeInvisible,
  decodeInvisible,
  hasEmojiInText,
  resetStegOptions,
  setStegOptions
} from './stego';

describe('stego emoji encode/decode', () => {
  beforeEach(() => resetStegOptions());

  it('round-trips ASCII text through emoji carrier', () => {
    const encoded = encodeEmoji('🐉', 'hello');
    const decoded = decodeEmoji(encoded);
    expect(decoded).toBe('hello');
  });

  it('round-trips Unicode text (multi-byte UTF-8)', () => {
    const encoded = encodeEmoji('🦎', 'héllo — 你好');
    const decoded = decodeEmoji(encoded);
    expect(decoded).toBe('héllo — 你好');
  });

  it('empty payload yields bare emoji', () => {
    expect(encodeEmoji('🐍', '')).toBe('🐍');
  });

  it('honors bitOrder lsb', () => {
    setStegOptions({ bitOrder: 'lsb' });
    const encoded = encodeEmoji('🐊', 'xyz');
    const decoded = decodeEmoji(encoded);
    expect(decoded).toBe('xyz');
  });

  it('detects emoji presence via fallback regex when emojiData is empty', () => {
    expect(hasEmojiInText('hello 🐉')).toBe(true);
    expect(hasEmojiInText('no emoji here')).toBe(false);
  });
});

describe('stego invisible Unicode Tags', () => {
  it('round-trips ASCII through the Tags block', () => {
    const encoded = encodeInvisible('hello world');
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded).toMatch(/[\uE0000-\uE007F]/);
    expect(decodeInvisible(encoded)).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(encodeInvisible('')).toBe('');
    expect(decodeInvisible('')).toBe('');
  });
});
