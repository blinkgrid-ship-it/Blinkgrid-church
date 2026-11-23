// The reading plan of a church (contract docs/contracts/CHURCH-SETUP-contract.md, Part 4, T-159). No browser code here, so the rules are
// tested alone (tests/admin-church-plan.test.mjs). Two things live here:
//   1. checkPlan: the contract's rules for a plan, named by field the way the server names them (`days[3][0].chapter`).
//   2. parsePlan / formatPlan: staff paste a plan as text, one day on each line, and the screen reads it. The same text is what a saved
//      plan is shown as, so changing a plan is: change the text, save again. The server repeats every rule; these only save a trip.
import { LANGUAGES, type Detail, type Language } from "./churchEdits.ts";

export type PlanReading = { book: string; chapter: number; part?: [number, number] };
/**
 * `startDate` (yyyy-mm-dd) is day 1 of the plan for the whole church; empty means each reader starts on the day they open the plan.
 * `repeats`: the plan begins again after its last day. Both are saved by the server with the plan (and used there to say which day it is today).
 */
export type PlanInput = { title: Partial<Record<Language, string>>; days: PlanReading[][]; startDate?: string | null; repeats?: boolean };
/** yyyy-mm-dd that is a real calendar day (2026-02-30 is not). */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export type PlanRecord = PlanInput & { id: string; churchId: string; version: number; updatedBy: string; updatedAt: string };

export const PLAN_MAX_DAYS = 366;
export const PLAN_MAX_READINGS = 6;
export const PLAN_MAX_PARTS = 10;
export const PLAN_TITLE_MAX = 80;

