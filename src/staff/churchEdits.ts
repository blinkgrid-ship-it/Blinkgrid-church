// The rules of the church screens, written to docs/contracts/CHURCH-SETUP-contract.md (Parts 1, 2 and 6). No browser code here, so they are
// tested alone (tests/admin-churches.test.mjs). The server repeats every rule: only the server is trusted; these only save a trip and name the field.
import { contrast } from "../church/parse.ts";

export const LANGUAGES = ["en", "ml", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];
export const STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ChurchStatus = (typeof STATUSES)[number];

export type PermissionStatus = "public-domain" | "permission-granted" | "permission-pending" | "permission-refused" | "unknown";
/** A Bible text staff may offer a church (contract Part 3, `GET /admin/editions/daily`). */
export type DailyEdition = {
  editionCode: string;
  language: Language;
  name: string;
  source: "bolls" | "originalscript";
  permissionStatus: PermissionStatus;
  permissionHolder?: string | null;
  /** A date (yyyy-mm-dd) or null. After it a "permission-granted" text counts as "unknown". */
  permissionExpires?: string | null;
};
/** One church's Bible text for one language (contract Part 3). */
export type ChurchText = { editionCode: string; permissionStatus: PermissionStatus; attribution?: Partial<Record<Language, string>> };
export type ChurchRecord = {
  id: string;
  name: Partial<Record<Language, string>>;
  colors: { accent?: string; accentDark?: string };
  defaultLanguage: Language;
  /** The church's time zone; a church saved before this existed has none (the server treats that as UTC). */
  timeZone?: string;
  addresses: string[];
  status: ChurchStatus;
  /** Set on the Bible text screen (T-148); empty until then. */
  texts: Partial<Record<Language, ChurchText>>;
  /** Set on the reading plan screen (T-159); null until then. */
  activePlanId: string | null;
  version: number;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
};
/** What the form edits. */
export type ChurchInput = {
  name: Partial<Record<Language, string>>;
  colors: { accent?: string; accentDark?: string };
  defaultLanguage: Language;
  addresses: string[];
  /** The church's time zone (an IANA name such as Asia/Kolkata). The day of a dated plan changes at midnight there. The server uses UTC when none is sent. */
  timeZone?: string;
};

