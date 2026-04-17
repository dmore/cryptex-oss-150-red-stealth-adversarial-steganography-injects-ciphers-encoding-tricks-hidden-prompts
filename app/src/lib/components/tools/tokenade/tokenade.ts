/**
 * Tokenade generator — ported from js/tools/TokenadeTool.js (line-for-line
 * algorithmic parity, no UI concerns).
 */

export type Separator = 'zwj' | 'zwnj' | 'zwsp' | 'none';

export type TokenadeOptions = {
  depth: number;
  breadth: number;
  repeats: number;
  separator: Separator;
  includeVS: boolean;
  includeNoise: boolean;
  randomizeEmojis: boolean;
  singleCarrier: boolean;
  carrier: string;
};

export const DEFAULT_TOKENADE: TokenadeOptions = {
  depth: 3,
  breadth: 4,
  repeats: 5,
  separator: 'zwnj',
  includeVS: true,
  includeNoise: true,
  randomizeEmojis: true,
  singleCarrier: true,
  carrier: '💥'
};

export const QUICK_CARRIERS = ['🐍','🐉','🐲','🔥','💥','🗿','⚓','⭐','✨','🚀','💀','🪨','🍃','🪶','🔮','🐢','🐊','🦎'];

const ZW_PARTS = ['\u200B','\u200C','\u200D','\u2060','\u2062','\u2063'];

function sepChar(s: Separator): string {
  switch (s) {
    case 'zwj':  return '\u200D';
    case 'zwnj': return '\u200C';
    case 'zwsp': return '\u200B';
    default:     return '';
  }
}

function pickEmojis(count: number, pool: string[], randomize: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = randomize ? Math.floor(Math.random() * pool.length) : i % pool.length;
    out.push(String(pool[idx]));
  }
  return out;
}

function noise(enabled: boolean): string {
  if (!enabled) return '';
  const n = 1 + Math.floor(Math.random() * 3);
  let s = '';
  for (let i = 0; i < n; i++) s += ZW_PARTS[Math.floor(Math.random() * ZW_PARTS.length)];
  return s;
}

function addVS(str: string, enabled: boolean): string {
  if (!enabled) return str;
  const vs16 = '\uFE0F';
  const vs15 = '\uFE0E';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += str[i] + (i % 2 === 0 ? vs16 : vs15);
  }
  return out;
}

function toTagSeqForEmojiChar(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  const hex = cp.toString(16);
  let seq = '';
  for (const d of hex) {
    if (d >= '0' && d <= '9') {
      seq += String.fromCodePoint(0xe0030 + (d.charCodeAt(0) - '0'.charCodeAt(0)));
    } else {
      seq += String.fromCodePoint(0xe0061 + (d.charCodeAt(0) - 'a'.charCodeAt(0)));
    }
  }
  seq += String.fromCodePoint(0xe007f);
  return seq;
}

export function generateTokenade(opts: TokenadeOptions, pool: string[] = QUICK_CARRIERS): string {
  const depth = Math.max(1, Math.min(8, opts.depth || 1));
  const breadth = Math.max(1, Math.min(10, opts.breadth || 1));
  const repeats = Math.max(1, Math.min(50, opts.repeats || 1));
  const sep = sepChar(opts.separator);

  const runtimePool = pool && pool.length ? pool : QUICK_CARRIERS;

  function buildLevel(level: number): string {
    if (level === 0) return addVS(pickEmojis(breadth, runtimePool, opts.randomizeEmojis).join(''), opts.includeVS);
    const items: string[] = [];
    for (let i = 0; i < breadth; i++) items.push(buildLevel(level - 1) + noise(opts.includeNoise));
    return items.join(sep);
  }

  if (opts.singleCarrier) {
    const carrier = (opts.carrier && String(opts.carrier).trim()) || '💥';
    function countUnits(level: number): number {
      return level === 0 ? breadth : breadth * countUnits(level - 1);
    }
    const unitsPerBlock = countUnits(depth - 1);
    const totalUnits = Math.max(1, repeats * unitsPerBlock);
    const payload = pickEmojis(totalUnits, runtimePool, opts.randomizeEmojis);

    const vs16 = opts.includeVS ? '\uFE0F' : '';
    let out = carrier + vs16;
    for (let i = 0; i < payload.length; i++) {
      out += sep + toTagSeqForEmojiChar(payload[i]) + noise(opts.includeNoise);
    }
    return out;
  }

  const block = buildLevel(depth - 1);
  const blocks: string[] = [];
  for (let i = 0; i < repeats; i++) blocks.push(block + noise(opts.includeNoise));
  return blocks.join(sep);
}

export function estimateTokenadeLength(opts: TokenadeOptions): number {
  const depth = Math.max(1, Math.min(8, opts.depth || 1));
  const breadth = Math.max(1, Math.min(10, opts.breadth || 1));
  const repeats = Math.max(1, Math.min(50, opts.repeats || 1));
  const sepLen = opts.separator === 'none' ? 0 : 1;
  const vsPer = opts.includeVS ? 1 : 0;
  const noiseAvg = opts.includeNoise ? 2 : 0;

  function lenLevel(level: number): number {
    if (level === 0) return breadth * (1 + vsPer);
    const inner = lenLevel(level - 1);
    return breadth * (inner + noiseAvg) + Math.max(0, breadth - 1) * sepLen;
  }

  if (opts.singleCarrier) {
    function countUnits(level: number): number {
      return level === 0 ? breadth : breadth * countUnits(level - 1);
    }
    const unitsPerBlock = countUnits(depth - 1);
    const totalUnits = Math.max(1, repeats * unitsPerBlock);
    const avgDigits = 5;
    const perUnit = avgDigits + 1 + sepLen + (opts.includeNoise ? 2 : 0);
    const carrierLen = 1 + (opts.includeVS ? 1 : 0);
    return carrierLen + totalUnits * perUnit;
  }

  const blockLen = lenLevel(depth - 1);
  return repeats * (blockLen + noiseAvg) + Math.max(0, repeats - 1) * sepLen;
}

export type TextPayloadOptions = {
  base: string;
  repeat: number;
  combining: boolean;
  zeroWidth: boolean;
};

export function generateTextPayload(opts: TextPayloadOptions): string {
  const base = String(opts.base || 'A');
  const count = Math.max(1, Math.min(10000, opts.repeat || 1));
  const marks = ['\u0301','\u0300','\u0302','\u0303','\u0308','\u0307','\u0304'];
  const zw = ['\u200B','\u200C','\u200D','\u2060'];
  let out = '';
  for (let i = 0; i < count; i++) {
    let token = base;
    if (opts.combining) token += marks[i % marks.length];
    if (opts.zeroWidth) token += zw[i % zw.length];
    out += token;
  }
  return out;
}

export const TOKENADE_PRESETS: Record<string, Partial<TokenadeOptions>> = {
  feather: { depth: 1, breadth: 3, repeats: 2, separator: 'zwnj', includeVS: false, includeNoise: false, randomizeEmojis: true },
  light:   { depth: 2, breadth: 3, repeats: 3, separator: 'zwnj', includeVS: false, includeNoise: true,  randomizeEmojis: true },
  middle:  { depth: 3, breadth: 4, repeats: 6, separator: 'zwnj', includeVS: true,  includeNoise: true,  randomizeEmojis: true },
  heavy:   { depth: 4, breadth: 6, repeats: 12, separator: 'zwnj', includeVS: true, includeNoise: true,  randomizeEmojis: true },
  super:   { depth: 5, breadth: 8, repeats: 18, separator: 'zwnj', includeVS: true, includeNoise: true,  randomizeEmojis: true }
};
