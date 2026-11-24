// ONE settings file for a church copy (Paul's brief, item 8): src/church/church.json.
// A church copy changes this file and nothing else: its name and logo, its colours, the Bible text each language reads,
// its default language, and its own list of daily readings. `parseChurchSettings` checks it and never throws: a part that
// is wrong is ignored (the OriginalScript default is used) and named in `problems`, so a typing slip cannot break the site.
// The admin panel will edit this same shape later. See docs/CHURCH-COPY.md.

export type ChurchReading = { book: string; chapter: number; part?: [number, number] };
/**
 * A plan with a start date is read by the whole church on the same day: the server says which day it is today (in the church's own time zone).
 * `dayNumber` counts from 1; null means no reading today (the plan has not begun, or it ended and does not repeat).
 */
export type PlanSchedule = { startDate: string; repeats: boolean; today: { date: string; dayNumber: number | null } };
export type ChurchPlan = { id: string; title: Record<string, string>; days: ChurchReading[][]; schedule?: PlanSchedule };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The schedule part of a plan, or undefined when it is missing or wrong (the plan then works as a plan without a start date). */
export function parseSchedule(raw: unknown, length: number): PlanSchedule | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const today = s.today && typeof s.today === "object" && !Array.isArray(s.today) ? (s.today as Record<string, unknown>) : undefined;
  if (typeof s.startDate !== "string" || !DAY.test(s.startDate) || typeof s.repeats !== "boolean" || !today) return undefined;
  if (typeof today.date !== "string" || !DAY.test(today.date)) return undefined;
  const n = today.dayNumber;
  if (n !== null && !(Number.isInteger(n) && (n as number) >= 1 && (n as number) <= length)) return undefined;
  return { startDate: s.startDate, repeats: s.repeats, today: { date: today.date, dayNumber: n as number | null } };
}
export type ChurchSettings = {
  /** The name shown in the header and footer. */
  name: string;
  /** The name in each language the church gave one for (when found by web address). `name` is the one for its default language. */
  names?: Record<string, string>;
  /** The web address on the picture a reader shares (no https://). */
  address: string;
  /** A picture in public/ (for example "/church/logo.svg"), or for a church found by web address an https address of a stored file. Without it the book icon shows. */
  logo?: string;
  /** Hex colours: accent for buttons and links in the light theme, accentDark in the dark theme. */
  colors?: { accent?: string; accentDark?: string };
  /** The language a first-time reader gets (en, ml or hi) before the phone's language. */
  defaultLanguage?: string;
  /** The edition code each language reads in the Daily Bible. */
  dailyText: Record<string, string>;
  /** This church's own reading plans. When present they replace the three starter plans. */
  plans?: ChurchPlan[];
};

export const DEFAULTS: ChurchSettings = {
  name: "Daily Bible",
  address: "theblinkgrid.com",
  dailyText: { en: "bolls-kjv", ml: "bolls-mov" },
};

const LANGUAGES = ["en", "ml", "hi"];
const HEX = /^#[0-9a-f]{6}$/i;

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The church's name in a language, else the name it gave for its default language. */
export function churchName(settings: ChurchSettings, language: string): string {
  return settings.names?.[language] || settings.name;
}

