// The plan a reader chose, and the day it started, stay on this phone only (no login, nothing is sent anywhere).
const KEY = "blinkgrid-church.daily.plan.v1";

export type ChosenPlan = { planId: string; start: string };

const pad = (n: number) => String(n).padStart(2, "0");
/** Today as YYYY-MM-DD in the reader's own time zone. */
export const todayKey = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const parse = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Whole days from `start` to `today`, counting calendar days (0 on the first day). */
export function daysSince(start: string, today = todayKey()): number {
  return Math.round((parse(today).getTime() - parse(start).getTime()) / 86_400_000);
}

export function readChosen(): ChosenPlan | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ChosenPlan>;
    return v && typeof v.planId === "string" && typeof v.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.start) ? { planId: v.planId, start: v.start } : null;
  } catch {
    return null;
  }
}

export function saveChosen(value: ChosenPlan | null) {
  try {
    if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* a private window may refuse; the choice then lasts for this visit only */
  }
}