// The 66 books, in the order of src/daily/universal.ts (CANON): slug, English name, number of chapters, and the short forms people type.
// Only whole English names, slugs and the short forms below are understood, never a guess from the first letters: a wrong guess would put a
// wrong reading into a church's plan without anyone seeing it. Every short form belongs to one book (tests/admin-church-plan.test.mjs).
type Book = { slug: string; name: string; chapters: number; short?: string[] };
export const PLAN_BOOKS: Book[] = [
  { slug: "genesis", name: "Genesis", chapters: 50, short: ["gen", "gn"] },
  { slug: "exodus", name: "Exodus", chapters: 40, short: ["exod", "exo", "ex"] },
  { slug: "leviticus", name: "Leviticus", chapters: 27, short: ["lev", "lv"] },
  { slug: "numbers", name: "Numbers", chapters: 36, short: ["num", "nm"] },
  { slug: "deuteronomy", name: "Deuteronomy", chapters: 34, short: ["deut", "dt"] },
  { slug: "joshua", name: "Joshua", chapters: 24, short: ["josh", "jos"] },
  { slug: "judges", name: "Judges", chapters: 21, short: ["judg", "jdg", "jg"] },
  { slug: "ruth", name: "Ruth", chapters: 4 },
  { slug: "1-samuel", name: "1 Samuel", chapters: 31, short: ["1sam", "1sa", "1sm"] },
  { slug: "2-samuel", name: "2 Samuel", chapters: 24, short: ["2sam", "2sa", "2sm"] },
  { slug: "1-kings", name: "1 Kings", chapters: 22, short: ["1kgs", "1ki"] },
  { slug: "2-kings", name: "2 Kings", chapters: 25, short: ["2kgs", "2ki"] },
  { slug: "1-chronicles", name: "1 Chronicles", chapters: 29, short: ["1chr", "1ch", "1chron"] },
  { slug: "2-chronicles", name: "2 Chronicles", chapters: 36, short: ["2chr", "2ch", "2chron"] },
  { slug: "ezra", name: "Ezra", chapters: 10, short: ["ezr"] },
  { slug: "nehemiah", name: "Nehemiah", chapters: 13, short: ["neh"] },
  { slug: "esther", name: "Esther", chapters: 10, short: ["esth", "est"] },
  { slug: "job", name: "Job", chapters: 42 },
  { slug: "psalms", name: "Psalms", chapters: 150, short: ["psalm", "ps", "psa", "pss"] },
  { slug: "proverbs", name: "Proverbs", chapters: 31, short: ["prov", "prv"] },
  { slug: "ecclesiastes", name: "Ecclesiastes", chapters: 12, short: ["eccl", "eccles", "ecc"] },
  { slug: "song-of-songs", name: "Song of Songs", chapters: 8, short: ["songofsolomon", "song", "sos"] },
  { slug: "isaiah", name: "Isaiah", chapters: 66, short: ["isa"] },
  { slug: "jeremiah", name: "Jeremiah", chapters: 52, short: ["jer"] },
  { slug: "lamentations", name: "Lamentations", chapters: 5, short: ["lam"] },
  { slug: "ezekiel", name: "Ezekiel", chapters: 48, short: ["ezek", "eze", "ezk"] },
  { slug: "daniel", name: "Daniel", chapters: 12, short: ["dan"] },
  { slug: "hosea", name: "Hosea", chapters: 14, short: ["hos"] },
  { slug: "joel", name: "Joel", chapters: 3 },
  { slug: "amos", name: "Amos", chapters: 9 },
  { slug: "obadiah", name: "Obadiah", chapters: 1, short: ["obad"] },
  { slug: "jonah", name: "Jonah", chapters: 4 },
  { slug: "micah", name: "Micah", chapters: 7, short: ["mic"] },
  { slug: "nahum", name: "Nahum", chapters: 3, short: ["nah"] },
  { slug: "habakkuk", name: "Habakkuk", chapters: 3, short: ["hab"] },
  { slug: "zephaniah", name: "Zephaniah", chapters: 3, short: ["zeph", "zep"] },
  { slug: "haggai", name: "Haggai", chapters: 2, short: ["hag"] },
  { slug: "zechariah", name: "Zechariah", chapters: 14, short: ["zech", "zec"] },
  { slug: "malachi", name: "Malachi", chapters: 4, short: ["mal"] },
  { slug: "matthew", name: "Matthew", chapters: 28, short: ["matt", "mat", "mt"] },
  { slug: "mark", name: "Mark", chapters: 16, short: ["mar", "mk", "mrk"] },
  { slug: "luke", name: "Luke", chapters: 24, short: ["luk", "lk"] },
  { slug: "john", name: "John", chapters: 21, short: ["jn", "jhn"] },
  { slug: "acts", name: "Acts", chapters: 28 },
  { slug: "romans", name: "Romans", chapters: 16, short: ["rom", "rm"] },
  { slug: "1-corinthians", name: "1 Corinthians", chapters: 16, short: ["1cor", "1co"] },
  { slug: "2-corinthians", name: "2 Corinthians", chapters: 13, short: ["2cor", "2co"] },
  { slug: "galatians", name: "Galatians", chapters: 6, short: ["gal"] },
  { slug: "ephesians", name: "Ephesians", chapters: 6, short: ["eph"] },
  { slug: "philippians", name: "Philippians", chapters: 4, short: ["phil", "php"] },
  { slug: "colossians", name: "Colossians", chapters: 4, short: ["col"] },
  { slug: "1-thessalonians", name: "1 Thessalonians", chapters: 5, short: ["1thess", "1thes", "1th"] },
  { slug: "2-thessalonians", name: "2 Thessalonians", chapters: 3, short: ["2thess", "2thes", "2th"] },
  { slug: "1-timothy", name: "1 Timothy", chapters: 6, short: ["1tim", "1ti"] },
  { slug: "2-timothy", name: "2 Timothy", chapters: 4, short: ["2tim", "2ti"] },
  { slug: "titus", name: "Titus", chapters: 3, short: ["tit"] },
  { slug: "philemon", name: "Philemon", chapters: 1, short: ["phlm", "philem", "phm"] },
  { slug: "hebrews", name: "Hebrews", chapters: 13, short: ["heb"] },
  { slug: "james", name: "James", chapters: 5, short: ["jas"] },
  { slug: "1-peter", name: "1 Peter", chapters: 5, short: ["1pet", "1pe", "1pt"] },
  { slug: "2-peter", name: "2 Peter", chapters: 3, short: ["2pet", "2pe", "2pt"] },
  { slug: "1-john", name: "1 John", chapters: 5, short: ["1jn", "1jhn"] },
  { slug: "2-john", name: "2 John", chapters: 1, short: ["2jn", "2jhn"] },
  { slug: "3-john", name: "3 John", chapters: 1, short: ["3jn", "3jhn"] },
  { slug: "jude", name: "Jude", chapters: 1 },
  { slug: "revelation", name: "Revelation", chapters: 22, short: ["rev", "revelations"] },
];

