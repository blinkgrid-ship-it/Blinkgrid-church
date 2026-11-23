import { useEffect, useMemo, useState } from "react";
import { Notice } from "../ui/Notice";
import { useUI } from "../Platform";
import { toChurchError, type ChurchesStore } from "./churchesStore.ts";
import { LANGUAGES, type ChurchApiError, type ChurchRecord, type Detail, type Language } from "./churchEdits";
import { PLAN_MAX_DAYS, PLAN_TITLE_MAX, checkPlan, cleanTitle, dayOfProblem, formatDay, formatPlan, parsePlan, samePlan, type PlanProblem, type PlanRecord } from "./churchPlanRules";

const OWN_NAME: Record<Language, string> = { en: "English", ml: "മലയാളം", hi: "हिन्दी" };
/** How many problems are listed at once; the rest is counted. A long plan with one wrong habit would otherwise fill the phone. */
const SHOWN = 5;
/** How many days of the plan are listed back to the staff member as "how we read it": the first ones and the last. */
const PREVIEW = 5;

type Answer = { kind: "ok" | "error"; text: string };
type T = (key: string, options?: Record<string, unknown>) => string;

/** The sentence for one problem found in the pasted text. Every sentence names its line. */
export function problemText(t: T, p: PlanProblem): string {
  const values = { line: p.line, text: p.text, book: p.book, chapter: p.chapter, max: p.max, given: p.given, expected: p.expected, count: p.count };
  return t(`admin:churchPlanProblem_${p.kind}`, values);
}

/**
 * The reading plan of one church (contract Part 4, T-159). Staff paste the plan as text, one day on each line; the screen reads it, names every
 * line it cannot read, and shows how it understood the first and last days before anything is saved. A saved plan comes back as the same text, so
 * a change is: change the text, save again. The plan saved is the church's `activePlanId` (a church cannot be switched on without one).
 * Only administrators save; an editor can look.
 */
