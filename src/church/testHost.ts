// Which web address the site asks the server about. A real church site asks about its own address (window.location.hostname).
// A TEST site may be told another address with ?churchHost=... so one test site can show every sample church before real
// addresses exist. That is allowed only in a stub build, or in a build made with VITE_ALLOW_TEST_HOST=1. A real build is made without it.

/**
 * `main` is true when this address is the site itself and not a church: the main address (theblinkgrid.com), or a test site opened with no church named.
 * The site then shows the normal Daily Bible (the default settings) and asks the server nothing. Any other address that is not an active church
 * (unknown, draft, paused) still shows "Not available here".
 */
export type HostChoice = { host: string; remember: boolean; main: boolean };

/** The addresses that are the site itself, not a church. A build may add more with VITE_MAIN_HOSTS (comma separated). */
export const MAIN_HOSTS = ["theblinkgrid.com", "www.theblinkgrid.com"];

/** `mode` is VITE_CHURCH_RESOLVE; `allowTest` is true for the test switch; `remembered` is the address kept for this tab (so a reload keeps the same church). */
export function chooseHost(
  mode: string | undefined,
  allowTest: boolean,
  search: string,
  hostname: string,
  remembered: string | null,
  mainHosts: readonly string[] = MAIN_HOSTS,
  pathname = "",
): HostChoice | null {
  if (mode !== "api" && mode !== "stub") return null;
  const own = hostname.toLowerCase();
  const isMain = mainHosts.includes(own);
  if (mode === "api" && !allowTest) return { host: own, remember: false, main: isMain };
  // The staff area belongs to the site itself, never to a church: coming back to it from a church page must not keep that church's look.
  if (/^\/[a-z]{2}\/staff(\/|$)/i.test(pathname)) return { host: own, remember: false, main: true };
  const asked = new URLSearchParams(search).get("churchHost")?.trim().toLowerCase() || "";
  if (asked) return { host: asked, remember: true, main: false };
  // Stub builds never kept a choice; keep that. A test site on the real server keeps it for the tab.
  const kept = mode === "api" ? remembered : null;
  // A test site opened with no church named is the site itself: the normal Daily Bible.
  return { host: (kept || own).toLowerCase(), remember: false, main: !kept };
}

/** The link the staff screen shows for a church on a test site: this site's daily page, told which address to use. Null on a real site. */
export function testChurchLink(allowTest: boolean, lang: string, address: string | undefined): string | null {
  if (!allowTest || !address) return null;
  return `/${lang}/daily?churchHost=${encodeURIComponent(address.trim().toLowerCase())}`;
}
