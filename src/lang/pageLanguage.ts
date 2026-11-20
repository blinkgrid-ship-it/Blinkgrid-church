import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { hasInterface } from "../i18n";

/**
 * The language chosen for Donate and the Feedback box (Paul, 22 Oct: "language switch on Donate and
 * Feedback: all listed languages, switches without reloading, remembers the choice"). It is chosen in the
 * header menu (a language the site has no words for opens Donate in it; Sebastian, 29 Oct) or in the
 * Feedback box. The Donate page has no language box of its own.
 *
 * Only those two have words in all 20 languages, so the choice is theirs alone: the rest of the site
 * stays in the site's language (English, Malayalam or Hindi, from the header menu). Donate and the
 * Feedback box share it, so picking Swahili on one shows Swahili on the other, and it is remembered
 * on this device. It applies while the site's own language is the one it was chosen under; choosing
 * another language in the header menu makes both follow the site again.
 */
const KEY = "blinkgrid-church.page-language.v1";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
};

/** Remembers a language for Donate and Feedback without a page on screen (an address like /sw/donate). */
export function rememberPageLanguage(lang: string, site: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lang, site }));
  } catch {
    /* The address still opens the page in that language for this visit. */
  }
  listeners.forEach((notify) => notify());
}

/** Forgets the remembered language, so Donate and Feedback follow the site's language again. */
export function forgetPageLanguage() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Nothing was remembered that could be removed. */
  }
  listeners.forEach((notify) => notify());
}

/** [the chosen language or null (follow the site), a function to choose one (null to follow the site)]. */
export function usePageLanguage(): readonly [string | null, (lang: string | null) => void] {
  const { i18n } = useTranslation();
  const site = i18n.language;
  const raw = useSyncExternalStore(subscribe, read, () => "");
  let chosen: string | null = null;
  try {
    const saved = JSON.parse(raw || "null");
    if (saved && saved.site === site && typeof saved.lang === "string" && saved.lang !== site && hasInterface(saved.lang)) chosen = saved.lang;
  } catch {
    /* Nothing valid was saved. */
  }
  const choose = (lang: string | null) => {
    try {
      if (!lang || lang === site) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ lang, site }));
    } catch {
      /* The choice still applies until the page is closed. */
    }
    listeners.forEach((notify) => notify());
  };
  return [chosen, choose];
}
