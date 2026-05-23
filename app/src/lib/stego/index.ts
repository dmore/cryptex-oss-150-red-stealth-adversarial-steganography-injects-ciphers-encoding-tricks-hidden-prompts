/**
 * Public surface of the steganography engine. Aggregates the modular
 * encoders/decoders and surfaces the forensics helpers + tokenizer cost
 * estimator.
 *
 * Consumers should import from `$lib/stego` (which re-exports this module),
 * not from individual files — the directory layout is an implementation detail.
 */
export type { StegMode, StegOptions, Carrier, DetectionResult } from './types';
export {
  SUGGESTED_CARRIERS,
  carriers,
  isValidEmojiCarrier,
  hasEmojiInText,
  findEmojiMatch
} from './carriers';
export {
  encodeEmoji,
  encodeTagBlock,
  encodeCombining,
  encodeInvisible,
  getStegOptions,
  setStegOptions,
  resetStegOptions,
  TAG_BLOCK_BASE,
  COMBINING_BASE,
  COMBINING_MASK
} from './encode';
export {
  decodeEmoji,
  decodeTagBlock,
  decodeCombining,
  decodeInvisible,
  detectAndExtract,
  decodeAny
} from './decode';

/**
 * Estimate token cost for a string against the cl100k_base BPE encoding
 * (the encoding used by GPT-3.5 / GPT-4). Tokenizer is loaded on demand
 * so the initial bundle stays small.
 *
 * Returns `{ cl100k: 0, ... }` when the tokenizer fails to load — callers
 * should treat zero as "unknown".
 */
export async function estimateTokenCost(
  s: string
): Promise<{ cl100k: number; chars: number; bytes: number }> {
  const chars = s.length;
  const bytes = new Blob([s]).size;
  try {
    const { encode } = await import('gpt-tokenizer/encoding/cl100k_base');
    return { cl100k: encode(s).length, chars, bytes };
  } catch {
    return { cl100k: 0, chars, bytes };
  }
}
