import { SITE_LANGUAGES, LANGUAGE_NAMES, PREFERENCES_KEY, stripLanguage, withLanguage } from "./urlLanguage";
import { churchName } from "../church/parse";
import { churchSettings } from "../church/settings";
import "./chooseLanguage.css";

/**
 * Shown only when a link has no language and neither the reader's saved choice nor their phone
 * gives one the site has: the reader is asked, instead of being shown English without a word.
 * Nothing is translated yet at this point, so the question is asked in every language at once.
 */
export function ChooseLanguage() {
  function choose(lang: string) {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}") ?? {};
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...saved, language: lang, readingLanguage: lang }));
    } catch {
      /* The choice still applies to this visit through the address. */
    }
    const here = `${stripLanguage(window.location.pathname)}${window.location.search}${window.location.hash}`;
    window.location.replace(withLanguage(here, lang));
  }
  return (
    <main className="cl">
      <h1>{churchName(churchSettings, "en")}</h1>
      <p className="cl-ask">
        <span lang="en">Choose your language</span> · <span lang="ml">നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കൂ</span> ·{" "}
        <span lang="hi">अपनी भाषा चुनें</span>
      </p>
      <div className="cl-list">
        {SITE_LANGUAGES.map((lang) => (
          <button key={lang} type="button" lang={lang} onClick={() => choose(lang)}>
            {LANGUAGE_NAMES[lang]?.native ?? lang}
          </button>
        ))}
      </div>
    </main>
  );
}