const BY_SLUG = new Map(PLAN_BOOKS.map((b) => [b.slug, b]));
export const bookOf = (slug: string): Book | undefined => BY_SLUG.get(slug);
/** The English name of a book for the screen ("1-samuel" gives "1 Samuel"). An unknown slug is shown as it is. */
export const bookName = (slug: string): string => BY_SLUG.get(slug)?.name ?? slug;

/** How a book name is compared: lower case, "I Samuel", "First Samuel" and "1st Samuel" all become "1 samuel", then no spaces, dots or hyphens. */
function nameKey(raw: string): string {
  const s = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(iii|3rd|third)(?=[\s.]|$)\.?\s*/, "3 ")
    .replace(/^(ii|2nd|second)(?=[\s.]|$)\.?\s*/, "2 ")
    .replace(/^(i|1st|first)(?=[\s.]|$)\.?\s*/, "1 ");
  return s.replace(/[\s.\-]+/g, "");
}

const NAMES = new Map<string, string>();
for (const b of PLAN_BOOKS) {
  for (const form of [b.name, b.slug, ...(b.short ?? [])]) {
    const key = nameKey(form);
    if (!NAMES.has(key)) NAMES.set(key, b.slug);
  }
}
/** The slug of a typed book name, or undefined. */
export const findBook = (typed: string): string | undefined => NAMES.get(nameKey(typed));

/** One problem found in pasted text. The screen words each `kind` from the language files; `line` is the line of the pasted text (counting empty lines). */
export type PlanProblem = {
  kind: "noDays" | "tooManyDays" | "emptyDay" | "dayNumber" | "tooManyReadings" | "noBook" | "unknownBook" | "noChapter" | "badChapter" | "badPart" | "range" | "verse";
  line?: number;
  /** The words as typed, for the sentence. */
  text?: string;
  book?: string;
  chapter?: number;
  max?: number;
  given?: number;
  expected?: number;
  count?: number;
};

// "Mark 3 (1/2)", "Mark 3 1/2", "Mark 3 part 1 of 2", "Mark 3 [1 of 2]": the part is the end of a reading.
const PART_AT_END = /\s*[([]?\s*(?:part\s*)?(\d+)\s*(?:\/|of)\s*(\d+)\s*[)\]]?\s*$/i;
const DAY_PREFIX = /^\s*day\s*(\d+)\s*[:.\-–—)]?\s*/i;
const READING_SEPARATORS = /\s*(?:;|,|\+|&|\band\b)\s*/i;

/** Takes spreadsheet and word-processor leftovers out of pasted text: a byte-order mark, no-break and zero-width spaces, CRLF. */
function tidy(text: string): string {
  return text.replace(/^﻿/, "").replace(/[​-‍⁠﻿]/g, "").replace(/ /g, " ").replace(/\r\n?/g, "\n");
}

/**
 * Reads pasted text into days. One day on each line; empty lines are skipped. A line may start with "Day 3" (it must then be the
 * line's own number, so a gap or a repeat is found, not guessed), and the readings follow, separated by ";" or "," or "+" or "and".
 * A line copied from a spreadsheet (day, tab, readings) works the same. Nothing is guessed: a line that is not clear is reported by its line number.
 */
