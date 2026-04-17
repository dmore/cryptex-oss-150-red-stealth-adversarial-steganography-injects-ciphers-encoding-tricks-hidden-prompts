/**
 * Universal decoder — port of js/core/decoder.js.
 * Tries every transformer with a `detector` first (high priority), then
 * the currently active transform (medium priority context hint), then
 * every other `reverse`-capable transformer as a last-resort brute scan.
 *
 * Returns a ranked result `{ text, method, alternatives }` where
 * alternatives is the full list sorted by priority (excluding the primary).
 */

import { getTransformer, transformers } from './registry';
import type { Transformer } from './registry';
import { getMergedTransformOptions } from './options';
import { hasEmojiInText, decodeEmoji } from '$lib/stego';

export type DecodeAlternative = { text: string; method: string };
export type DecodeResult = {
  text: string;
  method: string;
  alternatives: DecodeAlternative[];
};

export type DecodeContext = {
  activeTab?: string;
  activeTransform?: Transformer | { name: string } | null;
};

function hasReadableContent(result: string): boolean {
  // Legacy parity: non-control / non-whitespace characters
  return result.replace(/[\x00-\x1F\x7F-\x9F\s]/g, '').length > 0;
}

export function universalDecode(
  input: string,
  context: DecodeContext = {}
): DecodeResult | null {
  if (!input) return null;

  type Candidate = { text: string; method: string; priority: number };
  const found: Candidate[] = [];

  function addDecoding(text: string, method: string, priority = 20) {
    if (!text || text === input || text.length === 0) return;
    if (found.some((d) => d.text === text)) return;
    found.push({ text, method, priority });
  }

  // 1) Every transformer with a detector+reverse: try it. High confidence.
  for (const transform of Object.values(transformers)) {
    if (!transform.detector || !transform.reverse) continue;
    try {
      if (!transform.detector(input)) continue;
      const opts = getMergedTransformOptions(transform);
      const result = transform.reverse(input, opts);
      if (result && result !== input && hasReadableContent(result)) {
        addDecoding(result, transform.name, transform.priority ?? 285);
      }
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('decoder: detector threw', transform.name, err);
    }
  }

  // 2) Emoji steganography heuristic (separate path since it's data-driven, not detector-driven)
  if (hasEmojiInText(input)) {
    try {
      const decoded = decodeEmoji(input);
      if (decoded) addDecoding(decoded, 'Emoji Steganography', 100);
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('decoder: emoji stego threw', err);
    }
  }

  // 3) Context hint: if the Transform tab is open and a transform is active,
  //    boost its reverse path above ambient noise.
  const { activeTab, activeTransform } = context;
  if (activeTab === 'transforms' && activeTransform) {
    try {
      const t = getTransformer(activeTransform.name);
      if (t?.reverse) {
        const opts = getMergedTransformOptions(t);
        const result = t.reverse(input, opts);
        if (result && result !== input) addDecoding(result, t.name, 150);
      }
    } catch (err) {
      if (typeof console !== 'undefined') console.error('decoder: active transform threw', err);
    }
  }

  // 4) Brute-scan: every transformer with reverse but no detector.
  //    Only accept if the result looks like it could be human text.
  const readableRegex = /[a-zA-Z0-9\s]{3,}/;
  for (const transform of Object.values(transformers)) {
    if (!transform.reverse || transform.detector) continue;
    try {
      const opts = getMergedTransformOptions(transform);
      const result = transform.reverse(input, opts);
      if (result !== input && readableRegex.test(result)) {
        addDecoding(result, transform.name, 10);
      }
    } catch (err) {
      // Silent: brute scan is expected to fail for most inputs.
      void err;
    }
  }

  if (found.length === 0) return null;
  found.sort((a, b) => b.priority - a.priority);

  const primary = found[0];
  const alternatives = found.slice(1).map(({ text, method }) => ({ text, method }));
  return { text: primary.text, method: primary.method, alternatives };
}
