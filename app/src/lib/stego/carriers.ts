/**
 * Carrier helpers — a curated set of suggested emojis plus a permissive
 * validator. The validator accepts ANY Extended_Pictographic codepoint or
 * a regional-indicator flag pair, so users can paste skin-tone modifiers,
 * ZWJ family sequences, country flags, mythical emojis, etc.
 */
export const SUGGESTED_CARRIERS: ReadonlyArray<{ emoji: string; name: string }> = Object.freeze([
  { emoji: '🐍', name: 'Snake' },
  { emoji: '🐉', name: 'Dragon' },
  { emoji: '🦎', name: 'Lizard' },
  { emoji: '🐊', name: 'Crocodile' },
  { emoji: '🫡', name: 'Saluting face' },
  { emoji: '🧠', name: 'Brain' },
  { emoji: '🔒', name: 'Lock' },
  { emoji: '🗝️', name: 'Key' },
  { emoji: '🪄', name: 'Magic wand' },
  { emoji: '👀', name: 'Eyes' },
  { emoji: '🔥', name: 'Fire' },
  { emoji: '💎', name: 'Gem' }
]);

/** Backwards-compatible legacy shape used by older code paths and tests. */
export type Carrier = { emoji: string; name: string; desc: string };

/** Legacy four-emoji list — kept so existing imports (`carriers`) keep compiling. */
export const carriers: ReadonlyArray<Carrier> = Object.freeze([
  { emoji: '🐍', name: 'SNAKE', desc: 'Classic Snake' },
  { emoji: '🐉', name: 'DRAGON', desc: 'Mystical Dragon' },
  { emoji: '🦎', name: 'LIZARD', desc: 'Sneaky Lizard' },
  { emoji: '🐊', name: 'CROCODILE', desc: 'Dangerous Croc' }
]);

/**
 * Permissive carrier validation. Returns true when the string contains at
 * least one Extended_Pictographic codepoint OR a regional-indicator flag pair.
 *
 * Intentionally lenient — we want to encourage exploration. Pre-modern Node
 * versions without `\p{...}` support fall back to false (no Unicode property
 * escape support means we can't safely validate).
 */
export function isValidEmojiCarrier(s: string): boolean {
  if (!s) return false;
  try {
    return /\p{Extended_Pictographic}/u.test(s) || /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(s);
  } catch {
    return false;
  }
}

// --- Emoji detection (used by the variation-selectors decoder) --------------

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

  // Match the maximal carrier grapheme so encode/decode operate on the same
  // prefix. The pattern is:
  //   base emoji + optional skin-tone (+ ZWJ + next base + optional skin-tone)*
  //
  // We intentionally exclude trailing FE0F (variation-16) here — the steg
  // encoder appends FE0F as its leading presentation selector, and the
  // decoder treats that selector as the first "bit" to skip. If we swallowed
  // it into the carrier, decoding would lose the first real bit.
  const basePart =
    '[\\u{1F300}-\\u{1F9FF}\\u{1FA00}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2300}-\\u{23FF}\\u{2B50}\\u{1F004}]';
  const skinPart = '[\\u{1F3FB}-\\u{1F3FF}]';
  const richPattern = new RegExp(
    `(${basePart}(?:${skinPart})?(?:\\u{200D}${basePart}(?:${skinPart})?)*)`,
    'u'
  );
  const flag = /([\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}])/u;
  const single = /([\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}])/u;
  return text.match(richPattern) || text.match(flag) || text.match(single);
}
