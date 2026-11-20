import { useState } from "react";
import { BookOpen, Share2 } from "lucide-react";
import { Row, useUI } from "../Platform";
import { Notice } from "../ui/Notice";
import { ncBookName } from "../nc/names";
import type { DailyBook } from "./source";
import { readingPath, type Reading } from "./plans";
import { getPlans, planById, planTitle } from "./activePlans";
import { churchSettings } from "../church/settings";
import { daysSince, readChosen, saveChosen, todayKey, type ChosenPlan } from "./planStore";
import { shareCard } from "./shareCard";
import "./daily.css";

/** The starter plans and "Today's reading": chosen once, kept on this phone, with a picture to share on WhatsApp Status. */
export function TodayPlan({ books }: { books: DailyBook[] }) {
  const { t, prefs } = useUI();
  const [chosen, setChosen] = useState<ChosenPlan | null>(readChosen);
  const [saved, setSaved] = useState<"" | "saved" | "failed">("");
  const plan = planById(chosen?.planId);

  const bookName = (slug: string) => {
    const book = books.find((b) => b.slug === slug);
    return book ? ncBookName(book.name, prefs.language, slug) || book.bookCode : slug;
  };
  const label = (r: Reading) => `${bookName(r.book)} ${r.chapter}${r.part ? ` (${t("daily:partOf", { part: r.part[0], count: r.part[1] })})` : ""}`;
  const choose = (id: string) => {
    const next = { planId: id, start: todayKey() };
    saveChosen(next);
    setChosen(next);
    setSaved("");
  };
  const reset = () => {
    saveChosen(null);
    setChosen(null);
    setSaved("");
  };

  if (!plan || !chosen)
    return (
      <section className="dl-plans" aria-labelledby="dl-plans-title">
        <h2 id="dl-plans-title">{t("daily:choosePlan")}</h2>
        {getPlans().map((p) => (
          <button key={p.id} type="button" className="dl-plan" onClick={() => choose(p.id)}>
            <strong>{planTitle(p, t, prefs.language)}</strong>
            <span>{t("daily:planDays", { count: p.days.length })}</span>
          </button>
        ))}
      </section>
    );

  const index = Math.max(0, daysSince(chosen.start));
  const today = plan.days[index];
  return (
    <section className="dl-today" aria-labelledby="dl-today-title">
      <h2 id="dl-today-title">{t("daily:todayReading")}</h2>
      {today ? (
        <>
          <p className="dl-today-meta">{`${t("daily:dayOf", { day: index + 1, total: plan.days.length })} · ${planTitle(plan, t, prefs.language)}`}</p>
          {today.map((r) => (
            <Row key={`${r.book}-${r.chapter}-${r.part?.join("")}`} to={readingPath(r)} title={label(r)} icon={<BookOpen size={22} />} />
          ))}
          <button
            type="button"
            className="os-primary dl-share"
            onClick={async () => {
              try {
                const result = await shareCard(
                  {
                    heading: t("daily:todayReading"),
                    readings: today.map(label),
                    plan: planTitle(plan, t, prefs.language),
                    day: t("daily:dayOf", { day: index + 1, total: plan.days.length }),
                    name: churchSettings.name,
                    site: churchSettings.address,
                  },
                  "todays-reading.png",
                );
                setSaved(result === "saved" ? "saved" : "");
              } catch {
                setSaved("failed");
              }
            }}
          >
            <Share2 size={18} aria-hidden="true" />
            {t("daily:shareToday")}
          </button>
          {saved === "saved" && (
            <Notice tone="success">
              <p>{t("daily:cardSaved")}</p>
            </Notice>
          )}
          {saved === "failed" && (
            <Notice tone="error">
              <p>{t("daily:cardFailed")}</p>
            </Notice>
          )}
        </>
      ) : (
        <Notice tone="success">
          <p>{t("daily:planFinished")}</p>
        </Notice>
      )}
      <button type="button" className="os-secondary dl-change" onClick={reset}>
        {t("daily:changePlan")}
      </button>
    </section>
  );
}
