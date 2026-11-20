import i18n, { INTERFACE_LANGUAGES, SITE_LANGUAGES, hasInterface } from "../i18n";
import { churchSettings } from "../church/settings";
import { LANGUAGE_NAME_MAP, isFullLanguage } from "./languages";
import { rememberPageLanguage } from "./pageLanguage";

/**
 * The language in the address: originalscript.org/ml/read/genesis/2 opens in Malayalam,
 * /hi/… in Hindi, /en/… in English, and any language that gets a folder in src/locales works
 * the same way. The router is given the prefix as its basename, so every link, the search and
 * every other page navigation stays in that language without knowing about it.
 *
 * Opening a link in another language shows that language for the visit only; the reader's own
 * saved language changes only when they choose one in the menu (see Platform's setPrefs).
 */
export const PREFERENCES_KEY = "blinkgrid-church.preferences.v2";

// Languages the site knows by name (the one list in languages.ts). Any other language with a
// published edition is listed by its tag.
export const LANGUAGE_NAMES: Record<string, { native: string; english: string }> = LANGUAGE_NAME_MAP;

/** The language a path starts with ("/ml/read/genesis/2" -> "ml"), if it is one the site has. */
export function languageFromPath(pathname: string): string | null {
  const first = pathname.match(/^\/([A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?)(?=\/|$)/)?.[1]?.toLowerCase();
  return first && hasInterface(first) ? first : null;
}

/** The path without its language ("/ml/read/genesis/2" -> "/read/genesis/2"; "/ml" -> "/"). */
export function stripLanguage(pathname: string): string {
  const lang = languageFromPath(pathname);
  if (!lang) return pathname;
  return pathname.slice(lang.length + 1) || "/";
}

/**
 * The reader's saved site language, if they have chosen one. Only a language the whole site is
 * translated into counts: one saved while the site-wide menu briefly listed every language (for
 * example Indonesian) is ignored, so the site never opens in a language it mostly lacks.
 */
export function savedLanguage(): string | null {
  try {
    const lang = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}")?.language;
    return typeof lang === "string" && hasInterface(lang) && isFullLanguage(lang) ? lang : null;
  } catch {
    return null;
  }
}

/** The language a path starts with when it is one that has only the Donate and Feedback words ("/sw/donate" -> "sw"). */
function partialLanguageFromPath(pathname: string): string | null {
  const first = pathname.match(/^\/([A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?)(?=\/|$)/)?.[1]?.toLowerCase();
  return first && hasInterface(first) && !isFullLanguage(first) ? first : null;
}

/**
 * The first language on the phone or browser that the whole site is translated into. A language
 * that has only the Donate and Feedback words (see languages.ts) is never chosen for the reader;
 * they pick it themselves in the menu.
 */
export function phoneLanguage(): string | null {
  const wanted = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of wanted) {
    const code = String(tag ?? "").toLowerCase();
    if (hasInterface(code) && isFullLanguage(code)) return code;
    const primary = code.split("-")[0];
    if (primary && hasInterface(primary) && isFullLanguage(primary)) return primary;
  }
  return null;
}

/** A church copy's own default language (src/church/church.json), when the site has its words. */
function churchLanguage(): string | null {
  const wanted = churchSettings.defaultLanguage;
  return wanted && hasInterface(wanted) && isFullLanguage(wanted) ? wanted : null;
}

export type Startup = {
  /** The language this visit is in, or null when the reader must choose one. */
  lang: string | null;
  /** The language the address carried, if any (null after an address without one was redirected). */
  fromAddress: string | null;
};

let started: Startup = { lang: null, fromAddress: null };

/**
 * Settles the language before anything is drawn. An address with a language is used as it is.
 * One without goes to the reader's saved language, else the phone's, and the address is
 * rewritten to carry it; with neither, the reader is asked (never silently English).
 */
export function startupLanguage(): Startup {
  // An address in a language that has only the Donate and Feedback words (/sw/donate, a link someone
  // shared) opens the same page on the site in the reader's own language, with that language chosen
  // for Donate and Feedback. Such a language is never the site's language.
  const partial = partialLanguageFromPath(window.location.pathname);
  if (partial) {
    const site = savedLanguage() ?? phoneLanguage() ?? "en";
    rememberPageLanguage(partial, site);
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `/${site}${pathname.slice(partial.length + 1) || "/"}${search}${hash}`);
  }
  const { pathname, search, hash } = window.location;
  const fromAddress = languageFromPath(pathname);
  if (fromAddress) {
    started = { lang: fromAddress, fromAddress };
    return started;
  }
  const lang = savedLanguage() ?? churchLanguage() ?? phoneLanguage();
  if (lang) {
    window.history.replaceState(window.history.state, "", `/${lang}${pathname}${search}${hash}`);
  }
  started = { lang, fromAddress: null };
  return started;
}

/** The language this page was opened in (its address prefix). */
export function currentUrlLanguage(): string {
  return started.lang ?? "en";
}

/** A path inside the site written for a language ("/privacy" -> "/ml/privacy"), for plain links and shares. */
export function withLanguage(path: string, lang: string = currentUrlLanguage()): string {
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

/** A full link a reader can send: the site's address, the language and the page. */
export function shareableUrl(path: string, lang: string = currentUrlLanguage()): string {
  return `${window.location.origin}${withLanguage(path, lang)}`;
}

/** Where a language change goes when a reader on screen knows the same verse in that language. */
export type LanguageDestination = { to: string; replace?: boolean };
/** What the header menu sends to the readers: each may `claim` the place to go in the new language. */
export type LanguageChange = {
  language: string;
  claim: (destination: LanguageDestination | null | Promise<LanguageDestination | null>) => void;
};

const languageListeners = new Set<(lang: string) => void>();

/** main.tsx listens here to draw the site again under a new address prefix. */
export function onUrlLanguageChange(listener: (lang: string) => void) {
  languageListeners.add(listener);
  return () => void languageListeners.delete(listener);
}

/** Moves the site to a language already in the address (browser Back and Forward between languages). */
export function adoptUrlLanguage(lang: string) {
  started = { lang, fromAddress: lang };
  void i18n.changeLanguage(lang).finally(() => languageListeners.forEach((listener) => listener(lang)));
}

/**
 * Opens this site in another language without a page load: the new language's words are fetched
 * first, then the address changes and the site is drawn again under the new prefix.
 */
export async function openInLanguage(lang: string, path?: string) {
  const here = `${stripLanguage(window.location.pathname)}${window.location.search}${window.location.hash}`;
  await i18n.changeLanguage(lang);
  window.history.pushState(null, "", withLanguage(path ?? here, lang));
  started = { lang, fromAddress: lang };
  languageListeners.forEach((listener) => listener(lang));
}

export { INTERFACE_LANGUAGES, SITE_LANGUAGES };
