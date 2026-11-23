import {
  ChurchApiError,
  LANGUAGES,
  checkInput,
  checkTextChoice,
  cleanInput,
  effectiveStatus,
  missingForSwitchOn,
  statusAllows,
  type ChurchInput,
  type ChurchRecord,
  type ChurchStatus,
  type ChurchText,
  type DailyEdition,
  type Detail,
  type ErrorCode,
  type Language,
} from "./churchEdits.ts";
import { checkPlan, cleanTitle, isRealDate, type PlanInput, type PlanReading, type PlanRecord } from "./churchPlanRules.ts";
import { fillDays, standInCounts, type ReaderDay } from "../church/readerCount.ts";

// Where the churches are kept. Two stores answer to the same interface: this file's stand-in, which keeps churches in THIS browser only
// (used until Shalom's calls exist; the screen says so), and the server store below, written to docs/contracts/CHURCH-SETUP-contract.md.
// churchesStoreSelect.ts picks one. The stand-in follows the contract's rules, so what the screens do here is what they will do for real.

export interface ChurchesStore {
  /** "browser": kept in this browser only. "server": saved on the server. */
  readonly kind: "browser" | "server";
  list(): Promise<ChurchRecord[]>;
  get(id: string): Promise<ChurchRecord>;
  create(input: ChurchInput): Promise<ChurchRecord>;
  update(id: string, input: ChurchInput, expectedVersion: number): Promise<ChurchRecord>;
  setStatus(id: string, status: ChurchStatus, expectedVersion: number): Promise<ChurchRecord>;
  /** The Bible texts staff may offer, each with its permission status (contract Part 3). */
  editions(): Promise<DailyEdition[]>;
  /** Chooses the church's Bible text for one language. Refused (TEXT_NOT_PERMITTED) unless the text is public-domain or permission-granted. */
  setText(id: string, language: Language, choice: TextChoice, expectedVersion: number): Promise<ChurchRecord>;
  /** Removes the church's own choice for one language (the language falls back to the default text). */
  removeText(id: string, language: Language): Promise<ChurchRecord>;
  /** The church's reading plan: its active plan, else a plan made but not yet assigned, else null (contract Part 4). */
  plan(church: ChurchRecord): Promise<PlanRecord | null>;
  /**
   * Saves the church's plan and makes it the church's `activePlanId` (the whole plan is replaced). `current` is the plan the screen loaded, so a
   * plan saved by someone else in between is refused (CONFLICT_VERSION). Refused with PLAN_INVALID, naming the day, when a reading is wrong.
   */
  savePlan(church: ChurchRecord, input: PlanInput, current: PlanRecord | null): Promise<{ church: ChurchRecord; plan: PlanRecord }>;
  /** How many readers opened the church's reading on each of `days` (UTC days, oldest first): one row for every day, newest first (contract Part 8). */
  readers(church: ChurchRecord, days: string[]): Promise<ReaderDay[]>;
}

export type TextChoice = { editionCode: string; attribution: Partial<Record<Language, string>> };

/**
 * The texts the stand-in offers. The three built-in ones are what the site reads today; their permission is the real one
 * (the Malayalam and Hindi texts are NOT confirmed, see src/daily/universal.ts). The two SAMPLE texts exist so the screens
 * can be tried to the end: they are test data and never a church's real text (contract, test data).
 */
export const STAND_IN_EDITIONS: DailyEdition[] = [
  { editionCode: "bolls-kjv", language: "en", name: "King James Version", source: "bolls", permissionStatus: "public-domain" },
  { editionCode: "bolls-mov", language: "ml", name: "Malayalam Old Version", source: "bolls", permissionStatus: "unknown" },
  { editionCode: "bolls-hiov", language: "hi", name: "Hindi Old Version", source: "bolls", permissionStatus: "unknown" },
  { editionCode: "sample-church-en", language: "en", name: "SAMPLE English text (test only)", source: "originalscript", permissionStatus: "public-domain" },
  { editionCode: "sample-church-ml", language: "ml", name: "SAMPLE Malayalam text (test only)", source: "originalscript", permissionStatus: "public-domain" },
];

type Memory = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const KEY = "blinkgrid-church.staff-churches-preview.v1";
const PLANS_KEY = "blinkgrid-church.staff-church-plans-preview.v1";

