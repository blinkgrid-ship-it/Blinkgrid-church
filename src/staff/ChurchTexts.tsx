import { useEffect, useMemo, useState } from "react";
import { Notice } from "../ui/Notice";
import { useUI } from "../Platform";
import { UNIVERSAL } from "../daily/universal";
import { AdminSelect } from "./AdminSelect";
import { toChurchError, type ChurchesStore } from "./churchesStore.ts";
import {
  ATTRIBUTION_MAX,
  LANGUAGES,
  attributionFor,
  checkTextChoice,
  effectiveStatus,
  statusAllows,
  type ChurchApiError,
  type ChurchRecord,
  type DailyEdition,
  type Detail,
  type Language,
  type PermissionStatus,
} from "./churchEdits";

type T = (key: string, options?: Record<string, unknown>) => string;

const OWN_NAME: Record<Language, string> = { en: "English", ml: "മലയാളം", hi: "हिन्दी" };
const STATUS_KEY: Record<PermissionStatus, string> = {
  "public-domain": "churchPermPublicDomain",
  "permission-granted": "churchPermGranted",
  "permission-pending": "churchPermPending",
  "permission-refused": "churchPermRefused",
  unknown: "churchPermUnknown",
};

const today = () => new Date().toISOString().slice(0, 10);

/** The words for a permission status. A granted permission that has ended reads "Permission ended", not "Not checked". */
export function permissionLabel(t: T, e: Pick<DailyEdition, "permissionStatus" | "permissionExpires">): string {
  const effective = effectiveStatus(e, today());
  if (e.permissionStatus === "permission-granted" && effective === "unknown") return t("admin:churchPermEnded");
  return t(`admin:${STATUS_KEY[effective]}`);
}

/** The line shown under the chapter that a text brings with it, when we know it (the three built-in texts). */
const knownLine = (code: string, language: Language) => UNIVERSAL[code]?.attribution?.[language] ?? "";

type Row = { code: string; line: string };
type Answer = { kind: "ok" | "error"; text: string; problems: Detail[] };

/**
 * The Bible text of one church, per language (contract Part 3, T-148): choose from the texts staff may offer, each shown with its
 * permission status. A text that is not public domain or permission-granted cannot be chosen (the server refuses it too).
 * Only administrators save; an editor can look.
 */
