// Finds this site's church by web address, once, before anything is drawn (contract Part 2). The ONLY file that knows whether the answer
// comes from the server or from test data, so it is the only one to change when the API is real.
//
// OFF by default: without VITE_CHURCH_RESOLVE the site runs on src/church/church.json exactly as before, makes no extra call,
// and originalscript.org itself never asks. Build values: "api" (ask the server) or "stub" (test data, src/church/stubChurches.ts;
// the address to look up can be set with ?churchHost=active.church.test on the test site).
import { apiBase } from "../api/live";
import { resolveChurch, safeSettings, type ChurchResult } from "./resolve";
import { setChurchSettings } from "./settings";
import { addStandInCount, takeTurn, utcDay } from "./readerCount";

const MODE = import.meta.env.VITE_CHURCH_RESOLVE as string | undefined;
/** True when this address was looked up and is not an active church (unknown, inactive, or the church side is down): the site then shows only "Not available". */
export let churchUnavailable = false;

export function churchLookupHost(): string | null {
  if (MODE !== "api" && MODE !== "stub") return null;
  const asked = MODE === "stub" ? new URLSearchParams(window.location.search).get("churchHost") : null;
  const host = (asked || window.location.hostname).toLowerCase();
  return host;
}

/** The address of the active church this visit belongs to. Null for OriginalScript itself, an unknown or inactive church, or the safe state: those are never counted. */
let countedHost: string | null = null;

/**
 * Counts this reader once today for the church (contract Part 8, T-167): one call, with the address only, per browser per day.
 * Nothing about the reader is sent or kept. Does nothing for OriginalScript itself or a church that did not load, and never throws or waits:
 * a failed count must not disturb the reading. In a "stub" build the count is kept in this browser, for the staff screen's stand-in.
 */
export function countReaderToday(): void {
  const host = countedHost;
  if (!host) return;
  // Reading the storage can throw (private window): takeTurn catches that.
  const storage = { getItem: (k: string) => window.localStorage.getItem(k), setItem: (k: string, v: string) => window.localStorage.setItem(k, v) };
  const day = utcDay();
  if (!takeTurn(storage, host, day)) return;
  if (MODE === "stub") {
    addStandInCount(storage, host, day);
    return;
  }
  try {
    void fetch(`${apiBase}/api/v1/church/reading-count`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host }), keepalive: true }).catch(() => {});
  } catch {
    /* the count is lost, the reading is not */
  }
}

/** Settles the church for this visit. Never throws and never leaves the site without settings. */
export async function initChurch(): Promise<ChurchResult | null> {
  const host = churchLookupHost();
  if (!host) return null;
  const url = `${apiBase}/api/v1/church/resolve?host=${encodeURIComponent(host)}`;
  const result = await resolveChurch(url, host, MODE === "stub" ? async (u) => (await import("./stubChurches")).stubFetch(u) : (u, init) => fetch(u, init));
  // No copy is kept between visits or addresses: a failed call is the plain OriginalScript page, never an old church (contract Part 7).
  setChurchSettings(result.kind === "church" ? result.settings : safeSettings());
  churchUnavailable = result.kind !== "church";
  countedHost = result.kind === "church" ? host : null;
  if (result.kind === "church" && result.problems.length) console.warn("church:", result.problems.join("; "));
  return result;
}
