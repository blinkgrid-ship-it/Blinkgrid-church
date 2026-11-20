/**
 * The one list of languages the site offers (Paul, 22 Oct: "one list of languages in one place;
 * adding a language later is one line, not new code").
 *
 * To add a language: add a line here, add its column to the translations sheet, and run
 * `npm run translations:load -- <sheet.csv>` (scripts/translations). The menus, the address
 * (/sw/…), the Feedback box and the Donate page pick it up; nothing else changes.
 *
 * - code: the address prefix and the folder in src/locales (/sw/ and src/locales/sw).
 * - tag:  the BCP 47 language tag for <html lang> (it differs from the code only for Chinese).
 * - full: the whole site is translated. Only these can be the site's language: the site-wide menus
 *         list them, a phone's language picks among them, and they are in the sitemap. The others
 *         have the Donate and Feedback words only (English fills the rest), so they are chosen with
 *         the language box on those two pages, never as the site's language. A link such as
 *         /sw/donate opens Donate in Swahili on the English (or the reader's own) site.
 */
export type Language = {
  code: string;
  native: string;
  english: string;
  tag: string;
  full: boolean;
  rtl?: boolean;
};

const partial = (code: string, native: string, english: string, tag = code): Language => ({ code, native, english, tag, full: false });

export const LANGUAGES: Language[] = [
  { code: "en", native: "English", english: "English", tag: "en", full: true },
  { code: "ml", native: "മലയാളം", english: "Malayalam", tag: "ml", full: true },
  { code: "hi", native: "हिन्दी", english: "Hindi", tag: "hi", full: true },
  partial("ta", "தமிழ்", "Tamil"),
  partial("te", "తెలుగు", "Telugu"),
  partial("kn", "ಕನ್ನಡ", "Kannada"),
  partial("es", "Español", "Spanish"),
  partial("pt", "Português", "Portuguese"),
  partial("fr", "Français", "French"),
  partial("de", "Deutsch", "German"),
  partial("it", "Italiano", "Italian"),
  partial("ru", "Русский", "Russian"),
  partial("id", "Bahasa Indonesia", "Indonesian"),
  partial("fil", "Filipino", "Filipino"),
  partial("si", "සිංහල", "Sinhala"),
  partial("ko", "한국어", "Korean"),
  partial("zh", "简体中文", "Chinese (Simplified)", "zh-Hans"),
  partial("ja", "日本語", "Japanese"),
  partial("sw", "Kiswahili", "Swahili"),
  partial("am", "አማርኛ", "Amharic"),
  // Arabic and Hebrew come next, with the right-to-left layout.
];

export const LANGUAGE_ORDER = LANGUAGES.map((l) => l.code);
export const languageByCode = (code: string) => LANGUAGES.find((l) => l.code === code);
export const isFullLanguage = (code: string) => !!languageByCode(code)?.full;
/** The tag for <html lang>; the code itself for a language the list does not name. */
export const languageTag = (code: string) => languageByCode(code)?.tag ?? code;
/** The names the menus show, by code. */
export const LANGUAGE_NAME_MAP: Record<string, { native: string; english: string }> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, { native: l.native, english: l.english }]),
);