/** `remoteLogo`: a church found by web address may have its logo at an https address of a file our server stores. A church file may not (a typo must never load a stranger's picture). */
export function parseChurchSettings(input: unknown, options: { remoteLogo?: boolean } = {}): { settings: ChurchSettings; problems: string[] } {
  const problems: string[] = [];
  const settings: ChurchSettings = { ...DEFAULTS, dailyText: { ...DEFAULTS.dailyText } };
  if (!isObject(input)) return { settings, problems: ["the settings file is not an object"] };

  const name = text(input.name);
  if (name) settings.name = name;
  else problems.push("name is missing");
  const address = text(input.address);
  if (address) settings.address = address.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const logo = text(input.logo);
  if (input.logo !== undefined) {
    if (logo && (/^\/[\w./-]+\.(svg|png|webp|jpg|jpeg)$/i.test(logo) || (options.remoteLogo && /^https:\/\/[\w.-]+(:\d+)?\/[\w./%-]+\.(svg|png|webp|jpg|jpeg)$/i.test(logo)))) settings.logo = logo;
    else problems.push("logo must be a file in public/, such as /church/logo.svg");
  }

  if (input.defaultLanguage !== undefined) {
    if (typeof input.defaultLanguage === "string" && LANGUAGES.includes(input.defaultLanguage)) settings.defaultLanguage = input.defaultLanguage;
    else problems.push(`defaultLanguage must be one of ${LANGUAGES.join(", ")}`);
  }

  if (input.colors !== undefined) {
    const c = isObject(input.colors) ? input.colors : {};
    const colors: NonNullable<ChurchSettings["colors"]> = {};
    // Any #rrggbb colour is accepted as the church chose it (24 Nov: no readability check).
    if (c.accent !== undefined) {
      if (typeof c.accent === "string" && HEX.test(c.accent)) colors.accent = c.accent.toLowerCase();
      else problems.push("colors.accent must be a #rrggbb colour");
    }
    if (c.accentDark !== undefined) {
      if (typeof c.accentDark === "string" && HEX.test(c.accentDark)) colors.accentDark = c.accentDark.toLowerCase();
      else problems.push("colors.accentDark must be a #rrggbb colour");
    }
    if (colors.accent || colors.accentDark) settings.colors = colors;
  }

  if (input.dailyText !== undefined) {
    if (isObject(input.dailyText)) {
      for (const [lang, code] of Object.entries(input.dailyText)) {
        if (LANGUAGES.includes(lang) && typeof code === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(code)) settings.dailyText[lang] = code;
        else problems.push(`dailyText.${lang} must be an edition code for en, ml or hi`);
      }
    } else problems.push("dailyText must list an edition code per language");
  }

  if (input.plans !== undefined) {
    const plans: ChurchPlan[] = [];
    if (Array.isArray(input.plans)) {
      input.plans.forEach((p, i) => {
        const id = isObject(p) ? text(p.id) : undefined;
        const title = isObject(p) && isObject(p.title) ? Object.fromEntries(Object.entries(p.title).filter(([k, v]) => LANGUAGES.includes(k) && text(v)).map(([k, v]) => [k, String(v).trim()])) : {};
        const days = isObject(p) && Array.isArray(p.days) ? (p.days as unknown[]) : [];
        const okDays: ChurchReading[][] = [];
        let bad = false;
        for (const day of days) {
          const list = Array.isArray(day) ? day : [];
          const readings: ChurchReading[] = [];
          for (const r of list) {
            const ok = isObject(r) && typeof r.book === "string" && /^[a-z0-9-]+$/.test(r.book) && Number.isInteger(r.chapter) && (r.chapter as number) >= 1;
            const part = isObject(r) ? r.part : undefined;
            const partOk = part === undefined || (Array.isArray(part) && part.length === 2 && part.every(Number.isInteger) && part[0] >= 1 && part[0] <= part[1] && part[1] <= 10);
            if (ok && partOk) readings.push({ book: r.book as string, chapter: r.chapter as number, ...(part ? { part: part as [number, number] } : {}) });
            else bad = true;
          }
          if (readings.length) okDays.push(readings);
          else bad = true;
        }
        const schedule = isObject(p) && p.schedule !== undefined ? parseSchedule(p.schedule, okDays.length) : undefined;
        if (isObject(p) && p.schedule !== undefined && !schedule) problems.push(`plans[${i}].schedule is not valid; the plan is read without a start date`);
        if (id && /^[a-z0-9-]+$/i.test(id) && Object.keys(title).length && okDays.length && !bad) plans.push({ id, title, days: okDays, ...(schedule ? { schedule } : {}) });
        else problems.push(`plans[${i}] needs an id, a title in at least one language, and days of readings (book, chapter and optional part)`);
      });
    } else problems.push("plans must be a list");
    if (plans.length) settings.plans = plans;
  }
  return { settings, problems };
}
