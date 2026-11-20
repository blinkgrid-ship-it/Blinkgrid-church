// How this visit began (Paul's brief, item 7): a reader who arrives from a reel, Google or WhatsApp has no earlier page of ours
// (no referrer from this site). Read once when the app starts and kept for the visit, so the study page they land on
// can offer "Read this daily". Nothing is sent anywhere.
const KEY = "blinkgrid-church.landing.v1";

export type Landing = { path: string; external: boolean };

function external(): boolean {
  try {
    return !document.referrer || new URL(document.referrer).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function start(): Landing {
  try {
    const kept = window.sessionStorage.getItem(KEY);
    if (kept) return JSON.parse(kept) as Landing;
    const first: Landing = { path: window.location.pathname, external: external() };
    window.sessionStorage.setItem(KEY, JSON.stringify(first));
    return first;
  } catch {
    return { path: window.location.pathname, external: external() };
  }
}

export const landing: Landing = typeof window === "undefined" ? { path: "", external: false } : start();

/** True on the very page a visit began on, when it began from outside this site. */
export const landedOutsideOn = (pathname: string) => landing.external && landing.path === pathname;
