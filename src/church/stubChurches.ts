// TEST DATA ONLY (contract file, "Test data"). These answers stand in for `GET /church/resolve?host=` until the server has it.
// Switched on only by a build with VITE_CHURCH_RESOLVE=stub (the test site); a normal build never uses this file.
// Everything here is labelled SAMPLE. The Bible codes are the open service's, so the Daily Bible can really be read on the test site.

type StubAnswer = { status: number; body?: unknown; delayMs?: number };

const active = {
  contractVersion: 1,
  church: {
    id: "00000000-0000-4000-8000-000000000001",
    name: { en: "Sample Church", ml: "സാമ്പിൾ ചർച്ച്" },
    logoUrl: "/church/logo.svg",
    colors: { accent: "#1f5f4a", accentDark: "#8fd3b8" },
    defaultLanguage: "ml",
    primaryAddress: "active.church.test",
    addresses: ["active.church.test"],
    dailyText: { en: "bolls-kjv", ml: "bolls-mov" },
    plan: {
      id: "sample-psalms",
      version: 1,
      title: { en: "A Psalm a day (SAMPLE)", ml: "ദിവസം ഒരു സങ്കീർത്തനം (SAMPLE)" },
      days: [[{ book: "psalms", chapter: 1 }], [{ book: "psalms", chapter: 23 }], [{ book: "psalms", chapter: 119, part: [1, 4] }]],
    },
  },
};

const STUBS: Record<string, StubAnswer> = {
  "active.church.test": { status: 200, body: active },
  "paused.church.test": { status: 404, body: { error: { code: "CHURCH_NOT_FOUND", message: "No church for this address" } } },
  "unknown.church.test": { status: 404, body: { error: { code: "CHURCH_NOT_FOUND", message: "No church for this address" } } },
  "broken.church.test": { status: 200, body: { ...active, contractVersion: 2 } },
  "slow.church.test": { status: 200, body: active, delayMs: 10_000 },
  "lowcontrast.church.test": {
    status: 200,
    body: {
      ...active,
      church: { ...active.church, primaryAddress: "lowcontrast.church.test", addresses: ["lowcontrast.church.test"], colors: { accent: "#ffee00" } },
    },
  },
  "server-error.church.test": { status: 503, body: { error: { code: "UNAVAILABLE", message: "Try later" } } },
};

/** What the server would answer for this address (a plain 404 for any address the list does not know). */
export function stubFetch(url: string): ReturnType<typeof fetch> {
  const host = new URL(url, "http://stub.invalid").searchParams.get("host") ?? "";
  const hit = STUBS[host.toLowerCase()] ?? { status: 404, body: { error: { code: "CHURCH_NOT_FOUND", message: "No church for this address" } } };
  const answer = () => new Response(JSON.stringify(hit.body ?? {}), { status: hit.status, headers: { "Content-Type": "application/json" } });
  return hit.delayMs ? new Promise((resolve) => setTimeout(() => resolve(answer()), hit.delayMs)) : Promise.resolve(answer());
}

export const STUB_HOSTS = Object.keys(STUBS);
