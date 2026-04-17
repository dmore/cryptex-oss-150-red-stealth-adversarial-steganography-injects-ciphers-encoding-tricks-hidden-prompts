/**
 * Steganography engine — port of js/core/steganography.js.
 * Zero Vue deps. Reads from globalThis.emojiData when available (populated
 * by the emoji build pipeline in Phase 3); falls back to a conservative
 * Unicode range regex otherwise.
 */

export type StegOptions = {
  bitZeroVS: string;
  bitOneVS: string;
  initialPresentation: 'emoji' | 'text' | 'none';
  trailingZW: string | null;
  interBitZW: string | null;
  interBitEvery: number;
  bitOrder: 'msb' | 'lsb';
};

const DEFAULTS: StegOptions = {
  bitZeroVS: '\ufe0e',
  bitOneVS: '\ufe0f',
  initialPresentation: 'emoji',
  trailingZW: '\u200B',
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

export type Carrier = { emoji: string; name: string; desc: string };

export const carriers: ReadonlyArray<Carrier> = Object.freeze([
  { emoji: '🐍', name: 'SNAKE',     desc: 'Classic Snake' },
  { emoji: '🐉', name: 'DRAGON',    desc: 'Mystical Dragon' },
  { emoji: '🦎', name: 'LIZARD',    desc: 'Sneaky Lizard' },
  { emoji: '🐊', name: 'CROCODILE', desc: 'Dangerous Croc' }
]);

// --- Emoji detection ---------------------------------------------------------

const FALLBACK_EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}]/u;

function getEmojiDataKeys(): string[] {
  const data = (globalThis as Record<string, unknown>).emojiData as
    | Record<string, unknown>
    | undefined;
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data).filter((key) => {
    const value = (data as Record<string, unknown>)[key];
    return typeof value === 'object' && value !== null && 'official' in (value as Record<string, unknown>);
  });
}

export function hasEmojiInText(text: string): boolean {
  if (!text) return false;
  const keys = getEmojiDataKeys();
  if (keys.length > 0 && keys.some((emoji) => text.includes(emoji))) return true;
  return FALLBACK_EMOJI_REGEX.test(text);
}

export function findEmojiMatch(text: string): RegExpMatchArray | null {
  if (!text) return null;

  const keys = getEmojiDataKeys();
  if (keys.length > 0) {
    keys.sort((a, b) => b.length - a.length);
    const escaped = keys.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'u');
    const match = text.match(regex);
    if (match) return match;
  }

  const flag = /([\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}])/u;
  const single = /([\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}])/u;
  return text.match(flag) || text.match(single);
}

// --- UTF-8 bit encoding ------------------------------------------------------

function utf8BitString(text: string, bitOrder: 'msb' | 'lsb'): string {
  try {
    const bytes = new TextEncoder().encode(text);
    return Array.from(bytes)
      .map((byte) => {
        let s = byte.toString(2).padStart(8, '0');
        if (bitOrder === 'lsb') s = s.split('').reverse().join('');
        return s;
      })
      .join('');
  } catch {
    // TextEncoder should always be present; unreachable in modern browsers.
    return Array.from(text)
      .map((c) => {
        const cp = c.codePointAt(0)!;
        const bytes: number[] = [];
        if (cp <= 0x7f) bytes.push(cp);
        else if (cp <= 0x7ff) { bytes.push(0xc0 | (cp >> 6)); bytes.push(0x80 | (cp & 0x3f)); }
        else if (cp <= 0xffff) { bytes.push(0xe0 | (cp >> 12)); bytes.push(0x80 | ((cp >> 6) & 0x3f)); bytes.push(0x80 | (cp & 0x3f)); }
        else { bytes.push(0xf0 | (cp >> 18)); bytes.push(0x80 | ((cp >> 12) & 0x3f)); bytes.push(0x80 | ((cp >> 6) & 0x3f)); bytes.push(0x80 | (cp & 0x3f)); }
        return bytes
          .map((b) => {
            let s = b.toString(2).padStart(8, '0');
            if (bitOrder === 'lsb') s = s.split('').reverse().join('');
            return s;
          })
          .join('');
      })
      .join('');
  }
}

// --- Emoji encode/decode -----------------------------------------------------

export function encodeEmoji(emoji: string, text: string, opts?: Partial<StegOptions>): string {
  const o = { ...current, ...(opts || {}) };
  if (!text) return emoji;

  const binary = utf8BitString(text, o.bitOrder);

  let result = emoji;
  if (o.initialPresentation === 'emoji') result += '\ufe0f';
  else if (o.initialPresentation === 'text') result += '\ufe0e';

  const vs0 = o.bitZeroVS || '\ufe0e';
  const vs1 = o.bitOneVS || '\ufe0f';
  const every = Math.max(1, o.interBitEvery);

  for (let i = 0; i < binary.length; i++) {
    result += binary[i] === '0' ? vs0 : vs1;
    if (o.interBitZW && i < binary.length - 1 && ((i + 1) % every) === 0) {
      result += o.interBitZW;
    }
  }
  if (o.trailingZW) result += o.trailingZW;
  return result;
}

export function decodeEmoji(text: string, opts?: Partial<StegOptions>): string {
  const o = { ...current, ...(opts || {}) };
  if (!text) return '';

  const match = findEmojiMatch(text);
  if (!match || match.index === undefined) return '';

  const emojiChar = match[1];
  const fromEmoji = text.substring(match.index);
  const escaped = emojiChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}([\ufe0e\ufe0f\u200B\u200C\u200D\ufeff]+)`, 'u');
  const data = fromEmoji.match(pattern);
  if (!data || !data[1]) return '';

  const rawSeq = data[1];
  const matches = [...rawSeq.matchAll(/[\ufe0e\ufe0f]/g)];
  if (matches.length === 0) return '';

  const skip = o.initialPresentation === 'none' ? 0 : 1;
  if (matches.length <= skip) return '';

  const vs0 = o.bitZeroVS || '\ufe0e';
  const vs1 = o.bitOneVS || '\ufe0f';
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

// --- Invisible Unicode Tags --------------------------------------------------

export function encodeInvisible(text: string): string {
  if (!text) return '';
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes).map((b) => String.fromCodePoint(0xe0000 + b)).join('');
}

export function decodeInvisible(text: string): string {
  if (!text) return '';
  const matches = [...text.matchAll(/[\uE0000-\uE007F]/g)];
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
