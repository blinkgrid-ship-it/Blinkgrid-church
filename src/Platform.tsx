// The church site's shell: header, language menu, the pages (Daily Bible, reading settings, More) and the footer.
// This is a separate product from OriginalScript (see docs/CHURCH-COPY.md). It keeps the small helpers the copied pages import from here
// (Page, Row, Note, Toggle, useUI, readSaved, READING_LANGUAGE_EVENT) so those pages did not need to change.
import {
  Suspense,
  createContext,
  lazy,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ChevronRight, HandHeart, Languages, Menu, Minus, Moon, Plus, ShieldCheck, Sun, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import i18n, { hasInterface, isRtl } from "./i18n";
import { Brand } from "./church/Brand";
import { CHURCH_HOME, churchPathRule } from "./church/features";
import { churchName } from "./church/parse";
import { churchSettings } from "./church/settings";
import { churchUnavailable } from "./church/churchStore";
import { BackLink } from "./nav/BackLink";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Notice, type Tone } from "./ui/Notice";
import { Skeleton } from "./ui/Skeleton";
import { isFullLanguage, languageTag } from "./lang/languages";
import { LANGUAGE_NAMES, PREFERENCES_KEY, currentUrlLanguage, openInLanguage, type LanguageChange, type LanguageDestination } from "./lang/urlLanguage";

const NotAvailableHere = lazy(() => import("./church/ChurchPages").then((m) => ({ default: m.NotAvailableHere })));
const ChurchMore = lazy(() => import("./church/ChurchPages").then((m) => ({ default: m.ChurchMore })));
const GivingPage = lazy(() => import("./church/GivingPage").then((m) => ({ default: m.GivingPage })));
const DailyReader = lazy(() => import("./daily/DailyReader").then((m) => ({ default: m.DailyReader })));
const StaffLayout = lazy(() => import("./staff/StaffLayout").then((m) => ({ default: m.StaffLayout })));
const StaffChurches = lazy(() => import("./staff/Churches").then((m) => ({ default: m.AdminChurches })));
const StaffChurchEdit = lazy(() => import("./staff/ChurchEdit").then((m) => ({ default: m.ChurchEdit })));
const DailyBiblePage = lazy(() => import("./daily/DailyBiblePage").then((m) => ({ default: m.DailyBiblePage })));

type Preferences = {
  /** The interface language: any folder in src/locales. */
  language: string;
  /** The language of the Bible text, separate from the interface language. */
  readingLanguage: string;
  theme: "light" | "dark";
  size: number;
  spacing: boolean;
  bold: boolean;
  split: boolean;
  colours: boolean;
  theology: boolean;
};
const defaults: Preferences = {
  language: "en",
  readingLanguage: "en",
  theme: "light",
  size: 22,
  spacing: true,
  bold: false,
  split: false,
  colours: false,
  theology: false,
};
export function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (value === null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? (value as T) : fallback;
    if (fallback !== null && typeof value !== typeof fallback) return fallback;
    return value;
  } catch {
    return fallback;
  }
}
const UI = createContext<{
  prefs: Preferences;
  setPrefs: (p: Partial<Preferences>) => void;
  /** The one way to change language: saves the choice, finds the same place in that language, and opens it. */
  changeLanguage: (tag: string) => Promise<void>;
  t: TFunction;
  notice: (text: string, tone?: Tone) => void;
}>({ prefs: defaults, setPrefs: () => {}, changeLanguage: async () => {}, t: i18n.t, notice: () => {} });
export function useUI() {
  return useContext(UI);
}

/** Sent to the readers on screen when the reader chooses a language: each may `claim` where the same place is in that language. */
export const READING_LANGUAGE_EVENT = "os:reading-language";

/** The languages this church reads in: the ones it has a Bible text for, that the site has words for. */
function churchLanguages(): string[] {
  const tags = Object.keys(churchSettings.dailyText).filter((tag) => hasInterface(tag) && isFullLanguage(tag));
  return tags.length ? tags : ["en"];
}

