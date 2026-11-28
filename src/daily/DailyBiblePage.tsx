import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Page, Row, useUI } from "../Platform";
import { Notice } from "../ui/Notice";
import { Skeleton } from "../ui/Skeleton";
import { dailyBooks, type DailyBook } from "./source";
import { TodayPlan } from "./TodayPlan";
import { dailyEdition, dailyTextIsStandIn } from "./config";
import { placePath, readPlace } from "./resume";
import { SavedVerses } from "./SavedVerses";
import "./daily.css";

/**
 * The Daily Bible door: the Bible a reader already knows, large and calm, one chapter a day.
 * Item 1 of the brief is the door itself. Until the Bible text and Sir's permission are in place this page says so
 * plainly and shows nothing that looks like a reading screen (CLAUDE.md guardrail 3).
 */
export function DailyBiblePage() {
  const { t, prefs } = useUI();
  const [loaded, setLoaded] = useState<{ edition: string; books: DailyBook[] } | null>(null);
  const edition = dailyEdition(prefs.language);
  const books = loaded && loaded.edition === edition ? loaded.books : [];
  const loadingBooks = !!edition && loaded?.edition !== edition;
  const first = books[0]?.chapters.length ? { book: books[0].slug, chapter: books[0].chapters[0] } : null;
  // Where the reader stopped, if it was in this language's text.
  const saved = readPlace();
  const place = saved && saved.language === prefs.language ? saved : null;
  useEffect(() => {
    if (!edition) return;
    const c = new AbortController();
    dailyBooks(edition, c.signal)
      .then((books) => {
        if (!c.signal.aborted) setLoaded({ edition, books });
      })
      .catch(() => {
        if (!c.signal.aborted) setLoaded({ edition, books: [] });
      });
    return () => c.abort();
  }, [edition]);
  return (
    <Page title={t("daily:title")} description={t("daily:tagline")}>
      {dailyTextIsStandIn(prefs.language) && (
        <Notice tone="info">
          <p>{t("daily:standIn")}</p>
        </Notice>
      )}
      <TodayPlan books={books} />
      <section className="dl-start">
        {place && (
          <Row to={placePath(place)} title={t("daily:continue")} icon={<BookOpen size={22} />} />
        )}
        {first && <Row to={`/daily/read/${first.book}/${first.chapter}`} title={t("daily:start")} icon={<BookOpen size={22} />} />}
        {loadingBooks && <Skeleton kind="row" />}
      </section>
      <SavedVerses key={prefs.language} language={prefs.language} />
    </Page>
  );
}
