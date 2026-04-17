/**
 * Mutation Lab / Fuzzer — ported from js/tools/MutationTool.js.
 * Takes a seed + a set of mutation toggles and emits N variants.
 */

import { getTransformer } from '$lib/transformers/registry';

export type FuzzerOptions = {
  count: number;
  seed: string;
  useRandomMix: boolean;
  zeroWidth: boolean;
  unicodeNoise: boolean;
  zalgo: boolean;
  whitespace: boolean;
  casing: boolean;
  encodeShuffle: boolean;
};

export const DEFAULT_FUZZER: FuzzerOptions = {
  count: 20,
  seed: '',
  useRandomMix: true,
  zeroWidth: true,
  unicodeNoise: true,
  zalgo: false,
  whitespace: true,
  casing: true,
  encodeShuffle: false
};

// Matches the legacy seededRandomFactory (xorshift-ish)
export function seededRandomFactory(seedStr: string): () => number {
  if (!seedStr) return Math.random;
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rnd: () => number): T { return arr[Math.floor(rnd() * arr.length)]; }

function injectZeroWidth(text: string, rnd: () => number): string {
  const zw = ['\u200B', '\u200C', '\u200D', '\u2060'];
  return Array.from(text).map((ch) => (rnd() < 0.2 ? ch + pick(zw, rnd) : ch)).join('');
}

function injectUnicodeNoise(text: string, rnd: () => number): string {
  const marks = ['\u0301','\u0300','\u0302','\u0303','\u0308','\u0307','\u0304'];
  return Array.from(text).map((ch) => (rnd() < 0.15 ? ch + pick(marks, rnd) : ch)).join('');
}

function whitespaceChaos(text: string, rnd: () => number): string {
  return text.replace(/\s/g, (m) => (rnd() < 0.5 ? m : rnd() < 0.5 ? '\t' : '\u00A0'));
}

function casingChaos(text: string, rnd: () => number): string {
  return Array.from(text)
    .map((c) => (/[a-z]/i.test(c) ? (rnd() < 0.5 ? c.toUpperCase() : c.toLowerCase()) : c))
    .join('');
}

const HOMOGLYPH_MAP: Record<string, string> = {
  A: 'Α', B: 'Β', C: 'Ϲ', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ',
  a: 'а', c: 'с', e: 'е', i: 'і', j: 'ј', o: 'о', p: 'р', s: 'ѕ', x: 'х', y: 'у'
};

function encodeShuffle(text: string, rnd: () => number): string {
  return Array.from(text)
    .map((ch) => (HOMOGLYPH_MAP[ch] && rnd() < 0.25 ? HOMOGLYPH_MAP[ch] : ch))
    .join('');
}

function safeRandomizerApply(text: string): string {
  const randomizer = getTransformer('Random Mix') || getTransformer('Randomizer') || getTransformer('Random');
  if (!randomizer) return text;
  try {
    return randomizer.func(text, { minTransforms: 2, maxTransforms: 4 });
  } catch {
    return text;
  }
}

function safeZalgoApply(text: string): string {
  const zalgo = getTransformer('Zalgo');
  if (!zalgo) return text;
  try {
    return zalgo.func(text);
  } catch {
    return text;
  }
}

export function generateFuzzCases(input: string, opts: FuzzerOptions): string[] {
  const src = String(input || '');
  if (!src) return [];
  const rnd = seededRandomFactory(String(opts.seed || ''));
  const count = Math.max(1, Math.min(500, Number(opts.count) || 1));

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = src;
    if (opts.useRandomMix) s = safeRandomizerApply(s);
    if (opts.zeroWidth) s = injectZeroWidth(s, rnd);
    if (opts.unicodeNoise) s = injectUnicodeNoise(s, rnd);
    if (opts.whitespace) s = whitespaceChaos(s, rnd);
    if (opts.casing) s = casingChaos(s, rnd);
    if (opts.zalgo) s = safeZalgoApply(s);
    if (opts.encodeShuffle) s = encodeShuffle(s, rnd);
    out.push(s);
  }
  return out;
}
