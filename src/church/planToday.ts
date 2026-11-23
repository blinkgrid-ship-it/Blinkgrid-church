// Which day of a plan it is today, in the church's own time zone: the same rule the server uses (originalscript-backend, churchRules.planToday).
// The real site never calls this: the server sends the answer. It is here for the test site's stand-in lookup, so a plan with a start date can be
// tried without a server, and for the tests that keep the two in step.

/** Today's date (yyyy-mm-dd) as it is on the clock of `timeZone`. An unknown zone counts as UTC. */
export function localDate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const dayNumberOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000);

/** Day 1 is startDate. Before it, and after the last day of a plan that does not repeat, there is no day (dayNumber null). */
export function planToday(plan: { startDate: string; repeats: boolean; length: number }, timeZone: string, now: Date = new Date()): { date: string; dayNumber: number | null } {
  const date = localDate(now, timeZone);
  const elapsed = dayNumberOf(date) - dayNumberOf(plan.startDate);
  if (elapsed < 0) return { date, dayNumber: null };
  if (elapsed < plan.length) return { date, dayNumber: elapsed + 1 };
  return { date, dayNumber: plan.repeats ? (elapsed % plan.length) + 1 : null };
}
