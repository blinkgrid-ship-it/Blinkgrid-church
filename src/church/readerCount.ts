// The reader count of a church (docs/contracts/CHURCH-SETUP-contract.md, Part 8, T-167): how many people opened the church's reading each day.
// A number only: no names, no phone numbers, no sign-in. This file has no browser code (the browser's storage is passed in), so it is tested alone
// (tests/church-reader-count.test.mjs). Two sides use it:
//   * the site: `takeTurn` says whether THIS browser has already been counted for this address today (once per browser per day);
//   * the staff screen: `lastDays` / `fillDays` make the list of days to show, and the browser stand-in keeps counts until the server has the calls.

export type ReaderDay = { date: string; count: number };
type Memory = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const COUNTED = "blinkgrid-church.church.counted.v1";
const STAND_IN = "blinkgrid-church.church-readers-preview.v1";
/** Dates are UTC days ("2026-11-21"), the same day for every reader and every staff member (contract Part 8). */
export const utcDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

const thisPage = new Set<string>();

/**
 * True the first time this browser is asked about this address on this day, then false until the day changes. The day is written down
 * BEFORE the count is sent, so one browser makes one try a day (a count lost to a failed call is better than a failing server called on every
 * page). Without storage (a private window) it still counts once for each time the site is opened.
 */
export function takeTurn(storage: Memory, host: string, day: string): boolean {
  const key = `${host}|${day}`;
  if (thisPage.has(key)) return false;
  thisPage.add(key);
  // A damaged or unreadable note counts as "not counted today" and is written again.
  let seen: Record<string, string> = {};
  try {
    const parsed = JSON.parse(storage.getItem(COUNTED) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) seen = parsed;
  } catch {
    /* no note, or a damaged one */
  }
  if (seen[host] === day) return false;
  try {
    storage.setItem(COUNTED, JSON.stringify({ ...seen, [host]: day }));
  } catch {
    /* no storage: counted once for this page */
  }
  return true;
}

/** For tests: forget this page's memory. */
export function forgetThisPage() {
  thisPage.clear();
}

type StandIn = Record<string, Record<string, number>>;
const readStandIn = (storage: Memory): StandIn => {
  try {
    const parsed = JSON.parse(storage.getItem(STAND_IN) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** The browser stand-in of `POST /church/reading-count`: adds one to this address's count for the day, in this browser only. */
export function addStandInCount(storage: Memory, host: string, day: string) {
  const all = readStandIn(storage);
  const mine = { ...(all[host] ?? {}) };
  mine[day] = (Number.isInteger(mine[day]) ? mine[day] : 0) + 1;
  try {
    storage.setItem(STAND_IN, JSON.stringify({ ...all, [host]: mine }));
  } catch {
    /* kept for this visit only */
  }
}

/** The browser stand-in of `GET /admin/churches/{id}/readers`: the counts of all the church's addresses added together, for the given days. */
export function standInCounts(storage: Memory, addresses: string[], days: string[]): ReaderDay[] {
  const all = readStandIn(storage);
  const out: ReaderDay[] = [];
  for (const date of days) {
    const count = addresses.reduce((sum, a) => sum + (Number.isInteger(all[a.toLowerCase()]?.[date]) ? all[a.toLowerCase()][date] : 0), 0);
    if (count > 0) out.push({ date, count });
  }
  return out;
}

/** The last `n` UTC days up to and including `today`, oldest first. */
export function lastDays(n: number, today: string): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
}

/**
 * One row for every day asked for, newest first. A day the server sent no row for had no readers (contract Part 8: one row per day WITH a count),
 * so it is shown as 0. A row the screen cannot use (not a date in the asked range, a count that is not a whole number of 0 or more) is left out.
 */
export function fillDays(items: unknown, days: string[]): ReaderDay[] {
  const counts = new Map<string, number>();
  if (Array.isArray(items))
    for (const row of items) {
      const { date, count } = (row ?? {}) as Partial<ReaderDay>;
      if (typeof date === "string" && days.includes(date) && typeof count === "number" && Number.isInteger(count) && count >= 0) counts.set(date, (counts.get(date) ?? 0) + count);
    }
  return [...days].reverse().map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export const totalOf = (rows: ReaderDay[]): number => rows.reduce((sum, r) => sum + r.count, 0);