export function createLocalChurchesStore(storage: Memory, now: () => string = () => new Date().toISOString(), by = "You", newId: () => string = () => crypto.randomUUID()): ChurchesStore {
  const read = (): ChurchRecord[] => {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const write = (rows: ChurchRecord[]) => {
    try {
      storage.setItem(KEY, JSON.stringify(rows));
    } catch {
      /* private window or full storage: the change lives until the page closes only */
    }
  };
  const readPlans = (): PlanRecord[] => {
    try {
      const parsed = JSON.parse(storage.getItem(PLANS_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const writePlans = (rows: PlanRecord[]) => {
    try {
      storage.setItem(PLANS_KEY, JSON.stringify(rows));
    } catch {
      /* private window or full storage: the change lives until the page closes only */
    }
  };
  const find = (rows: ChurchRecord[], id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new ChurchApiError("CHURCH_NOT_FOUND");
    return row;
  };
  // The same refusals the server gives: a rule broken (400), an address another church has (409).
  const guard = (rows: ChurchRecord[], input: ChurchInput, selfId?: string) => {
    const problems = checkInput(input);
    if (problems.length) throw new ChurchApiError("VALIDATION_FAILED", problems);
    const mine = cleanInput(input);
    const taken: Detail[] = [];
    mine.addresses.forEach((a, i) => {
      if (rows.some((r) => r.id !== selfId && r.addresses.includes(a))) taken.push({ field: `addresses.${i}`, problem: "taken" });
    });
    if (taken.length) throw new ChurchApiError("ADDRESS_TAKEN", taken);
    return mine;
  };
  const stale = (row: ChurchRecord, expectedVersion: number) => {
    if (row.version !== expectedVersion) throw new ChurchApiError("CONFLICT_VERSION");
  };
  return {
    kind: "browser",
    list: async () => read(),
    get: async (id) => find(read(), id),
    async create(input) {
      const rows = read();
      const mine = guard(rows, input);
      const at = now();
      const row: ChurchRecord = { id: newId(), ...mine, status: "draft", texts: {}, activePlanId: null, version: 1, updatedBy: by, updatedAt: at, createdAt: at };
      write([...rows, row]);
      return row;
    },
    async update(id, input, expectedVersion) {
      const rows = read();
      const row = find(rows, id);
      stale(row, expectedVersion);
      const mine = guard(rows, input, id);
      const next: ChurchRecord = { ...row, ...mine, version: row.version + 1, updatedBy: by, updatedAt: now() };
      write(rows.map((r) => (r.id === id ? next : r)));
      return next;
    },
    async editions() {
      return STAND_IN_EDITIONS.map((e) => ({ ...e }));
    },
    async setText(id, language, choice, expectedVersion) {
      const rows = read();
      const row = find(rows, id);
      stale(row, expectedVersion);
      const problems = checkTextChoice(choice.editionCode, choice.attribution[language] ?? "");
      if (!LANGUAGES.includes(language)) problems.push({ field: "language", problem: "invalid" });
      const edition = STAND_IN_EDITIONS.find((e) => e.editionCode === choice.editionCode);
      if (!edition || edition.language !== language) problems.push({ field: "editionCode", problem: "invalid" });
      if (problems.length) throw new ChurchApiError("VALIDATION_FAILED", problems);
      const status = effectiveStatus(edition!, now().slice(0, 10));
      if (!statusAllows(status)) throw new ChurchApiError("TEXT_NOT_PERMITTED", [{ field: "editionCode", problem: `permission is ${status.replace("permission-", "")}` }]);
      const text: ChurchText = { editionCode: edition!.editionCode, permissionStatus: status, attribution: choice.attribution };
      const next: ChurchRecord = { ...row, texts: { ...row.texts, [language]: text }, version: row.version + 1, updatedBy: by, updatedAt: now() };
      write(rows.map((r) => (r.id === id ? next : r)));
      return next;
    },
    async removeText(id, language) {
      const rows = read();
      const row = find(rows, id);
      const texts = { ...row.texts };
      delete texts[language];
      const next: ChurchRecord = { ...row, texts, version: row.version + 1, updatedBy: by, updatedAt: now() };
      write(rows.map((r) => (r.id === id ? next : r)));
      return next;
    },
    async plan(church) {
      const plans = readPlans().filter((p) => p.churchId === church.id);
      return plans.find((p) => p.id === church.activePlanId) ?? plans[0] ?? null;
    },
    async savePlan(church, input, current) {
      const problems = checkPlan(input);
      if (problems.length) throw new ChurchApiError("PLAN_INVALID", problems);
      const rows = read();
      const row = find(rows, church.id);
      const plans = readPlans();
      const mine = plans.filter((p) => p.churchId === church.id);
      const existing = current ? plans.find((p) => p.id === current.id) : (mine.find((p) => p.id === row.activePlanId) ?? mine[0]);
      if (current && !existing) throw new ChurchApiError("CONFLICT_VERSION");
      if (existing && existing.churchId !== church.id) throw new ChurchApiError("FORBIDDEN");
      if (current && existing && existing.version !== current.version) throw new ChurchApiError("CONFLICT_VERSION");
      const assign = !existing || row.activePlanId !== existing.id;
      if (assign) stale(row, church.version);
      const at = now();
      const record: PlanRecord = {
        id: existing?.id ?? newId(),
        churchId: church.id,
        title: cleanTitle(input.title),
        days: input.days.map((d) => d.map((r) => ({ ...r }))),
        startDate: input.startDate || null,
        repeats: !!input.repeats,
        version: existing ? existing.version + 1 : 1,
        updatedBy: by,
        updatedAt: at,
      };
      writePlans(existing ? plans.map((p) => (p.id === record.id ? record : p)) : [...plans, record]);
      if (row.activePlanId === record.id) return { church: row, plan: record };
      const next: ChurchRecord = { ...row, activePlanId: record.id, version: row.version + 1, updatedBy: by, updatedAt: at };
      write(rows.map((r) => (r.id === row.id ? next : r)));
      return { church: next, plan: record };
    },
    // In this browser only: the counts of the site's own "stub" build, added for all the church's addresses.
    async readers(church, days) {
      return fillDays(standInCounts(storage, church.addresses, days), days);
    },
    async setStatus(id, status, expectedVersion) {
      const rows = read();
      const row = find(rows, id);
      stale(row, expectedVersion);
      if (status === "active") {
        const missing = missingForSwitchOn(row);
        if (missing.length) throw new ChurchApiError("NOT_READY", missing.map((field) => ({ field, problem: "missing" })));
      }
      const next: ChurchRecord = { ...row, status, version: row.version + 1, updatedBy: by, updatedAt: now() };
      write(rows.map((r) => (r.id === id ? next : r)));
      return next;
    },
  };
}

export type Request = (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown) => Promise<unknown>;

const CODES: ErrorCode[] = ["VALIDATION_FAILED", "AUTH_REQUIRED", "FORBIDDEN", "CHURCH_NOT_FOUND", "CONFLICT_VERSION", "ADDRESS_TAKEN", "TEXT_NOT_PERMITTED", "PLAN_INVALID", "NOT_READY", "RATE_LIMITED", "UNAVAILABLE"];

/** Anything that went wrong becomes a ChurchApiError the screen can word (contract Part 6). The server's own sentence is never shown. */
export function toChurchError(error: unknown): ChurchApiError {
  if (error instanceof ChurchApiError) return error;
  const { status, code, details } = (error ?? {}) as { status?: number; code?: string; details?: Detail[] };
  if (code && (CODES as string[]).includes(code)) return new ChurchApiError(code as ErrorCode, Array.isArray(details) ? details : []);
  if (status === 401) return new ChurchApiError("AUTH_REQUIRED");
  if (status === 403) return new ChurchApiError("FORBIDDEN");
  if (status === 404) return new ChurchApiError("CHURCH_NOT_FOUND");
  if (status === 409) return new ChurchApiError("CONFLICT_VERSION");
  if (status === 400 || status === 422) return new ChurchApiError("VALIDATION_FAILED");
  if (status === 429) return new ChurchApiError("RATE_LIMITED");
  return new ChurchApiError("UNAVAILABLE");
}

const MAX_PAGES = 100;

/** The store that talks to the server (contract file, Parts 1 and 6). Takes the request function so tests can run it against a fake server. */
export function createApiChurchesStore(request: Request): ChurchesStore {
  async function call<T>(method: Parameters<Request>[0], where: string, body?: unknown): Promise<T> {
    try {
      return (await request(method, where, body)) as T;
    } catch (error) {
      throw toChurchError(error);
    }
  }
  /** The church row does not carry its texts (Part 3 keeps them in their own rows): they are read with `GET /admin/churches/{id}/texts`. */
  async function withTexts(id: string, church: ChurchRecord): Promise<ChurchRecord> {
    const answer = await call<{ items?: { language?: string; editionCode?: string; permissionStatus?: ChurchText["permissionStatus"]; attribution?: ChurchText["attribution"] }[] }>(
      "GET",
      `/admin/churches/${encodeURIComponent(id)}/texts`,
    );
    const texts: ChurchRecord["texts"] = {};
    for (const row of answer.items ?? []) {
      const language = LANGUAGES.find((l) => l === row.language);
      if (language && row.editionCode && row.permissionStatus) texts[language] = { editionCode: row.editionCode, permissionStatus: row.permissionStatus, attribution: row.attribution };
    }
    return { ...church, texts };
  }
  const body = (input: ChurchInput) => {
    const c = cleanInput(input);
    return { name: c.name, colors: c.colors, defaultLanguage: c.defaultLanguage, addresses: c.addresses, ...(c.timeZone ? { timeZone: c.timeZone } : {}) };
  };
  return {
    kind: "server",
    async list() {
      const all: ChurchRecord[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const answer: { items?: ChurchRecord[]; nextCursor?: string | null } = await call("GET", `/admin/churches${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
        all.push(...(answer.items ?? []).map((c) => ({ ...c, texts: {} })));
        cursor = answer.nextCursor ?? null;
        if (!cursor) break;
      }
      return all;
    },
    get: async (id) => withTexts(id, (await call<{ church: ChurchRecord }>("GET", `/admin/churches/${encodeURIComponent(id)}`)).church),
    create: async (input) => ({ ...(await call<{ church: ChurchRecord }>("POST", "/admin/churches", body(input))).church, texts: {} }),
    update: async (id, input, expectedVersion) =>
      withTexts(id, (await call<{ church: ChurchRecord }>("PATCH", `/admin/churches/${encodeURIComponent(id)}`, { ...body(input), expectedVersion })).church),
    setStatus: async (id, status, expectedVersion) =>
      withTexts(id, (await call<{ church: ChurchRecord }>("POST", `/admin/churches/${encodeURIComponent(id)}/status`, { status, expectedVersion })).church),
    editions: async () => (await call<{ items?: DailyEdition[] }>("GET", "/admin/editions/daily")).items ?? [],
    // The answer of a text call is the text row; the church (its version went up) is read again so the screen shows what is saved.
    async setText(id, language, choice, expectedVersion) {
      await call("PUT", `/admin/churches/${encodeURIComponent(id)}/texts/${language}`, { editionCode: choice.editionCode, attribution: choice.attribution, expectedVersion });
      return this.get(id);
    },
    async removeText(id, language) {
      await call("DELETE", `/admin/churches/${encodeURIComponent(id)}/texts/${language}`);
      return this.get(id);
    },
    // Contract Part 4: the plan is its own row. The church's `activePlanId` points at it; a plan made but never assigned is found in the church's list.
    async plan(church) {
      if (church.activePlanId) return toPlan((await call<{ plan?: unknown }>("GET", `/admin/plans/${encodeURIComponent(church.activePlanId)}`)).plan);
      const answer = await call<{ items?: unknown[] }>("GET", `/admin/churches/${encodeURIComponent(church.id)}/plans`);
      const first = answer.items?.[0];
      return first ? toPlan(first) : null;
    },
    async savePlan(church, input, current) {
      // startDate null clears a date; repeats is always sent so a ticked box that is later unticked is saved.
      const body = { title: cleanTitle(input.title), days: input.days, startDate: input.startDate || null, repeats: !!input.repeats };
      // A plan made earlier but never assigned (the assign call failed) is written again, not duplicated.
      const existing = current ?? (await this.plan(church));
      const answer = existing
        ? await call<{ plan?: unknown }>("PUT", `/admin/plans/${encodeURIComponent(existing.id)}`, { ...body, expectedVersion: existing.version })
        : await call<{ plan?: unknown }>("POST", `/admin/churches/${encodeURIComponent(church.id)}/plans`, body);
      const record = toPlan(answer.plan);
      if (church.activePlanId === record.id) return { church, plan: record };
      const patched = await call<{ church: ChurchRecord }>("PATCH", `/admin/churches/${encodeURIComponent(church.id)}`, { activePlanId: record.id, expectedVersion: church.version });
      return { church: await withTexts(church.id, patched.church), plan: record };
    },
    // Contract Part 8: one row for each day WITH a count; the days without one are filled in as 0 here.
    async readers(church, days) {
      const answer = await call<{ items?: unknown }>("GET", `/admin/churches/${encodeURIComponent(church.id)}/readers?from=${days[0]}&to=${days[days.length - 1]}`);
      return fillDays(answer.items, days);
    },
  };
}

/** A plan as the server sent it, or UNAVAILABLE when it is not a plan the screen can show. Readings that are not readings are left out, so nothing breaks the screen. */
export function toPlan(raw: unknown): PlanRecord {
  const p = (raw ?? {}) as Partial<PlanRecord>;
  if (typeof p.id !== "string" || !Array.isArray(p.days) || typeof p.version !== "number") throw new ChurchApiError("UNAVAILABLE");
  const reading = (r: unknown): r is PlanReading => !!r && typeof (r as PlanReading).book === "string" && Number.isInteger((r as PlanReading).chapter);
  return {
    id: p.id,
    churchId: typeof p.churchId === "string" ? p.churchId : "",
    title: p.title && typeof p.title === "object" ? p.title : {},
    days: p.days.map((d) => (Array.isArray(d) ? d.filter(reading) : [])),
    startDate: typeof p.startDate === "string" && isRealDate(p.startDate) ? p.startDate : null,
    repeats: p.repeats === true,
    version: p.version,
    updatedBy: typeof p.updatedBy === "string" ? p.updatedBy : "",
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : "",
  };
}

/** The storage of this browser. Without it (private window), changes are kept in memory until the page closes. */
export function browserStorage(): Memory {
  try {
    const s = window.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    const memory = new Map<string, string>();
    return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
  }
}
