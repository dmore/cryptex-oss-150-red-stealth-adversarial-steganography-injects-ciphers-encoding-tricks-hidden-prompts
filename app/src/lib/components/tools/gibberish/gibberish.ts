/**
 * Pure logic port of the legacy GibberishTool (js/tools/GibberishTool.js).
 * Same algorithms — seeded RNG, consistent word-dictionary, character removal.
 * No Vue deps. Covered by a Vitest parity test.
 */

// sin-based seeded PRNG used for sentence-to-gibberish
export function seededRandomSin(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// XorShift-like seeded RNG factory (matches legacy seededRandomFactory)
export function seededRandomFactory(seedStr: string): () => number {
  if (!seedStr) return Math.random;
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function generateGibberishWord(word: string, seed: number, chars: string): string {
  const length = Math.max(4, word.length);
  let out = '';
  for (let i = 0; i < length; i++) {
    const r = seededRandomSin(seed + i * 0.1);
    out += chars[Math.floor(r * chars.length)];
  }
  return out;
}

export type GibberishResult = { output: string; dictionary: string };

export function sentenceToGibberish(
  input: string,
  seedInput: string,
  chars: string
): GibberishResult {
  const src = String(input || '');
  if (!src) return { output: '', dictionary: '' };

  const words = src.match(/\b\w+\b/g) || [];
  const dictionary: Record<string, string> = {};
  let wordIndex = 0;

  for (const word of words) {
    const lowerWord = word.toLowerCase();
    const seed = seedInput === '' ? Math.random() * 100 : Number(seedInput);
    if (!dictionary[lowerWord]) {
      dictionary[lowerWord] = generateGibberishWord(word, seed + wordIndex * 100, chars);
      wordIndex++;
    }
  }

  let out = '';
  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (/\w/.test(char)) {
      let j = i;
      while (j < src.length && /\w/.test(src[j])) j++;
      const slice = src.substring(i, j).toLowerCase();
      out += dictionary[slice];
      i = j - 1;
    } else {
      out += char;
    }
  }

  const dictString =
    '{' +
    Object.entries(dictionary)
      .map(([plain, gib]) => `"${plain}": "${gib}"`)
      .join(', ') +
    '}';

  return { output: out, dictionary: dictString };
}

export type RandomRemovalOptions = {
  variations: number;
  minLetters: number;
  maxLetters: number;
  seed: string;
};

export function generateRandomRemovals(input: string, opts: RandomRemovalOptions): string[] {
  const seed = opts.seed ? String(opts.seed) : String(Date.now());
  const rng = seededRandomFactory(seed);
  const words = input.split(/\s+/);
  const out: string[] = [];

  for (let v = 0; v < opts.variations; v++) {
    const modified = words.map((word) => {
      if (word.length <= 1 || !/[a-zA-Z]/.test(word)) return word;

      const minRemove = Math.max(0, opts.minLetters);
      const maxRemove = Math.min(word.length - 1, opts.maxLetters);
      const numToRemove = minRemove + Math.floor(rng() * (maxRemove - minRemove + 1));
      if (numToRemove === 0) return word;

      const letters = word
        .split('')
        .map((c, i) => ({ char: c, index: i }))
        .filter((item) => /[a-zA-Z]/.test(item.char));

      const toRemove = new Set<number>();
      const maxAttempts = numToRemove * 3;
      let attempts = 0;
      while (toRemove.size < Math.min(numToRemove, letters.length) && attempts < maxAttempts) {
        const idx = Math.floor(rng() * letters.length);
        toRemove.add(letters[idx].index);
        attempts++;
      }
      return word
        .split('')
        .filter((_, i) => !toRemove.has(i))
        .join('');
    });
    out.push(modified.join(' '));
  }

  return out;
}

export function removeSpecificChars(input: string, charsToRemove: string): string {
  const set = new Set(charsToRemove.split(''));
  return input
    .split('')
    .filter((c) => !set.has(c))
    .join('');
}