export function ChurchTexts({ church, canSave, store, onChurch }: { church: ChurchRecord; canSave: boolean; store: ChurchesStore; onChurch: (c: ChurchRecord) => void }) {
  const { t } = useUI();
  const [editions, setEditions] = useState<DailyEdition[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Language | null>(null);
  const [rows, setRows] = useState<Record<Language, Row>>(() => fromChurch(church));
  const [answers, setAnswers] = useState<Partial<Record<Language, Answer>>>({});

  useEffect(() => {
    let live = true;
    store
      .editions()
      .then((list) => live && setEditions(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [store]);

  const byCode = useMemo(() => new Map((editions ?? []).map((e) => [e.editionCode, e])), [editions]);

  function pick(language: Language, code: string) {
    const saved = church.texts?.[language];
    const line = code === saved?.editionCode ? (saved.attribution?.[language] ?? knownLine(code, language)) : knownLine(code, language);
    setRows({ ...rows, [language]: { code, line } });
    setAnswers({ ...answers, [language]: undefined });
  }
  const setLine = (language: Language, line: string) => {
    setRows({ ...rows, [language]: { ...rows[language], line } });
    setAnswers({ ...answers, [language]: undefined });
  };

  async function run(language: Language, action: () => Promise<ChurchRecord>, done: string) {
    if (busy) return;
    setBusy(language);
    try {
      const saved = await action();
      onChurch(saved);
      setRows((current) => ({ ...current, [language]: fromChurch(saved)[language] }));
      setAnswers((a) => ({ ...a, [language]: { kind: "ok", text: done, problems: [] } }));
    } catch (e) {
      const err: ChurchApiError = toChurchError(e);
      setAnswers((a) => ({ ...a, [language]: { kind: "error", text: t(`admin:churchErr${err.code}`), problems: err.details } }));
    } finally {
      setBusy(null);
    }
  }

  function save(language: Language) {
    const row = rows[language];
    const problems = checkTextChoice(row.code, row.line);
    if (problems.length) {
      setAnswers({ ...answers, [language]: { kind: "error", text: t("admin:churchErrVALIDATION_FAILED"), problems } });
      return;
    }
    return run(language, () => store.setText(church.id, language, { editionCode: row.code, attribution: attributionFor(language, row.line, UNIVERSAL[row.code]?.attribution) }, church.version), t("admin:churchTextSaved"));
  }
  const useOwn = (language: Language) => run(language, () => store.removeText(church.id, language), t("admin:churchTextRemoved"));

  if (failed)
    return (
      <section className="os-church-texts" aria-labelledby="church-texts">
        <h2 id="church-texts">{t("admin:churchTextHeading")}</h2>
        <Notice tone="error">
          <p>{t("admin:churchTextLoadFailed")}</p>
        </Notice>
      </section>
    );

  return (
    <section className="os-church-texts" aria-labelledby="church-texts" aria-busy={!editions}>
      <h2 id="church-texts">{t("admin:churchTextHeading")}</h2>
      <p className="os-field-hint">{t("admin:churchTextHint")}</p>
      {!editions ? (
        <p role="status">{t("common:loading")}</p>
      ) : (
        LANGUAGES.map((language) => {
          const row = rows[language];
          const offered = editions.filter((e) => e.language === language);
          const chosen = byCode.get(row.code);
          const saved = church.texts?.[language];
          const blocked = !!chosen && !statusAllows(effectiveStatus(chosen, today()));
          const answer = answers[language];
          const problem = (field: string) => answer?.problems.find((p) => p.field === field);
          const options = [
            { value: "", label: t("admin:churchTextOwn") },
            ...offered.map((e) => ({ value: e.editionCode, label: t("admin:churchTextOption", { name: e.name, status: permissionLabel(t, e) }) })),
          ];
          // A text kept by the church that the list no longer offers is still shown, so it is not lost from sight.
          if (row.code && !byCode.has(row.code)) options.push({ value: row.code, label: row.code });
          const lineProblem = problem("attribution");
          const unchanged = row.code === (saved?.editionCode ?? "") && row.line.trim() === (saved?.attribution?.[language] ?? "").trim();
          return (
            <fieldset key={language} className="os-church-text" disabled={!canSave || busy !== null}>
              <legend>{OWN_NAME[language]}</legend>
              {language === church.defaultLanguage && <p className="os-field-hint">{t("admin:churchTextNeeded")}</p>}
              <AdminSelect label={t("admin:churchTextFor", { language: OWN_NAME[language] })} value={row.code} options={options} onChange={(code) => pick(language, code)} disabled={!canSave || busy !== null} />
              {offered.length === 0 && <p className="os-field-hint">{t("admin:churchTextNoOptions")}</p>}
              {problem("editionCode") && (
                <p className="os-field-error" role="alert">
                  {t("admin:churchProblemInvalid")}
                </p>
              )}
              {chosen && (
                <p className="os-church-permission">
                  <span className={`os-church-status ${statusAllows(effectiveStatus(chosen, today())) ? "is-active" : ""}`}>{permissionLabel(t, chosen)}</span>
                  {blocked && <span className="os-church-blocked">{t("admin:churchTextBlocked")}</span>}
                </p>
              )}
              {row.code && (
                <label className="os-field">
                  {t("admin:churchTextLine")}
                  <textarea rows={3} value={row.line} maxLength={ATTRIBUTION_MAX + 50} aria-invalid={!!lineProblem} onChange={(e) => setLine(language, e.target.value)} />
                  <span className="os-field-hint">{t("admin:churchTextLineHint")}</span>
                  {lineProblem && (
                    <span className="os-field-error" role="alert">
                      {t(lineProblem.problem === "tooLong" ? "admin:churchProblemLineTooLong" : "admin:churchProblemRequired")}
                    </span>
                  )}
                </label>
              )}
              {canSave && (
                <div className="os-church-actions">
                  {row.code && (
                    <button type="button" className="os-primary" disabled={busy !== null || blocked || unchanged} onClick={() => save(language)}>
                      {t("admin:churchTextSave")}
                    </button>
                  )}
                  {saved && (
                    <button type="button" disabled={busy !== null} onClick={() => useOwn(language)}>
                      {t("admin:churchTextUseOwn")}
                    </button>
                  )}
                </div>
              )}
              {answer && (
                <p role={answer.kind === "error" ? "alert" : "status"} className={`os-live-message ${answer.kind === "error" ? "os-church-error" : ""}`}>
                  {answer.text}
                </p>
              )}
            </fieldset>
          );
        })
      )}
    </section>
  );
}

/** The rows the screen edits, from what the church has saved. */
function fromChurch(church: ChurchRecord): Record<Language, Row> {
  const out = {} as Record<Language, Row>;
  for (const language of LANGUAGES) {
    const saved = church.texts?.[language];
    out[language] = saved ? { code: saved.editionCode, line: saved.attribution?.[language] ?? knownLine(saved.editionCode, language) } : { code: "", line: "" };
  }
  return out;
}