export function parsePlan(input: string): { days: PlanReading[][]; problems: PlanProblem[] } {
  const days: PlanReading[][] = [];
  const problems: PlanProblem[] = [];
  const lines = tidy(input).split("\n");
  let header = true;
  lines.forEach((raw, index) => {
    const line = index + 1;
    if (!raw.trim()) return;
    let given: number | undefined;
    let body: string;
    if (raw.includes("\t")) {
      // A spreadsheet row: the first cell may be the day ("3" or "Day 3"); a first row that only says "Day" is the table's heading.
      const cells = raw.split("\t").map((c) => c.trim());
      if (header && /^day$/i.test(cells[0] ?? "")) {
        header = false;
        return;
      }
      const first = /^(?:day\s*)?(\d+)$/i.exec(cells[0] ?? "");
      if (first) given = Number(first[1]);
      body = (first ? cells.slice(1) : cells).filter(Boolean).join("; ");
    } else {
      const prefix = DAY_PREFIX.exec(raw);
      if (prefix) given = Number(prefix[1]);
      body = prefix ? raw.slice(prefix[0].length) : raw;
    }
    header = false;
    const expected = days.length + 1;
    if (given !== undefined && given !== expected) problems.push({ kind: "dayNumber", line, given, expected });
    const readings: PlanReading[] = [];
    const chunks = body.split(READING_SEPARATORS).map((c) => c.trim()).filter(Boolean);
    if (!chunks.length) problems.push({ kind: "emptyDay", line });
    for (const chunk of chunks) {
      const reading = readOne(chunk, line, problems);
      if (reading) readings.push(reading);
    }
    if (chunks.length > PLAN_MAX_READINGS) problems.push({ kind: "tooManyReadings", line, count: chunks.length, max: PLAN_MAX_READINGS });
    days.push(readings);
  });
  if (!days.length && !problems.length) problems.push({ kind: "noDays" });
  if (days.length > PLAN_MAX_DAYS) problems.push({ kind: "tooManyDays", count: days.length, max: PLAN_MAX_DAYS });
  return { days, problems };
}

function readOne(chunk: string, line: number, problems: PlanProblem[]): PlanReading | undefined {
  let rest = chunk;
  let part: [number, number] | undefined;
  const p = PART_AT_END.exec(rest);
  if (p) {
    const n = Number(p[1]);
    const m = Number(p[2]);
    rest = rest.slice(0, p.index).trim();
    if (!(n >= 1 && n <= m && m <= PLAN_MAX_PARTS)) {
      problems.push({ kind: "badPart", line, text: chunk });
      return undefined;
    }
    part = [n, m];
  }
  if (/\d\s*:\s*\d/.test(rest)) {
    problems.push({ kind: "verse", line, text: chunk });
    return undefined;
  }
  if (/\d\s*[-–—]\s*\d/.test(rest)) {
    problems.push({ kind: "range", line, text: chunk });
    return undefined;
  }
  if (/^\d+$/.test(rest)) {
    problems.push({ kind: "noBook", line, text: chunk });
    return undefined;
  }
  const m = /^(.*\D)\s*(\d+)$/.exec(rest);
  if (!m) {
    // A name with no chapter after it ("Psalms"), or text that is not a book at all.
    problems.push(findBook(rest) ? { kind: "noChapter", line, text: chunk, book: bookName(findBook(rest)!) } : { kind: "unknownBook", line, text: chunk });
    return undefined;
  }
  const slug = findBook(m[1]);
  if (!slug) {
    problems.push({ kind: "unknownBook", line, text: m[1].trim() });
    return undefined;
  }
  const chapter = Number(m[2]);
  const max = bookOf(slug)!.chapters;
  if (!(chapter >= 1 && chapter <= max)) {
    problems.push({ kind: "badChapter", line, book: bookName(slug), chapter, max });
    return undefined;
  }
  return { book: slug, chapter, ...(part ? { part } : {}) };
}

