/**
 * Global shim for legacy transformers that read from `window.*` namespaces.
 *
 * Four legacy transformers reference globals instead of importing:
 *   - visual/emoji-speak.js           → window.emojiData
 *   - special/randomizer.js           → window.transforms
 *   - unicode/strikethrough.js        → window.EmojiUtils.splitEmojis()
 *   - unicode/underline.js            → window.EmojiUtils.splitEmojis()
 *
 * We install minimal equivalents on `globalThis` (also available as `window`)
 * BEFORE the transformer glob import runs. This preserves the "don't modify
 * transformer files" constraint from the migration plan.
 *
 * Call `installTransformerGlobals()` exactly once, early (e.g., top of
 * lib/transformers/registry.ts or in a route load fn) before importing
 * any transformer module.
 */

// Ported from js/utils/emoji.js (pure, no Vue deps)
const EmojiUtils = {
  splitEmojis(text: string): string[] {
    // Intl.Segmenter available in all modern browsers.
    // TS lib.dom may lack full typing depending on target — we type narrow manually.
    type SegmentData = { segment: string };
    type SegmenterCtor = new (locale: string, opts: { granularity: string }) => {
      segment(text: string): Iterable<SegmentData>;
    };
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const Ctor = (Intl as unknown as { Segmenter: SegmenterCtor }).Segmenter;
      const segmenter = new Ctor('en', { granularity: 'grapheme' });
      const out: string[] = [];
      for (const { segment } of segmenter.segment(text)) out.push(segment);
      return out;
    }
    return Array.from(text);
  },

  joinEmojis(emojis: string[]): string {
    return emojis.join('');
  },

  getAllEmojis(): string[] {
    const data = (globalThis as Record<string, unknown>).emojiData;
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data).filter((key) => {
      const entry = (data as Record<string, unknown>)[key];
      return typeof entry === 'object' && entry !== null && 'official' in (entry as Record<string, unknown>);
    });
  }
};

let installed = false;

export function installTransformerGlobals(): void {
  if (installed) return;
  installed = true;

  const g = globalThis as Record<string, unknown>;

  // EmojiUtils — read by 2 unicode transformers (strikethrough/underline)
  if (!g.EmojiUtils) g.EmojiUtils = EmojiUtils;

  // emojiData — shipped as a separate data module in Phase 3 (stub for Phase 0/1)
  if (!g.emojiData) g.emojiData = {};

  // transforms — populated by the registry module right after glob import
  if (!g.transforms) g.transforms = {};
}

/** Writes the fully loaded transformer registry onto globalThis.transforms (for randomizer). */
export function publishTransformerRegistry(registry: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>).transforms = registry;
}

/** Replaces the emoji data payload (called during Phase 3 emoji pipeline). */
export function publishEmojiData(data: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>).emojiData = data;
}
