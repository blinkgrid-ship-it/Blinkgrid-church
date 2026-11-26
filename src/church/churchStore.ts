// Finds this site's church by web address, once, before anything is drawn (contract Part 2). The ONLY file that knows whether the answer
// comes from the server or from test data, so it is the only one to change when the API is real.
//
// OFF by default: without VITE_CHURCH_RESOLVE the site runs on src/church/church.json exactly as before, makes no extra call,
// and originalscript.org itself never asks. Build values: "api" (ask the server) or "stub" (test data, src/church/stubChurches.ts;
// the address to look up can be set with ?churchHost=active.church.test on the test site).
import { apiBase } from "../api/live";
import { resolveChurch, safeSettings, TEST_RESOLVE_TIMEOUT_MS, type ChurchResult } from "./resolve";
import { setChurchSettings } from "./settings";
import { demoGiving } from "./demoGiving";
import { chooseHost, MAIN_HOSTS } from "./testHost";
import { addStandInCount, takeTurn, utcDay } from "./readerCount";

const MODE = import.meta.env.VITE_CHURCH_RESOLVE as string | undefined;
/** True when this address was looked up and is not an active church (unknown, inactive, or the church side is down): the site then shows only "Not available". */
export let churchUnavailable = false;

/** True only on a test site (built with VITE_ALLOW_TEST_HOST=1, or a stub build): it may be told which church to show with ?churchHost=. */
export const ALLOW_TEST_HOST = MODE === "stub" || import.meta.env.VITE_ALLOW_TEST_HOST === "1";
const REMEMBER_KEY = "blinkgrid-church.test-host";

const MAIN_HOSTS_ALL = [...MAIN_HOSTS, ...String(import.meta.env.VITE_MAIN_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)];

/** The address to look up, or null when this is not a church site at all or is the site itself (then the normal Daily Bible shows). */
export function churchLookupHost(): string | null {
  const choice = pickHost();
  return choice && !choice.main ? choice.host : null;
}

function pickHost() {
  let remembered: string | null = null;
  try {
    remembered = window.sessionStorage.getItem(REMEMBER_KEY);
  } catch {
    /* private window: the choice then lasts until the next reload */
  }
  const choice = chooseHost(MODE, ALLOW_TEST_HOST, window.location.search, window.location.hostname, remembered, MAIN_HOSTS_ALL, window.location.pathname);
  if (choice?.remember) {
    try {
      window.sessionStorage.setItem(REMEMBER_KEY, choice.host);
    } catch {
      /* same */
    }
  }
  return choice;
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
  const choice = pickHost();
  if (choice?.main) {
    // The site itself (the main address, or a test site with no church named): the normal Daily Bible, no church, nothing counted.
    setChurchSettings(safeSettings());
    churchUnavailable = false;
    countedHost = null;
    return null;
  }
  const host = choice?.host;
  if (!host) return null;
  const url = `${apiBase}/api/v1/church/resolve?host=${encodeURIComponent(host)}`;
  // Test site on the free server: wait for it to wake up (and say so on the blank page), instead of giving up after 4 seconds.
  const waitsForServer = MODE === "api" && ALLOW_TEST_HOST;
  const hint = waitsForServer
    ? window.setTimeout(() => {
        const root = document.getElementById("root");
        if (root && !root.childElementCount)
          root.innerHTML = '<p style="font:16px Inter,system-ui,sans-serif;color:#5c534a;text-align:center;margin:30vh 24px 0">Waking up the test server&hellip; this can take up to a minute on the free plan.</p>';
      }, 3000)
    : undefined;
  const result = await resolveChurch(
    url,
    host,
    MODE === "stub" ? async (u) => (await import("./stubChurches")).stubFetch(u) : (u, init) => fetch(u, init),
    waitsForServer ? TEST_RESOLVE_TIMEOUT_MS : undefined,
  );
  if (hint !== undefined) window.clearTimeout(hint);
  // No copy is kept between visits or addresses: a failed call is the plain OriginalScript page, never an old church (contract Part 7).
  // A test site shows SAMPLE giving details for a church that has none yet (the server has no field for them), so the Giving page can be seen.
  const withDemoGiving = ALLOW_TEST_HOST && result.kind === "church" && !result.settings.giving;
  setChurchSettings(result.kind === "church" ? (withDemoGiving ? { ...result.settings, giving: demoGiving() } : result.settings) : safeSettings());
  churchUnavailable = result.kind !== "church";
  countedHost = result.kind === "church" ? host : null;
  if (result.kind === "church" && result.problems.length) console.warn("church:", result.problems.join("; "));
  return result;
}