function LanguageMenu() {
  const { prefs, changeLanguage, t } = useUI();
  const [open, setOpen] = useState(false);
  const tags = churchLanguages();
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const ids = useId();
  const current = tags.includes(prefs.readingLanguage) ? prefs.readingLanguage : prefs.language;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    items.current[Math.max(0, tags.indexOf(current))]?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  function focusButton() {
    root.current?.querySelector<HTMLButtonElement>(".os-language")?.focus();
  }
  function choose(tag: string) {
    setOpen(false);
    focusButton();
    void changeLanguage(tag);
  }
  function onKey(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      focusButton();
      return;
    }
    // Tab leaves the menu (it is one stop, like any menu).
    if (e.key === "Tab") {
      if (open) {
        focusButton();
        setOpen(false);
      }
      return;
    }
    if (!open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const at = items.current.indexOf(document.activeElement as HTMLButtonElement);
    const count = tags.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? count - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
    items.current[next]?.focus();
  }
  const name = (tag: string) => LANGUAGE_NAMES[tag] ?? { native: tag, english: tag };
  return (
    <div className="os-language-menu" ref={root} onKeyDown={onKey}>
      <button className="os-language" aria-haspopup="menu" aria-expanded={open} aria-label={t("common:language") + ": " + name(current).native} onClick={() => setOpen(!open)}>
        <Languages size={18} />
        <span>{name(current).native}</span>
        <ChevronDown size={15} className="os-language-chevron" />
      </button>
      {open && (
        <div className="os-language-popover" role="menu" aria-label={t("common:chooseALanguage")}>
          <div role="group" aria-labelledby={ids}>
            <p id={ids} className="os-language-title" aria-hidden="true">
              {t("common:readIn")}
            </p>
            {tags.map((tag, i) => (
              <button
                key={tag}
                ref={(el) => {
                  items.current[i] = el;
                }}
                role="menuitemradio"
                aria-checked={tag === current}
                tabIndex={-1}
                lang={tag}
                onClick={() => choose(tag)}
              >
                <span className="os-language-names">
                  <strong>{name(tag).native}</strong>
                  {name(tag).english !== name(tag).native && <small lang="en">{name(tag).english}</small>}
                </span>
                {tag === current && <Check size={17} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Page({ title, description, children, back }: { title: string; description?: string; children: ReactNode; back?: string }) {
  return (
    <div className="os-page">
      <BackLink fallback={back} />
      <header className="os-page-heading">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </header>
      {children}
    </div>
  );
}
export function Row({ to, title, description, icon }: { to: string; title: string; description?: string; icon?: ReactNode }) {
  return (
    <Link className="os-row" to={to}>
      {icon && <span className="os-row-icon">{icon}</span>}
      <span>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      <ChevronRight size={20} />
    </Link>
  );
}
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="os-note">
      <ShieldCheck size={20} />
      <div>{children}</div>
    </div>
  );
}
export function Toggle({ title, description, checked, onChange }: { title: string; description?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="os-toggle-row">
      <span>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} />
    </label>
  );
}

/** Reading settings: text size, bold, line spacing, light or dark, language. */
function PreferencesPage() {
  const { prefs, setPrefs, changeLanguage, t } = useUI();
  return (
    <Page title={t("common:makeReadingComfortable")} description={t("common:changesAppearImmediatelyStayDevice")}>
      <div className="os-settings-layout">
        <div className="os-settings-preview">
          <BookOpen size={24} />
          <p lang={prefs.language} style={{ fontSize: prefs.size, lineHeight: prefs.spacing ? 1.95 : 1.6, fontWeight: prefs.bold ? 600 : 400 }}>
            {t("common:previewReading")}
          </p>
        </div>
        <div>
          <div className="os-text-size">
            <strong>{t("common:textSize")}</strong>
            <button aria-label={t("common:smallerText")} disabled={prefs.size <= 18} onClick={() => setPrefs({ size: prefs.size - 2 })}>
              <Minus size={19} />
            </button>
            <output>{prefs.size}px</output>
            <button aria-label={t("common:largerText")} disabled={prefs.size >= 34} onClick={() => setPrefs({ size: prefs.size + 2 })}>
              <Plus size={19} />
            </button>
          </div>
          <Toggle title={t("common:boldText")} checked={prefs.bold} onChange={() => setPrefs({ bold: !prefs.bold })} />
          <Toggle title={t("common:moreSpaceBetweenLines")} checked={prefs.spacing} onChange={() => setPrefs({ spacing: !prefs.spacing })} />
          <div className="os-setting-section">
            <h2>{t("common:appearance")}</h2>
            <div className="os-tabs">
              <button aria-pressed={prefs.theme === "light"} onClick={() => setPrefs({ theme: "light" })}>
                <Sun size={18} />
                {t("common:light")}
              </button>
              <button aria-pressed={prefs.theme === "dark"} onClick={() => setPrefs({ theme: "dark" })}>
                <Moon size={18} />
                {t("common:dark")}
              </button>
            </div>
          </div>
          <div className="os-setting-section">
            <h2>{t("common:language")}</h2>
            <div className="os-tabs">
              {churchLanguages().map((tag) => (
                <button key={tag} lang={tag} aria-pressed={prefs.language === tag} onClick={() => void changeLanguage(tag)}>
                  {LANGUAGE_NAMES[tag]?.native ?? tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default function Platform() {
  // A link in another language (…/ml/…) shows that language for the visit, but the reader's own saved language is not touched until they choose one.
  const visitOnly = useRef<{ language?: string; readingLanguage?: string } | null>(null);
  const [prefs, updatePrefs] = useState<Preferences>(() => {
    const saved = readSaved<Partial<Preferences>>(PREFERENCES_KEY, {});
    if (saved.language && !isFullLanguage(saved.language)) delete saved.language;
    const base = { ...defaults, ...saved };
    const lang = currentUrlLanguage();
    if (lang === base.language) return base;
    visitOnly.current = { language: saved.language, readingLanguage: saved.readingLanguage };
    return { ...base, language: lang, readingLanguage: lang };
  });
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  function setPrefs(p: Partial<Preferences>) {
    // Choosing a language is a real choice: from here the saved language follows it.
    if ("language" in p || "readingLanguage" in p) visitOnly.current = null;
    updatePrefs((prev) => {
      const next = { ...prev, ...p };
      const toSave: Partial<Preferences> = { ...next };
      const keep = visitOnly.current;
      if (keep) {
        for (const key of ["language", "readingLanguage"] as const) {
          if (keep[key] === undefined) delete toSave[key];
          else toSave[key] = keep[key] as string;
        }
      }
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(toSave));
      } catch {
        setToast({ text: t("common:preferencesCouldNotSavedThey"), tone: "warning" });
      }
      return next;
    });
  }
  async function changeLanguage(tag: string) {
    const language = hasInterface(tag) && isFullLanguage(tag) ? tag : "en";
    setPrefs({ language, readingLanguage: tag });
    // Each reader on screen may say where the same place is in this language.
    const claims: Promise<LanguageDestination | null>[] = [];
    const change: LanguageChange = { language: tag, claim: (d) => claims.push(Promise.resolve(d)) };
    window.dispatchEvent(new CustomEvent<LanguageChange>(READING_LANGUAGE_EVENT, { detail: change }));
    const found = (await Promise.all(claims)).find(Boolean) ?? null;
    if (language !== currentUrlLanguage()) {
      // The address carries the language, so it changes with it: one fresh load there.
      openInLanguage(language, found?.to);
    } else if (found) {
      navigate(found.to, { replace: found.replace });
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);
  useEffect(() => {
    const lang = hasInterface(prefs.language) ? prefs.language : "en";
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
    document.documentElement.lang = languageTag(lang);
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [prefs.language]);
  const name = churchName(churchSettings, prefs.language);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = name;
  }, [location.pathname, name]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(id);
  }, [toast]);

  const nav = [
    { to: CHURCH_HOME, label: "daily:title", icon: BookOpen },
    // The Giving tab shows only for a church that has given its giving link or bank details (or SAMPLE ones on a test site).
    ...(churchSettings.giving ? [{ to: "/give", label: "common:giving", icon: HandHeart }] : []),
    { to: "/more", label: "common:more", icon: Menu },
  ];
  // An address that is not the church's own shows "Not available here"; the home address opens the Daily Bible.
  // The staff area (/staff) is not a church page: it is shown on any address, and the server decides who may use it.
  const staffArea = location.pathname === "/staff" || location.pathname.startsWith("/staff/");
  const readerRoute = location.pathname.startsWith("/daily/read/");
  const loadingBoundary = staffArea ? "staff" : readerRoute ? "reader" : location.pathname;
  const rule = churchPathRule(location.pathname);
  return (
    <UI.Provider value={{ prefs, setPrefs, changeLanguage, t, notice: (text, tone = "info") => setToast({ text, tone }) }}>
      <div className="core-app os-app">
        <a className="skip-link" href="#main">
          {t("common:skipToContent")}
        </a>
        <header className="os-header">
          <div className="os-header-inner">
            <Link className="os-brand" to="/" aria-label={name}>
              <Brand size={28} strokeWidth={1.5} twoTone />
            </Link>
            {!churchUnavailable && !staffArea && (
              <nav className="os-desktop-nav" aria-label={t("common:mainNavigation")}>
                {nav.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                    <n.icon size={18} />
                    {t(n.label)}
                  </NavLink>
                ))}
              </nav>
            )}
            <div className="os-header-tools">{!churchUnavailable && !staffArea && <LanguageMenu />}</div>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname} canReport={false}>
            <Suspense key={loadingBoundary} fallback={<Skeleton kind={readerRoute ? "reader" : "page"} />}>
              {staffArea ? (
                <Routes>
                  <Route path="/staff" element={<StaffLayout />}>
                    <Route index element={<StaffChurches />} />
                    <Route path="new" element={<StaffChurchEdit isNew />} />
                    <Route path=":id" element={<StaffChurchEdit />} />
                  </Route>
                </Routes>
              ) : churchUnavailable || rule === "block" ? (
                <NotAvailableHere />
              ) : rule === "home" ? (
                <Navigate replace to={CHURCH_HOME} />
              ) : (
                <Routes>
                  <Route path="/daily" element={<DailyBiblePage />} />
                  <Route path="/daily/read/:book/:chapter" element={<DailyReader />} />
                  <Route path="/settings" element={<PreferencesPage />} />
                  <Route path="/more" element={<ChurchMore />} />
                  <Route path="/give" element={<GivingPage />} />
                  <Route path="*" element={<NotAvailableHere />} />
                </Routes>
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="os-footer">
          <Link className="os-brand" to="/">
            <Brand size={22} />
          </Link>
        </footer>
        {!staffArea && (
          <nav className="os-bottom-nav" aria-label={t("common:mobileNavigation")}>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                <n.icon size={22} />
                <span>{t(n.label)}</span>
              </NavLink>
            ))}
          </nav>
        )}
        {toast && (
          <Notice tone={toast.tone} className="os-toast">
            <span>{toast.text}</span>
            <button aria-label={t("common:dismissMessage")} onClick={() => setToast(null)}>
              <X size={18} />
            </button>
          </Notice>
        )}
      </div>
    </UI.Provider>
  );
}
