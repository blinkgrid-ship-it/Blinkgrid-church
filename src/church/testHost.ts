// Which web address the site asks the server about. A real church site asks about its own address (window.location.hostname).
// A TEST site may be told another address with ?churchHost=... so one test site can show every sample church before real
// addresses exist. That is allowed only in a stub build, or in a build made with VITE_ALLOW_TEST_HOST=1. A real build is made without it.

export type HostChoice = { host: string; remember: boolean };

/** `mode` is VITE_CHURCH_RESOLVE; `allowTest` is true for the test switch; `remembered` is the address kept for this tab (so a reload keeps the same church). */
export function chooseHost(mode: string | undefined, allowTest: boolean, search: string, hostname: string, remembered: string | null): HostChoice | null {
  if (mode !== "api" && mode !== "stub") return null;
  if (mode === "api" && !allowTest) return { host: hostname.toLowerCase(), remember: false };
  const asked = new URLSearchParams(search).get("churchHost")?.trim().toLowerCase() || "";
  if (asked) return { host: asked, remember: true };
  // Stub builds never kept a choice; keep that. A test site on the real server keeps it for the tab.
  return { host: ((mode === "api" ? remembered : null) || hostname).toLowerCase(), remember: false };
}

/** The link the staff screen shows for a church on a test site: this site's daily page, told which address to use. Null on a real site. */
export function testChurchLink(allowTest: boolean, lang: string, address: string | undefined): string | null {
  if (!allowTest || !address) return null;
  return `/${lang}/daily?churchHost=${encodeURIComponent(address.trim().toLowerCase())}`;
}
