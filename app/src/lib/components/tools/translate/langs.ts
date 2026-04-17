/**
 * Language catalogs + flag helpers — ported from js/tools/TranslateTool.js.
 */

export type Lang = { code: string; name: string; flag: string; label?: string };

export const MAIN_LANGS: ReadonlyArray<Lang> = Object.freeze([
  { code: 'es', name: 'Spanish',    flag: 'ES' },
  { code: 'fr', name: 'French',     flag: 'FR' },
  { code: 'de', name: 'German',     flag: 'DE' },
  { code: 'zh', name: 'Chinese',    flag: 'CN' },
  { code: 'ja', name: 'Japanese',   flag: 'JP' },
  { code: 'ko', name: 'Korean',     flag: 'KR' },
  { code: 'ar', name: 'Arabic',     flag: 'SA' },
  { code: 'ru', name: 'Russian',    flag: 'RU' },
  { code: 'hi', name: 'Hindi',      flag: 'IN' },
  { code: 'pt', name: 'Portuguese', flag: 'PT' },
  { code: 'it', name: 'Italian',    flag: 'IT' },
  { code: 'nl', name: 'Dutch',      flag: 'NL' },
  { code: 'tr', name: 'Turkish',    flag: 'TR' },
  { code: 'vi', name: 'Vietnamese', flag: 'VN' },
  { code: 'pl', name: 'Polish',     flag: 'PL' }
]);

export const EXOTIC_LANGS: ReadonlyArray<Lang> = Object.freeze([
  { code: 'la',  name: 'Latin',           flag: 'VA', label: 'Dead' },
  { code: 'sa',  name: 'Sanskrit',        flag: 'IN', label: 'Ancient' },
  { code: 'grc', name: 'Ancient Greek',   flag: 'GR', label: 'Ancient' },
  { code: 'arz', name: 'Egyptian Arabic', flag: 'EG', label: 'Regional' },
  { code: 'ang', name: 'Old English',     flag: 'GB', label: 'Dead' },
  { code: 'sux', name: 'Sumerian',        flag: 'IQ', label: 'Dead' },
  { code: 'akk', name: 'Akkadian',        flag: 'IQ', label: 'Dead' },
  { code: 'haw', name: 'Hawaiian',        flag: 'US', label: 'Endangered' },
  { code: 'cy',  name: 'Welsh',           flag: 'GB', label: 'Celtic' },
  { code: 'sw',  name: 'Swahili',         flag: 'KE', label: 'African' }
]);

export const LANG_CODE_MAP: Record<string, string> = {
  Spanish: 'es', French: 'fr', German: 'de', Chinese: 'zh', Japanese: 'ja',
  Korean: 'ko', Arabic: 'ar', Russian: 'ru', Hindi: 'hi', Portuguese: 'pt',
  Italian: 'it', Dutch: 'nl', Turkish: 'tr', Vietnamese: 'vi', Thai: 'th',
  Polish: 'pl', Latin: 'la', Sanskrit: 'sa', 'Ancient Greek': 'grc',
  'Egyptian Arabic': 'arz', 'Old English': 'ang', Sumerian: 'sux', Akkadian: 'akk',
  Hawaiian: 'haw', Welsh: 'cy', Swahili: 'sw', Hebrew: 'he', Persian: 'fa',
  Tamil: 'ta', Esperanto: 'eo', Irish: 'ga', Basque: 'eu'
};

export function getLangCode(name: string): string {
  return LANG_CODE_MAP[name] || name.toLowerCase().slice(0, 3);
}

const FLAG_EMOJI: Record<string, string> = {
  ES: '🇪🇸', FR: '🇫🇷', DE: '🇩🇪', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷',
  SA: '🇸🇦', RU: '🇷🇺', IN: '🇮🇳', BR: '🇧🇷', PT: '🇵🇹', IT: '🇮🇹',
  NL: '🇳🇱', TR: '🇹🇷', VN: '🇻🇳', PL: '🇵🇱',
  VA: '🇻🇦', GR: '🇬🇷', EG: '🇪🇬', GB: '🇬🇧', IQ: '🇮🇶', US: '🇺🇸', KE: '🇰🇪'
};

export function flagEmoji(code: string): string {
  return FLAG_EMOJI[code] || '🌐';
}

/**
 * Build the translation prompt. For ISO codes we know are real (in
 * LANG_CODE_MAP), embed `(code)` inline — some provider routers key off
 * that. For user-typed custom languages whose slug isn't a real ISO code,
 * omit the parenthetical so we don't feed garbage to the model.
 */
export function buildTranslatePrompt(langName: string, langCode: string, text: string): string {
  const known = !!LANG_CODE_MAP[langName];
  const targetLabel = known ? `${langName} (${langCode})` : langName;
  return (
    `You are a professional English (en) to ${targetLabel} translator. ` +
    `Your goal is to accurately convey the meaning and nuances of the original English text ` +
    `while adhering to ${langName} grammar, vocabulary, and cultural sensitivities. ` +
    `If ${langName} is a constructed, dead, or endangered language, produce the closest authentic ` +
    `form you can; if truly impossible, produce a clearly-labeled romanization. ` +
    `Produce only the ${langName} translation, without any additional explanations or commentary. ` +
    `Please translate the following English text into ${langName}:\n\n${text}`
  );
}