export function ChurchPlan({ church, canSave, store, onChurch }: { church: ChurchRecord; canSave: boolean; store: ChurchesStore; onChurch: (c: ChurchRecord) => void }) {
  const { t } = useUI();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [title, setTitle] = useState<Partial<Record<Language, string>>>({});
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [repeats, setRepeats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [titleProblems, setTitleProblems] = useState<Detail[]>([]);

  // Loaded once for this church. A save puts its own answer on the screen, so the plan is not read again (and the text being typed is not lost).
  useEffect(() => {
    let live = true;
    setState("loading");
    store
      .plan(church)
      .then((found) => {
        if (!live) return;
        setPlan(found);
        setTitle(found?.title ?? {});
        setText(found ? formatPlan(found.days) : "");
        setStartDate(found?.startDate ?? "");
        setRepeats(found?.repeats ?? false);
        setState("ready");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, church.id]);

  const parsed = useMemo(() => parsePlan(text), [text]);
  const typed = text.trim().length > 0;
  const days = parsed.days;
  const readable = typed && !parsed.problems.length;
  const unchanged = !!plan && samePlan({ title, days, startDate, repeats }, plan) && readable;

  function edit(change: () => void) {
    change();
    setAnswer(null);
    setTitleProblems([]);
  }

  async function save() {
    if (busy || !canSave) return;
    if (!typed || parsed.problems.length) {
      setAnswer({ kind: "error", text: t(typed ? "admin:churchPlanFixLines" : "admin:churchPlanProblem_noDays") });
      return;
    }
    const found = checkPlan({ title, days, startDate, repeats }).filter((d) => d.field.startsWith("title") || d.field === "startDate");
    if (found.length) {
      setTitleProblems(found);
      setAnswer({ kind: "error", text: t("admin:churchErrVALIDATION_FAILED") });
      return;
    }
    setBusy(true);
    try {
      const saved = await store.savePlan(church, { title: cleanTitle(title), days, startDate: startDate || null, repeats }, plan);
      onChurch(saved.church);
      setPlan(saved.plan);
      setTitle(saved.plan.title);
      setText(formatPlan(saved.plan.days));
      setStartDate(saved.plan.startDate ?? "");
      setRepeats(saved.plan.repeats ?? false);
      setAnswer({ kind: "ok", text: t("admin:churchPlanSaved") });
    } catch (e) {
      const err: ChurchApiError = toChurchError(e);
      const day = err.code === "PLAN_INVALID" ? dayOfProblem(err.details) : undefined;
      setAnswer({ kind: "error", text: day ? t("admin:churchPlanInvalidDay", { day }) : t(`admin:churchErr${err.code}`) });
    } finally {
      setBusy(false);
    }
  }

  const heading = <h2 id="church-plan">{t("admin:churchPlanHeading")}</h2>;
  if (state === "failed")
    return (
      <section className="os-church-plan" aria-labelledby="church-plan">
        {heading}
        <Notice tone="error">
          <p>{t("admin:churchPlanLoadFailed")}</p>
        </Notice>
      </section>
    );

  const titleProblem = (field: string) => titleProblems.find((p) => p.field === field);
  const shown = parsed.problems.slice(0, SHOWN);
  const rest = parsed.problems.length - shown.length;
  const preview = days.length <= PREVIEW + 1 ? days.map((d, i) => ({ day: i + 1, d })) : [...days.slice(0, PREVIEW).map((d, i) => ({ day: i + 1, d })), { day: days.length, d: days[days.length - 1] }];

  return (
    <section className="os-church-plan" aria-labelledby="church-plan" aria-busy={state === "loading"}>
      {heading}
      <p className="os-field-hint">{t("admin:churchPlanHint")}</p>
      <pre className="os-church-plan-example" aria-label={t("admin:churchPlanExampleLabel")}>{"Day 1: Psalms 1; Mark 1\nDay 2: Psalms 2; Mark 2 (1/2)\nDay 3: Psalms 3; Mark 2 (2/2)"}</pre>
      {state === "loading" ? (
        <p role="status">{t("common:loading")}</p>
      ) : (
        <>
          {!plan && <p className="os-field-hint">{canSave ? t("admin:churchPlanNone") : t("admin:churchPlanNoneRead")}</p>}
          <fieldset className="os-church-plan-form" disabled={!canSave || busy}>
            <legend>{t("admin:churchPlanTitleHeading")}</legend>
            <p className="os-field-hint">{t("admin:churchPlanTitleHint")}</p>
            {LANGUAGES.map((l) => {
              const problem = titleProblem(`title.${l}`) ?? (titleProblem("title") ? { problem: "required" } : undefined);
              return (
                <label className="os-field" key={l}>
                  {t("admin:churchPlanTitleIn", { language: OWN_NAME[l] })}
                  <input value={title[l] ?? ""} maxLength={PLAN_TITLE_MAX + 40} aria-invalid={!!problem} onChange={(e) => edit(() => setTitle({ ...title, [l]: e.target.value }))} />
                  {problem && (
                    <span className="os-field-error" role="alert">
                      {t(problem.problem === "tooLong" ? "admin:churchProblemTooLong" : "admin:churchProblemRequired")}
                    </span>
                  )}
                </label>
              );
            })}
            <label className="os-field">
              {t("admin:churchPlanStart")}
              <input type="date" value={startDate} aria-invalid={!!titleProblem("startDate")} aria-describedby="church-plan-start-hint" onChange={(e) => edit(() => setStartDate(e.target.value))} />
              {titleProblem("startDate") && (
                <span className="os-field-error" role="alert">
                  {t("admin:churchProblemInvalid")}
                </span>
              )}
            </label>
            <p id="church-plan-start-hint" className="os-field-hint">
              {startDate ? t("admin:churchPlanStartHintSet") : t("admin:churchPlanStartHintEmpty")}
            </p>
            <label className="os-check">
              <input type="checkbox" checked={repeats} onChange={(e) => edit(() => setRepeats(e.target.checked))} />
              <span>{t("admin:churchPlanRepeats")}</span>
            </label>
            <label className="os-field">
              {t("admin:churchPlanText")}
              <textarea
                className="os-church-plan-text"
                rows={12}
                value={text}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={typed && !readable}
                aria-describedby="church-plan-summary"
                onChange={(e) => edit(() => setText(e.target.value))}
              />
            </label>
          </fieldset>

          <div id="church-plan-summary" className="os-church-plan-summary">
            {!typed && <p className="os-field-hint">{t("admin:churchPlanEmpty", { max: PLAN_MAX_DAYS })}</p>}
            {readable && <p className="os-church-plan-count">{t("admin:churchPlanCount", { count: days.length })}</p>}
            {typed && parsed.problems.length > 0 && (
              <>
                <p className="os-church-plan-count is-bad">{t("admin:churchPlanProblems", { count: parsed.problems.length })}</p>
                <ul className="os-church-plan-problems">
                  {shown.map((p, i) => (
                    <li key={i}>{problemText(t, p)}</li>
                  ))}
                  {rest > 0 && <li>{t("admin:churchPlanMoreProblems", { count: rest })}</li>}
                </ul>
              </>
            )}
          </div>

          {readable && (
            <div className="os-church-plan-preview">
              <h3>{t("admin:churchPlanPreview")}</h3>
              <ul>
                {preview.map(({ day, d }, i) => (
                  <li key={day}>
                    {i === PREVIEW && days.length > PREVIEW + 1 && <span className="os-church-plan-gap">{t("admin:churchPlanGap", { count: days.length - PREVIEW - 1 })}</span>}
                    <strong>{t("admin:churchPlanDay", { day })}</strong> {formatDay(d)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canSave && (
            <div className="os-church-actions">
              <button type="button" className="os-primary" disabled={busy || unchanged} onClick={save}>
                {t("admin:churchPlanSave")}
              </button>
            </div>
          )}
          {answer && (
            <p role={answer.kind === "error" ? "alert" : "status"} className={`os-live-message ${answer.kind === "error" ? "os-church-error" : ""}`}>
              {answer.text}
            </p>
          )}
          {plan && <p className="os-field-hint">{t("admin:churchPlanSavedBy", { version: plan.version, who: plan.updatedBy })}</p>}
        </>
      )}
    </section>
  );
}
