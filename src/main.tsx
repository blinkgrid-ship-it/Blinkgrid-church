import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "./daily/landing";
import { applyChurchColors } from "./church/applyColors";
import { initChurch } from "./church/churchStore";
import App from "./Platform";
import "./core.css";
import "@fontsource/noto-serif-malayalam/400.css";
import "@fontsource/noto-serif-malayalam/600.css";
import "@fontsource/noto-serif-devanagari/400.css";
import "@fontsource/noto-serif-devanagari/600.css";
import "@fontsource/noto-sans-malayalam/400.css";
import "@fontsource/noto-sans-malayalam/600.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./fonts-scripts.css";
import "./min-size-ml-hi.css";
import "./platform.css";
import i18n from "./i18n";
import { ChooseLanguage } from "./lang/ChooseLanguage";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { adoptUrlLanguage, currentUrlLanguage, languageFromPath, onUrlLanguageChange, startupLanguage } from "./lang/urlLanguage";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/**
 * The site under its address prefix. Choosing another language changes the address and draws the
 * site again under the new prefix, so there is no page load and no blank screen in between.
 */
function Site({ first }: { first: string }) {
  const [lang, setLang] = useState(first);
  useEffect(() => {
    const stop = onUrlLanguageChange(setLang);
    // Browser Back and Forward can land on an address in another language.
    const onPop = () => {
      const fromAddress = languageFromPath(window.location.pathname);
      if (fromAddress && fromAddress !== currentUrlLanguage()) adoptUrlLanguage(fromAddress);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      stop();
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  return (
    // The outermost screen, for a failure in the header or the site itself.
    <ErrorBoundary canReport={false}>
      <BrowserRouter key={lang} basename={`/${lang}`}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

/**
 * The fonts the first screen is drawn in, per language, with a few letters of that script so the
 * browser fetches the right piece of the font. The site waits for them (at most 1 second) before
 * drawing, so the text is drawn once and does not shift when a font arrives (layout shift).
 */
const FIRST_SCREEN_FONTS: Record<string, { font: string; sample: string }[]> = {
  ml: [
    { font: '400 16px "Noto Serif Malayalam"', sample: "മലയാളം" },
    { font: '600 20px "Noto Serif Malayalam"', sample: "മലയാളം" },
    { font: '400 16px Inter', sample: "മലയാളം" },
  ],
  hi: [
    { font: '400 16px "Noto Serif Devanagari"', sample: "हिन्दी" },
    { font: '600 20px "Noto Serif Devanagari"', sample: "हिन्दी" },
    { font: '400 16px Inter', sample: "हिन्दी" },
  ],
};
const LATIN_FONTS = [
  { font: '400 16px Inter', sample: "Read" },
  { font: '600 16px Inter', sample: "Read" },
  { font: '600 24px "Cormorant Garamond"', sample: "Read" },
];
function firstScreenFonts(lang: string) {
  if (!("fonts" in document)) return Promise.resolve();
  const wanted = [...LATIN_FONTS, ...(FIRST_SCREEN_FONTS[lang] ?? [])];
  const loaded = Promise.all(wanted.map((f) => document.fonts.load(f.font, f.sample))).catch(() => undefined);
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 1000))]);
}

// The language comes from the address (…/ml/…). An address without one goes
// to the reader's saved language, else their phone's; with neither, the reader is asked.
// A church found by web address is settled first (churchStore.ts): its colours and default language are needed before anything is drawn.
// A build without VITE_CHURCH_RESOLVE skips this and runs on src/church/church.json as it always did.
void initChurch().finally(() => {
  applyChurchColors();
  document.getElementById("os-crawl-links")?.remove();
  const { lang } = startupLanguage();
  if (!lang) {
    root.render(
      <React.StrictMode>
        <ChooseLanguage />
      </React.StrictMode>,
    );
  } else {
    // Open in that language so a Malayalam or Hindi reader never sees English first.
    void Promise.all([i18n.changeLanguage(lang), firstScreenFonts(lang)]).finally(() =>
      root.render(
        <React.StrictMode>
          <Site first={lang} />
        </React.StrictMode>,
      ),
    );
  }
});
