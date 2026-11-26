// What a church's site shows. No browser code here, so the rules are tested alone (tests/church-features.test.mjs).
//
// This is Blinkgrid's church site, a separate product from OriginalScript. It shows the church's Daily Bible (the church's text and plan),
// and the language and reading settings, and a Giving page (/give) that only SHOWS the church's own giving link and bank details.
// (Legal pages wait for Blinkgrid's own neutral text.) Any other address shows "Not available here". No link to OriginalScript,
// no Donate page and no payment code: no money goes through us.
//
// One list for every church. Choosing features church by church would be a setting on the church screen later.

export type PathRule = "allow" | "home" | "block";

/** A church site opens on its Daily Bible. */
export const CHURCH_HOME = "/daily";

/** The pages of a church site, by the start of their address (without the language). */
export const CHURCH_PAGES = ["/daily", "/settings", "/more", "/give"] as const;

/** What a church site does with an address (the part after the language): show it, send it to its home, or say "Not available here". */
export function churchPathRule(pathname: string): PathRule {
  const path = ("/" + pathname.toLowerCase().replace(/\/{2,}/g, "/")).replace(/^\/{2,}/, "/").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  return CHURCH_PAGES.some((p) => path === p || path.startsWith(p + "/")) ? "allow" : "block";
}