/** A reading as staff read it: "Mark 3", or "Mark 3 (1/2)" for a part of a chapter. */
export const formatReading = (r: PlanReading): string => `${bookName(r.book)} ${r.chapter}${r.part ? ` (${r.part[0]}/${r.part[1]})` : ""}`;

/** A day as the screen lists it: "Psalms 1; Mark 1". */
export const formatDay = (day: PlanReading[]): string => (Array.isArray(day) ? day : []).map(formatReading).join("; ");

/** A plan as text, one day on each line, the same text `parsePlan` reads back. */
export const formatPlan = (days: PlanReading[][]): string => days.map((day, i) => `Day ${i + 1}: ${formatDay(day)}`).join("\n");

/** Trims the title and drops a language left empty. */
export function cleanTitle(title: PlanInput["title"]): PlanInput["title"] {
  const out: PlanInput["title"] = {};
  for (const l of LANGUAGES) {
    const v = (title[l] ?? "").trim();
    if (v) out[l] = v;
  }
  return out;
}

/**
 * The problems with a plan, by field, as codes: `title`, `title.ml`, `days`, `days[3]`, `days[3][0].book`, `.chapter`, `.part`
 * (the places the server names in `400 PLAN_INVALID`, contract Part 4; the numbers count from 0).
 */
export function checkPlan(input: PlanInput): Detail[] {
  const problems: Detail[] = [];
  const title = cleanTitle(input.title);
  if (!Object.keys(title).length) problems.push({ field: "title", problem: "required" });
  for (const l of LANGUAGES) if ((title[l] ?? "").length > PLAN_TITLE_MAX) problems.push({ field: `title.${l}`, problem: "tooLong" });
  if (input.startDate && !isRealDate(input.startDate)) problems.push({ field: "startDate", problem: "invalid" });
  if (!input.days.length) problems.push({ field: "days", problem: "required" });
  else if (input.days.length > PLAN_MAX_DAYS) problems.push({ field: "days", problem: "tooMany" });
  input.days.forEach((day, i) => {
    if (!Array.isArray(day) || day.length < 1 || day.length > PLAN_MAX_READINGS) {
      problems.push({ field: `days[${i}]`, problem: "invalid" });
      return;
    }
    day.forEach((r, j) => {
      const at = `days[${i}][${j}]`;
      const book = bookOf(r?.book);
      if (!book) {
        problems.push({ field: `${at}.book`, problem: "invalid" });
        return;
      }
      if (!Number.isInteger(r.chapter) || r.chapter < 1 || r.chapter > book.chapters) problems.push({ field: `${at}.chapter`, problem: "invalid" });
      const part = r.part;
      if (part !== undefined && !(Array.isArray(part) && part.length === 2 && part.every(Number.isInteger) && part[0] >= 1 && part[0] <= part[1] && part[1] <= PLAN_MAX_PARTS))
        problems.push({ field: `${at}.part`, problem: "invalid" });
    });
  });
  return problems;
}

/** The day (counting from 1) a server problem such as `days[3][0].chapter` is about, or undefined. */
export function dayOfProblem(details: Detail[]): number | undefined {
  for (const d of details) {
    const m = /^days\[(\d+)\]/.exec(d.field);
    if (m) return Number(m[1]) + 1;
  }
  return undefined;
}

/** The same plan twice? (title and days, whatever the spelling in the pasted text was.) */
export const samePlan = (a: PlanInput, b: PlanInput): boolean => {
  const flat = (p: PlanInput) =>
    JSON.stringify([cleanTitle(p.title), p.days.map((d) => d.map((r) => [r.book, r.chapter, r.part?.[0] ?? 0, r.part?.[1] ?? 0])), p.startDate || null, !!p.repeats]);
  return flat(a) === flat(b);
};
