/**
 * Text-splitting algorithms ported from js/tools/SplitterTool.js.
 * Mode-specific implementations kept pure so the UI layer stays thin
 * and this module can be covered by Vitest.
 */

export type SplitMode = 'chunk' | 'word' | 'sentence' | 'line' | 'pattern' | 'token';
export type TokenizerName = 'cl100k' | 'o200k' | 'p50k' | 'r50k';

export type SplitOptions = {
  mode: SplitMode;
  chunkSize: number;
  wordSkip: number;
  minWordLength: number;
  splitFirstWord: boolean;
  pattern: string;
  patternIncludeDelimiter: boolean;
  preserveEmptyLines: boolean;
  tokenizer: TokenizerName;
  tokenCount: number;
};

export const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
  mode: 'word',
  chunkSize: 6,
  wordSkip: 0,
  minWordLength: 2,
  splitFirstWord: true,
  pattern: '\\s+',
  patternIncludeDelimiter: false,
  preserveEmptyLines: false,
  tokenizer: 'cl100k',
  tokenCount: 3
};

export function splitByChunk(text: string, chunkSize: number): string[] {
  const size = Math.max(1, Math.min(500, chunkSize || 6));
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

export function splitBySentence(text: string): string[] {
  return text
    .split(/[.!?]+/g)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());
}

export function splitByLine(text: string, preserveEmpty: boolean): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0 || preserveEmpty);
}

export function splitByPattern(text: string, pattern: string, includeDelimiter: boolean): string[] {
  const p = pattern || '\\s+';
  const regex = new RegExp(p, 'g');
  if (includeDelimiter) return text.split(regex).filter((x) => x.length > 0);
  return text.split(regex).filter((x) => x.trim().length > 0);
}

/**
 * Word-split mode — the messiest one. Matches the legacy contract:
 *   - Words shorter than minLength are kept whole.
 *   - Every (skipCount + 1)th splittable word gets bisected.
 *   - The first half + trailing whole-words get attached to the *next* message,
 *     preserving the "secondHalf + wholeWords + firstHalf" rotating pattern.
 *   - Minor simplification vs legacy: we don't implement the `wordSplitSide`
 *     even/odd lean (legacy toggle that rarely gets used). Can be restored later.
 */
export function splitByWord(text: string, opts: SplitOptions): string[] {
  const words: string[] = Array.from(text.match(/\S+/g) ?? []);
  if (words.length === 0) return [];

  const skipCount = Math.max(0, Math.min(20, opts.wordSkip || 0));
  const minLength = Math.max(1, opts.minWordLength || 2);

  let prependToFirst: string[] = [];
  let wordsToProcess: string[] = words;
  if (!opts.splitFirstWord && words.length > 0) {
    prependToFirst = [words[0]];
    wordsToProcess = words.slice(1);
  }

  const wordData = wordsToProcess.map((w, idx) => ({ word: w, canSplit: w.length >= minLength && w.length > 1, index: idx }));
  const splittable = wordData.filter((w) => w.canSplit);
  if (splittable.length === 0) {
    return [[...prependToFirst, ...wordsToProcess].join(' ')];
  }

  const splitIndexes = new Set<number>();
  for (let i = 0; i < splittable.length; i++) {
    if (i % (skipCount + 1) === 0) splitIndexes.add(splittable[i].index);
  }

  const messages: string[] = [];
  let current: string[] = [...prependToFirst];
  for (let i = 0; i < wordData.length; i++) {
    const { word } = wordData[i];
    if (!splitIndexes.has(i)) {
      current.push(word);
      continue;
    }
    const mid = Math.floor(word.length / 2);
    const first = word.slice(0, mid);
    const second = word.slice(mid);
    current.push(first);
    if (current.length > 0) messages.push(current.join(''));
    current = [second];
  }
  if (current.length > 0) messages.push(current.join(''));

  return messages;
}

/**
 * Token-mode split — uses gpt-tokenizer. Dynamically imports to keep the
 * main chunk small (only loaded when a user actually picks Tokenizer mode).
 */
export async function splitByToken(
  text: string,
  tokenizer: TokenizerName,
  tokenCount: number
): Promise<string[]> {
  if (!text) return [];
  const count = Math.max(1, Math.min(1000, tokenCount || 3));
  const encoder = await loadEncoder(tokenizer);
  const tokens = encoder.encode(text);

  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += count) {
    chunks.push(encoder.decode(tokens.slice(i, i + count)));
  }
  return chunks;
}

type Encoder = { encode: (text: string) => number[]; decode: (tokens: number[]) => string };

const encoderCache = new Map<TokenizerName, Encoder>();

async function loadEncoder(name: TokenizerName): Promise<Encoder> {
  const cached = encoderCache.get(name);
  if (cached) return cached;

  // Lazy-load the specific encoder module from gpt-tokenizer
  let mod: { encode: (t: string) => number[]; decode: (t: number[]) => string };
  switch (name) {
    case 'o200k':
      mod = await import('gpt-tokenizer/encoding/o200k_base');
      break;
    case 'p50k':
      mod = await import('gpt-tokenizer/encoding/p50k_edit');
      break;
    case 'r50k':
      mod = await import('gpt-tokenizer/encoding/r50k_base');
      break;
    case 'cl100k':
    default:
      mod = await import('gpt-tokenizer/encoding/cl100k_base');
  }
  const encoder: Encoder = { encode: (t) => mod.encode(t), decode: (t) => mod.decode(t) };
  encoderCache.set(name, encoder);
  return encoder;
}

/**
 * Main dispatcher. Resolves to an ordered list of message strings per the chosen mode.
 */
export async function runSplit(input: string, opts: SplitOptions): Promise<string[]> {
  if (!input) return [];
  switch (opts.mode) {
    case 'chunk':    return splitByChunk(input, opts.chunkSize);
    case 'word':     return splitByWord(input, opts);
    case 'sentence': return splitBySentence(input);
    case 'line':     return splitByLine(input, opts.preserveEmptyLines);
    case 'pattern':  return splitByPattern(input, opts.pattern, opts.patternIncludeDelimiter);
    case 'token':    return await splitByToken(input, opts.tokenizer, opts.tokenCount);
  }
}

/**
 * Apply optional wrapping to each message. The `{n}` iterator marker in
 * either wrapper is replaced with the 1-based message index.
 */
export function applyWrapping(
  messages: string[],
  startWrap: string,
  endWrap: string,
  iteratorMarker = '{n}'
): string[] {
  if (!startWrap && !endWrap) return messages;
  return messages.map((msg, i) => {
    const idx = String(i + 1);
    const start = startWrap.replaceAll(iteratorMarker, idx);
    const end = endWrap.replaceAll(iteratorMarker, idx);
    return start + msg + end;
  });
}
