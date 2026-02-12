/**
 * Regex matching non-Latin/non-ASCII characters (e.g. Hangul, CJK, Cyrillic, Arabic).
 * Basic Latin is U+0000–U+007F (ASCII). Anything above is blocked for English-only captions.
 */
const NON_ENGLISH = /[\u0080-\uFFFF]/;

/**
 * Returns true if the text contains only Basic Latin characters (ASCII) suitable for English.
 * Used to filter out Whisper hallucinations in Korean, Chinese, Japanese, Cyrillic, etc.
 */
export function isEnglishOnly(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  return !NON_ENGLISH.test(text);
}
