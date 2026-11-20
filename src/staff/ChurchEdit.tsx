import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Notice } from "../ui/Notice";
import { Page, useUI } from "../Platform";
import { useAdminAccess } from "./access";
import { AdminSelect } from "./AdminSelect";
import { churchesStore } from "./churchesStoreSelect";
import { toChurchError } from "./churchesStore.ts";
import { ChurchTexts } from "./ChurchTexts";
import { ChurchPlan } from "./ChurchPlan";
import { ChurchReaders } from "./ChurchReaders";
import { ChurchApiError, LANGUAGES, checkInput, cleanInput, type ChurchInput, type ChurchRecord, type ChurchStatus, type Detail, type Language } from "./churchEdits";

type T = (key: string, options?: Record<string, unknown>) => string;

/** Each language is shown in its own words, as the language menu does. */
const OWN_NAME: Record<Language, string> = { en: "English", ml: "മലയാളം", hi: "हिन्दी" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const statusLabel = (t: T, status: ChurchStatus) => t(`admin:churchStatus${cap(status)}`);

/** The sentence for a failed call or edit (contract Part 6). The server's own words are never shown. */
export function errorText(t: T, error: ChurchApiError): string {
  if (error.code === "NOT_READY") {
    const list = error.details.map((d) => t(`admin:churchMissing${cap(d.field)}`)).join(", ");
    return t("admin:churchNotReady", { list });
  }
  return t(`admin:churchErr${error.code}`);
}

const blank: ChurchInput = { name: {}, colors: {}, defaultLanguage: "en", addresses: [""] };
const toInput = (c: ChurchRecord): ChurchInput => ({ name: { ...c.name }, colors: { ...c.colors }, defaultLanguage: c.defaultLanguage, addresses: c.addresses.length ? [...c.addresses] : [""] });

/** The form for one church: name per language, colours, default language, web addresses, and its status. New (`/staff/new`) or edit (`/staff/:id`). */
export function ChurchEdit({ isNew = false }: { isNew?: boolean }) {
  const { t } = useUI();
  const access = useAdminAccess();
  const navigate = useNavigate();
  const { id } = useParams();
  const store = churchesStore();
  const canSave = access.manageChurches;
  const [church, setChurch] = useState<ChurchRecord | null>(null);
  const [form, setForm] = useState<ChurchInput>(blank);
  const [state, setState] = useState<"loading" | "ready" | "failed">(isNew ? "ready" : "loading");
  const [problems, setProblems] = useState<Detail[]>([]);
  const [error, setError] = useState<ChurchApiError | null>(null);
  const [message, setMessage] = useState("");
  /** Where the last answer belongs: under the Save button, or next to the status buttons. */
  const [where, setWhere] = useState<"form" | "status">("form");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    let live = true;
    setState("loading");
    store
      .get(id)
      .then((c) => {
        if (!live) return;
        setChurch(c);
        setForm(toInput(c));
        setState("ready");
      })
      .catch((e) => {
        if (!live) return;
        setError(toChurchError(e));
        setState("failed");
      });
    return () => {
      live = false;
    };
  }, [id, isNew, store]);

  const problemFor = (field: string) => problems.find((p) => p.field === field);
  const fieldError = (field: string) => {
    const p = problemFor(field);
    return p ? (
      <p className="os-field-error" role="alert" id={`err-${field}`}>
        {t(`admin:churchProblem${cap(p.problem)}`)}
      </p>
    ) : null;
  };
  const set = (patch: Partial<ChurchInput>) => {
    setForm({ ...form, ...patch });
    setMessage("");
  };

  async function run(action: () => Promise<ChurchRecord>, done: (c: ChurchRecord) => string, place: "form" | "status" = "form") {
    if (busy) return;
    setBusy(true);
    setWhere(place);
    setError(null);
    setMessage("");
    try {
      const saved = await action();
      setChurch(saved);
      setForm(toInput(saved));
      setProblems([]);
      setMessage(done(saved));
      return saved;
    } catch (e) {
      const err = toChurchError(e);
      setError(err);
      // Fields the server named are marked on the form, like the ones the screen found itself.
      setProblems(err.details.filter((d) => d.problem !== "missing"));
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const mine = cleanInput(form);
    const found = checkInput(form);
    setProblems(found);
    setWhere("form");
    setError(null);
    setMessage("");
    if (found.length) {
      setError(new ChurchApiError("VALIDATION_FAILED", found));
      return;
    }
    if (isNew) {
      const created = await run(() => store.create(mine), () => t("admin:churchCreated"));
      if (created) navigate(`/staff/${created.id}`, { replace: true, state: { created: true } });
    } else if (church) await run(() => store.update(church.id, mine, church.version), () => t("admin:churchSaved"));
  }

  const changeStatus = (status: ChurchStatus) =>
    church && run(() => store.setStatus(church.id, status, church.version), (c) => t("admin:churchStatusChanged", { status: statusLabel(t, c.status) }), "status");

  const title = isNew ? t("admin:newChurch") : t("admin:editChurch");
  if (state === "loading")
    return (
      <Page title={title} back="/staff">
        <p role="status">{t("common:loading")}</p>
      </Page>
    );
  if (state === "failed")
    return (
      <Page title={title} back="/staff">
        <Notice tone="error">
          <p>{error ? errorText(t, error) : t("admin:churchesLoadFailed")}</p>
        </Notice>
      </Page>
    );

  return (
    <Page title={title} back="/staff">
      {store.kind === "browser" && (
        <Notice tone="info">
          <p>{t("admin:churchesPreviewNotice")}</p>
        </Notice>
      )}
      {!canSave && (
        <Notice tone="info">
          <p>{t("admin:churchReadOnly")}</p>
        </Notice>
      )}
      <form className="os-form os-church-form" onSubmit={save} noValidate>
        <fieldset disabled={!canSave || busy}>
          <legend>{t("admin:churchNameHeading")}</legend>
          <p className="os-field-hint">{t("admin:churchNameHint")}</p>
          {fieldError("name")}
          {LANGUAGES.map((l) => (
            <label className="os-field" key={l}>
              {t("admin:churchNameIn", { language: OWN_NAME[l] })}
              <input value={form.name[l] ?? ""} maxLength={200} aria-invalid={!!problemFor(`name.${l}`) || !!problemFor("name")} onChange={(e) => set({ name: { ...form.name, [l]: e.target.value } })} />
              {fieldError(`name.${l}`)}
            </label>
          ))}
          <AdminSelect
            label={t("admin:churchDefaultLanguage")}
            value={form.defaultLanguage}
            options={LANGUAGES.map((l) => ({ value: l, label: OWN_NAME[l] }))}
            onChange={(value) => set({ defaultLanguage: value as Language })}
            disabled={!canSave || busy}
          />
          {fieldError("defaultLanguage")}
        </fieldset>

        <fieldset disabled={!canSave || busy}>
          <legend>{t("admin:churchColors")}</legend>
          <p className="os-field-hint">{t("admin:churchColorHint")}</p>
          {(["accent", "accentDark"] as const).map((key) => (
            <label className="os-field" key={key}>
              {t(key === "accent" ? "admin:churchAccent" : "admin:churchAccentDark")}
              <span className="os-church-color">
                <input
                  value={form.colors[key] ?? ""}
                  placeholder="#1f5f4a"
                  maxLength={7}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!problemFor(`colors.${key}`)}
                  onChange={(e) => set({ colors: { ...form.colors, [key]: e.target.value } })}
                />
                <i aria-hidden="true" className="os-church-swatch" style={{ background: /^#[0-9a-f]{6}$/i.test(form.colors[key] ?? "") ? form.colors[key] : "transparent" }} />
              </span>
              {fieldError(`colors.${key}`)}
            </label>
          ))}
        </fieldset>

        <fieldset disabled={!canSave || busy}>
          <legend>{t("admin:churchAddresses")}</legend>
          <p className="os-field-hint">{t("admin:churchAddressHint")}</p>
          {fieldError("addresses")}
          {form.addresses.map((a, i) => (
            <div className="os-church-address" key={i}>
              <label className="os-field">
                {t("admin:churchAddressLabel", { n: i + 1 })}
                <input
                  value={a}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="church.example.org"
                  aria-invalid={!!problemFor(`addresses.${i}`)}
                  onChange={(e) => set({ addresses: form.addresses.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                {fieldError(`addresses.${i}`)}
              </label>
              {form.addresses.length > 1 && (
                <button type="button" aria-label={t("admin:churchAddressRemove", { n: i + 1 })} onClick={() => set({ addresses: form.addresses.filter((_, j) => j !== i) })}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => set({ addresses: [...form.addresses, ""] })}>
            {t("admin:churchAddressAdd")}
          </button>
        </fieldset>

        {canSave && (
          <button className="os-primary" disabled={busy}>
            {isNew ? t("admin:churchCreate") : t("admin:churchSave")}
          </button>
        )}
        {where === "form" && error && (
          <p role="alert" className="os-live-message os-church-error">
            {errorText(t, error)}
          </p>
        )}
        {where === "form" && message && (
          <p role="status" className="os-live-message">
            {message}
          </p>
        )}
      </form>

      {church && <ChurchTexts church={church} canSave={canSave} store={store} onChurch={setChurch} />}

      {church && <ChurchPlan church={church} canSave={canSave} store={store} onChurch={setChurch} />}

      {church && <ChurchReaders church={church} store={store} />}

      {church && (
        <section className="os-church-status-panel" aria-labelledby="church-status">
          <h2 id="church-status">{t("admin:churchStatusHeading")}</h2>
          <p>
            <span className={`os-church-status is-${church.status}`}>{statusLabel(t, church.status)}</span>
          </p>
          <p className="os-field-hint">{t("admin:churchStatusNote")}</p>
          {canSave && (
            <div className="os-church-actions">
              {(church.status === "draft" || church.status === "paused") && (
                <button type="button" className="os-primary" disabled={busy} onClick={() => changeStatus("active")}>
                  {t("admin:churchSwitchOn")}
                </button>
              )}
              {church.status === "active" && (
                <button type="button" disabled={busy} onClick={() => changeStatus("paused")}>
                  {t("admin:churchPause")}
                </button>
              )}
              {church.status !== "archived" && (
                <button type="button" disabled={busy} onClick={() => changeStatus("archived")}>
                  {t("admin:churchArchive")}
                </button>
              )}
            </div>
          )}
          {where === "status" && error && (
            <p role="alert" className="os-live-message os-church-error">
              {errorText(t, error)}
            </p>
          )}
          {where === "status" && message && (
            <p role="status" className="os-live-message">
              {message}
            </p>
          )}
          <p className="os-field-hint">{t("admin:churchSavedBy", { version: church.version, who: church.updatedBy })}</p>
        </section>
      )}
    </Page>
  );
}
