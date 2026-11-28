import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, Bookmark, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Page, useUI } from "../Platform";
import { countReaderToday } from "../church/churchStore";
import { Dropdown } from "../ui/Dropdown";
import { Notice } from "../ui/Notice";
import { Skeleton } from "../ui/Skeleton";
import { dailyBooks, dailyChapter, type DailyBook, type DailyChapter } from "./source";
import { pick } from "../i18n";
import { ncBookName } from "../nc/names";
import { dailyEdition, dailyTextIsStandIn } from "./config";
import { DEFAULT_SIZE, SIZES, readSize, savePlace, saveSize } from "./resume";
import { finishPause, shouldPause, skipPause } from "./pause";
import { PauseScreen } from "./PauseScreen";
import { AutoScrollSwitch } from "./AutoScrollSwitch";
import { VerseActions } from "./VerseActions";
import { readSavedVerses, type SavedVerse } from "./verseBookmarks";
import "./daily.css";

const VERSE_TIP_KEY = "blinkgrid-church.daily.verse-tip.v1";

/**
 * One whole chapter in large, calm text with verse numbers (item 3 of the brief). The text size and the place where the reader
 * stopped stay on this phone. A chapter the language's text does not have says so; nothing else is shown in its place.
 */
export function DailyReader() {
  const { t, prefs } = useUI();
  const language = prefs.language;
  const { book = "", chapter = "1" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const edition = dailyEdition(language);
  const [books, setBooks] = useState<DailyBook[] | null>(null);
  const [data, setData] = useState<DailyChapter | null | "missing">(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState(readSize);
  const [pausing, setPausing] = useState(shouldPause);
  const [selectedVerse, setSelectedVerse] = useState<SavedVerse | null>(null);
  const [savedVerses, setSavedVerses] = useState(() => readSavedVerses(language));
  const [verseTipDismissed, setVerseTipDismissed] = useState(() => {
    try {
      return localStorage.getItem(VERSE_TIP_KEY) === "1";
    } catch {
      return false;
    }
  });
  const article = useRef<HTMLElement>(null);
  // A reader who opens a reading is counted once a day for the church (contract Part 8). Only the church's address is sent.
  useEffect(() => {
    countReaderToday();
  }, []);
  const number = Number(chapter);
  // ?part=1of2 reads the first half of the chapter (a day of a plan); the verses stay in order and numbered as they are.
  const partMatch = /^(\d+)of(\d+)$/.exec(params.get("part") ?? "");
  const part = partMatch && Number(partMatch[1]) >= 1 && Number(partMatch[1]) <= Number(partMatch[2]) ? { index: Number(partMatch[1]), count: Number(partMatch[2]) } : null;

  useEffect(() => {
    if (!edition) return;
    const c = new AbortController();
    setBooks(null);
    dailyBooks(edition, c.signal)
      .then(setBooks)
      .catch((e) => !c.signal.aborted && setError((e as Error).message));
    return () => c.abort();
  }, [edition]);

  const current = books?.find((b) => b.slug === book);

  useEffect(() => {
    if (!edition || !books) return;
    if (!current || !current.chapters.includes(number)) {
      setData("missing");
      return;
    }
    setData(null);
    setError("");
    const c = new AbortController();
    dailyChapter(edition, book, number, c.signal)
      .then((d) => !c.signal.aborted && setData(d))
      .catch((e) => !c.signal.aborted && setError((e as Error).message));
    return () => c.abort();
  }, [edition, books, current, book, number]);

  // Land on the verse where the reader stopped, once the chapter is on the page.
  const wanted = params.get("verse");
  const chapterVerses = data && data !== "missing" ? data.verses : [];
  const visibleVerses = part ? chapterVerses.slice(
    Math.floor((chapterVerses.length * (part.index - 1)) / part.count),
    Math.floor((chapterVerses.length * part.index) / part.count),
  ) : chapterVerses;
  const showVerseTip = !verseTipDismissed && !wanted && visibleVerses.length > 0;
  function dismissVerseTip() {
    setVerseTipDismissed(true);
    try {
      localStorage.setItem(VERSE_TIP_KEY, "1");
    } catch {
      // The tip stays dismissed in this reader when storage is unavailable.
    }
  }
  useEffect(() => {
    if (pausing || !article.current || !data || data === "missing") return;
    const target = wanted ? article.current?.querySelector<HTMLElement>(`[data-verse="${CSS.escape(wanted)}"]`) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, [data, wanted, pausing]);

  // Remember the first verse on screen, a moment after the reader stops scrolling.
  useEffect(() => {
    if (pausing || !article.current || !data || data === "missing") return;
    let timer = 0;
    const remember = () => {
      const verses = [...(article.current?.querySelectorAll<HTMLElement>("[data-verse]") ?? [])];
      const first = verses.find((v) => v.getBoundingClientRect().bottom > 90);
      savePlace({ language, book, chapter: number, verse: first?.dataset.verse });
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(remember, 350);
    };
    remember();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [data, language, book, number, pausing]);

  // The chapter keeps loading under the pause, so reading starts at once when it ends.
  if (pausing)
    return (
      <PauseScreen
        onDone={() => {
          finishPause();
          setPausing(false);
        }}
        onSkip={() => {
          skipPause();
          setPausing(false);
        }}
      />
    );

  const bookLabel = (b: DailyBook) => ncBookName(b.name, language, b.slug) || b.bookCode;
  const bookName = current ? bookLabel(current) : book;
  const bookList = books ?? [];
  const go = (b: string, c: number) => navigate(`/daily/read/${b}/${c}`);
  const step = (delta: number) => {
    const at = (SIZES as readonly number[]).indexOf(size);
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, at + delta))];
    setSize(next);
    saveSize(next);
  };
  const chapters = current?.chapters ?? [];
  const at = chapters.indexOf(number);
  const previous = at > 0 ? chapters[at - 1] : undefined;
  const next = at >= 0 && at < chapters.length - 1 ? chapters[at + 1] : undefined;

  return (
    <Page title={`${bookName} ${number}`} back="/daily">
      {dailyTextIsStandIn(language) && (
        <Notice tone="info" className="dl-note">
          <p>{t("daily:standIn")}</p>
        </Notice>
      )}
      {!edition ? (
        <Notice tone="warning">
          <p>{t("daily:notAvailable")}</p>
        </Notice>
      ) : (
        <>
          <div className="dl-controls">
            {bookList.length > 0 && (
              <>
                <Dropdown
                  label={t("daily:book")}
                  value={book}
                  options={bookList.map((b) => ({ value: b.slug, label: bookLabel(b) }))}
                  onChange={(slug) => go(slug, bookList.find((b) => b.slug === slug)?.chapters[0] ?? 1)}
                />
                <Dropdown
                  label={t("daily:chapter")}
                  value={String(number)}
                  options={chapters.map((c) => ({ value: String(c), label: String(c) }))}
                  onChange={(c) => go(book, Number(c))}
                />
              </>
            )}
            <div className="dl-size" role="group" aria-label={t("daily:textSize")}>
              <button type="button" onClick={() => step(-1)} disabled={size === SIZES[0]} aria-label={t("daily:smallerText")}>
                <Minus size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => step(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label={t("daily:largerText")}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          {error && (
            <Notice tone="error">
              <p>{error}</p>
            </Notice>
          )}
          {data === "missing" && (
            <Notice tone="warning">
              <p>{t("daily:notAvailable")}</p>
            </Notice>
          )}
          {data === null && !error && <Skeleton kind="reader" label={t("common:loading")} />}
          {data && data !== "missing" && part && <p className="dl-part">{t("daily:partNote", { part: part.index, count: part.count })}</p>}
          {data && data !== "missing" && (
            <article
              ref={article}
              className="dl-text"
              lang={data.languageTag ?? language}
              dir={data.direction}
              style={{ ["--dl-size" as string]: `${size || DEFAULT_SIZE}px` }}
            >
              {showVerseTip && (
                <div className="dl-verse-tip" lang={language} dir="ltr">
                  <ArrowDown size={20} aria-hidden="true" />
                  <span>{t("daily:verseTip")}</span>
                  <button
                    type="button"
                    className="dl-icon-action"
                    aria-label={t("common:dismissMessage")}
                    onClick={() => {
                      article.current?.querySelector<HTMLButtonElement>(".dl-num")?.focus({ preventScroll: true });
                      dismissVerseTip();
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="dl-verses">
                {visibleVerses.map((v, index) => {
                  const reference = `${bookName} ${number}:${v.verseLabel}`;
                  const saved = savedVerses.some((entry) =>
                    entry.language === language && entry.book === book && entry.chapter === number && entry.verse === v.verseLabel);
                  return (
                    <p key={v.verseId} data-verse={v.verseLabel} className={`dl-verse${wanted === v.verseLabel ? " dl-verse-target" : ""}`}>
                      <button
                        type="button"
                        className={showVerseTip && index === 0 ? "dl-num dl-num-hint" : "dl-num"}
                        aria-haspopup="dialog"
                        aria-label={t(saved ? "daily:savedVerseActions" : "daily:verseActions", { reference })}
                        onClick={() => {
                          if (!verseTipDismissed) dismissVerseTip();
                          setSelectedVerse({ language, book, chapter: number, verse: v.verseLabel, reference });
                        }}
                      >
                        <span>{v.verseLabel}</span>
                        {saved && <Bookmark size={12} fill="currentColor" aria-hidden="true" />}
                      </button>
                      <span className="dl-words">
                        {v.text}
                        {"notes" in v && v.notes?.map((n, i) => (
                          <span key={i} className="dl-note">
                            {n}
                          </span>
                        ))}
                      </span>
                    </p>
                  );
                })}
              </div>
              <p className="dl-attribution">{pick(data.attribution, language)}</p>
              <nav className="dl-steps" aria-label={t("daily:chapter")}>
                {part ? (
                  <Link className="os-primary" to="/daily">
                    {t("daily:backToday")}
                  </Link>
                ) : previous !== undefined ? (
                  <Link className="os-secondary" to={`/daily/read/${book}/${previous}`}>
                    <ChevronLeft size={18} aria-hidden="true" />
                    {t("daily:previousChapter")}
                  </Link>
                ) : (
                  <span />
                )}
                {!part && next !== undefined && (
                  <Link className="os-primary" to={`/daily/read/${book}/${next}`}>
                    {t("daily:nextChapter")}
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                )}
              </nav>
            </article>
          )}
          {data && data !== "missing" && <AutoScrollSwitch size={size || DEFAULT_SIZE} resetKey={`${book}/${number}/${params.get("part") ?? ""}`} />}
        </>
      )}
      {selectedVerse && selectedVerse.book === book && selectedVerse.chapter === number && selectedVerse.language === language && (
        <VerseActions verse={selectedVerse} onClose={() => setSelectedVerse(null)} onSaved={setSavedVerses} />
      )}
    </Page>
  );
}