/** The zones the screen offers first; any other zone a church already has is kept and shown. */
export const TIME_ZONES: { id: string; label: string }[] = [
  { id: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { id: "Asia/Dubai", label: "UAE (Asia/Dubai)" },
  { id: "Asia/Qatar", label: "Qatar (Asia/Qatar)" },
  { id: "Asia/Kuwait", label: "Kuwait (Asia/Kuwait)" },
  { id: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { id: "Europe/London", label: "United Kingdom (Europe/London)" },
  { id: "Europe/Berlin", label: "Central Europe (Europe/Berlin)" },
  { id: "America/New_York", label: "US East (America/New_York)" },
  { id: "America/Chicago", label: "US Central (America/Chicago)" },
  { id: "America/Los_Angeles", label: "US West (America/Los_Angeles)" },
  { id: "Australia/Sydney", label: "Australia East (Australia/Sydney)" },
  { id: "UTC", label: "UTC" },
];
/** What a new church starts with: most churches here are in India. (The server's own default, used when nothing is sent, is UTC.) */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const TIME_ZONE = /^(?=.{1,64}$)[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/;

/** The codes of contract Part 6 (the ones these screens meet). The screen words each one from the language files. */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "CHURCH_NOT_FOUND"
  | "CONFLICT_VERSION"
  | "ADDRESS_TAKEN"
  | "TEXT_NOT_PERMITTED"
  | "PLAN_INVALID"
  | "NOT_READY"
  | "RATE_LIMITED"
  | "UNAVAILABLE";
export type Detail = { field: string; problem: string };
export class ChurchApiError extends Error {
  code: ErrorCode;
  details: Detail[];
  constructor(code: ErrorCode, details: Detail[] = [], message: string = code) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const HOST = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** "HTTPS://Church.Example.org/path:80" is typed by people; the contract keeps the host name only, lower case. */
export function normalizeAddress(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
}

/** The problems with an edit, by field, as codes (not sentences): `name`, `name.ml`, `addresses`, `addresses.1`, `colors.accent`, `colors.accentDark`, `defaultLanguage`. */
export function checkInput(input: ChurchInput): Detail[] {
  const problems: Detail[] = [];
  const names = LANGUAGES.map((l) => [l, (input.name[l] ?? "").trim()] as const);
  if (!names.some(([, v]) => v)) problems.push({ field: "name", problem: "required" });
  for (const [l, v] of names) if (v.length > 80) problems.push({ field: `name.${l}`, problem: "tooLong" });
  if (!LANGUAGES.includes(input.defaultLanguage)) problems.push({ field: "defaultLanguage", problem: "invalid" });
  if (input.timeZone !== undefined && !TIME_ZONE.test(input.timeZone.trim())) problems.push({ field: "timeZone", problem: "invalid" });
  if (!input.addresses.length) problems.push({ field: "addresses", problem: "required" });
  const seen = new Set<string>();
  input.addresses.forEach((a, i) => {
    const host = normalizeAddress(a);
    if (!HOST.test(host)) problems.push({ field: `addresses.${i}`, problem: "invalid" });
    else if (seen.has(host)) problems.push({ field: `addresses.${i}`, problem: "duplicate" });
    seen.add(host);
  });
  // Any #rrggbb colour is accepted (24 Nov: no readability check).
  const { accent, accentDark } = input.colors;
  if (accent && !HEX.test(accent)) problems.push({ field: "colors.accent", problem: "contrast" });
  if (accentDark && !HEX.test(accentDark)) problems.push({ field: "colors.accentDark", problem: "contrast" });
  return problems;
}

/** Cleans an edit the way the server will: trimmed names, lower-case host names, empty colours removed. */
export function cleanInput(input: ChurchInput): ChurchInput {
  const name: ChurchInput["name"] = {};
  for (const l of LANGUAGES) {
    const v = (input.name[l] ?? "").trim();
    if (v) name[l] = v;
  }
  const colors: ChurchInput["colors"] = {};
  if (input.colors.accent?.trim()) colors.accent = input.colors.accent.trim().toLowerCase();
  if (input.colors.accentDark?.trim()) colors.accentDark = input.colors.accentDark.trim().toLowerCase();
  const timeZone = input.timeZone?.trim();
  return { name, colors, defaultLanguage: input.defaultLanguage, addresses: input.addresses.map(normalizeAddress).filter(Boolean), ...(timeZone ? { timeZone } : {}) };
}

export const statusAllows = (status: PermissionStatus) => status === "public-domain" || status === "permission-granted";
export const textIsAllowed = (t: ChurchText | undefined) => !!t && statusAllows(t.permissionStatus);

/** After its end date a granted permission counts as "unknown" (contract Part 3). `today` is yyyy-mm-dd. */
export function effectiveStatus(e: Pick<DailyEdition, "permissionStatus" | "permissionExpires">, today: string): PermissionStatus {
  if (e.permissionStatus === "permission-granted" && e.permissionExpires && e.permissionExpires < today) return "unknown";
  return e.permissionStatus;
}

export const EDITION_CODE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ATTRIBUTION_MAX = 300;

/** The problems with choosing a text: `editionCode`, `attribution`. The line under the chapter is needed for any shown text (contract Part 3). */
export function checkTextChoice(editionCode: string, line: string): Detail[] {
  const problems: Detail[] = [];
  if (!EDITION_CODE.test(editionCode)) problems.push({ field: "editionCode", problem: "invalid" });
  const text = line.trim();
  if (!text) problems.push({ field: "attribution", problem: "required" });
  else if (text.length > ATTRIBUTION_MAX) problems.push({ field: "attribution", problem: "tooLong" });
  return problems;
}

/** What is sent as `attribution`: the line in the text's own language. A line we already know in all three languages (the built-in texts) is sent in all three, unless staff changed it. */
export function attributionFor(language: Language, line: string, known?: Partial<Record<string, string>>): Partial<Record<Language, string>> {
  const text = line.trim();
  if (known && known[language]?.trim() === text) {
    const all: Partial<Record<Language, string>> = {};
    for (const l of LANGUAGES) if (known[l]?.trim()) all[l] = known[l]!.trim();
    return all;
  }
  return { [language]: text };
}

/** What is missing before a church can be switched on (contract Part 1, "switch-on rule"): `name`, `address`, `text`, `plan`. */
export function missingForSwitchOn(c: Pick<ChurchRecord, "name" | "addresses" | "defaultLanguage" | "texts" | "activePlanId">): string[] {
  const missing: string[] = [];
  if (!Object.values(c.name).some((v) => v?.trim())) missing.push("name");
  if (!c.addresses.length) missing.push("address");
  if (!textIsAllowed(c.texts[c.defaultLanguage])) missing.push("text");
  if (!c.activePlanId) missing.push("plan");
  return missing;
}

/** The name to show in a list: the church's name in the reader's language, else the first it has. */
export function displayName(c: Pick<ChurchRecord, "name">, language: string): string {
  return c.name[language as Language] || LANGUAGES.map((l) => c.name[l]).find(Boolean) || "";
}
