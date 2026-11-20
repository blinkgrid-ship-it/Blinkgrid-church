// Interface text, one folder per language under src/locales (see its README).
// English ships in the main bundle; every other language loads when a reader picks it.
// Adding a language is adding a folder: the menus list whatever folders exist here.
import i18n from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import { LANGUAGE_ORDER, isFullLanguage } from "./lang/languages";

type Messages = Record<string, string>;
const english = import.meta.glob<Messages>("./locales/en/*.json", { eager: true, import: "default" });
const loaders = import.meta.glob<Messages>(["./locales/*/*.json", "!./locales/en/*.json"], { import: "default" });

const parts = (path: string) => path.match(/^\.\/locales\/([^/]+)\/([^/]+)\.json$/)!.slice(1);
export const NAMESPACES = Object.keys(english).map((p) => parts(p)[1]);
const folders = ["en", ...new Set(Object.keys(loaders).map((p) => parts(p)[0]))];
// Menus list them in the order of the language list (lang/languages.ts); a folder not named there comes last.
export const INTERFACE_LANGUAGES = [...LANGUAGE_ORDER.filter((c) => folders.includes(c)), ...folders.filter((c) => !LANGUAGE_ORDER.includes(c))];
export const hasInterface = (lang: string) => INTERFACE_LANGUAGES.includes(lang);
/**
 * The languages the whole site is translated into (English, Malayalam, Hindi): the site-wide menus
 * list only these. The other languages have just the Donate and Feedback words, and are chosen
 * with the language box on those two pages (lang/pageLanguage.ts).
 */
export const SITE_LANGUAGES = INTERFACE_LANGUAGES.filter(isFullLanguage);

void i18n
  .use(initReactI18next)
  .use(resourcesToBackend((lang: string, ns: string) => loaders[`./locales/${lang}/${ns}.json`]?.() ?? Promise.resolve({})))
  .init({
    resources: { en: Object.fromEntries(Object.entries(english).map(([p, m]) => [parts(p)[1], m])) },
    partialBundledLanguages: true,
    lng: "en",
    fallbackLng: "en",
    supportedLngs: INTERFACE_LANGUAGES,
    ns: NAMESPACES,
    defaultNS: "common",
    nsSeparator: ":",
    keySeparator: false,
    interpolation: { escapeValue: false },
    // "added": screens draw again when texts are added to the store (published edits arriving after the first draw).
    react: { useSuspense: false, bindI18nStore: "added" },
  });

export default i18n;

/** A key into src/locales, written "namespace:key" ("common" may be left out). */
export type MessageKey = string;
/** A key with the values its {{placeholders}} need, for copy that is built from numbers or names. */
export type Message = readonly [MessageKey, Record<string, unknown>?];

/** Content data (course titles, book names) carries its own languages; English is the fallback. */
export function pick(text: { en?: string; ml?: string; [lang: string]: string | undefined } | undefined, lang: string) {
  return (text?.[lang] || text?.en || "").toString();
}

/** BCP 47 codes are not always two letters (yue, sid), so compare the primary subtag only. */
const RTL = new Set(["ar", "arc", "ckb", "dv", "fa", "he", "ps", "sd", "syr", "ug", "ur", "yi"]);
export const isRtl = (lang: string) => RTL.has(lang.toLowerCase().split("-")[0]);

/** Speech recognition wants a region; these are the best guesses for our languages. */
export const speechLocale = (lang: string) => ({ en: "en-IN", ml: "ml-IN", hi: "hi-IN" })[lang] ?? lang;

/** The language a date or number is formatted in. */
export const formatLocale = (lang: string) => ({ en: "en-GB", ml: "ml-IN", hi: "hi-IN" })[lang] ?? lang;
