// TEST DATA ONLY (contract file, "Test data"). These answers stand in for `GET /church/resolve?host=` until the server has it.
// Switched on only by a build with VITE_CHURCH_RESOLVE=stub (the test site); a normal build never uses this file.
// Everything here is labelled SAMPLE. The Bible codes are the open service's, so the Daily Bible can really be read on the test site.

// Where the test staff screen keeps the churches and plans made in this browser (the same keys as src/staff/churchesStore.ts).
const SAVED_CHURCHES_KEY = "blinkgrid-church.staff-churches-preview.v1";
const SAVED_PLANS_KEY = "blinkgrid-church.staff-church-plans-preview.v1";

import { planToday } from "./planToday.ts";

type StubAnswer ={ status: number; body?: unknown; delayMs?: number };

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

const NOT_FOUND: StubAnswer = { status: 404, body: { error: { code: "CHURCH_NOT_FOUND", message: "No church for this address" } } };

type SavedChurch = { id: string; timeZone?: string; name: Record<string, string>; colors: Record<string, string>; defaultLanguage: string; addresses: string[]; status: string; giving?: unknown; texts: Record<string, { editionCode: string }>; activePlanId: string | null };
type SavedPlan = { id: string; version: number; title: Record<string, string>; days: unknown[]; startDate?: string | null; repeats?: boolean };

/** A church made on the test staff screen (kept in this browser), answered the way the server would: only when it is active and has a plan. */
export function savedChurchAnswer(host: string, read: (key: string) => string | null, now: Date = new Date()): StubAnswer | null {
  try {
    const churches: SavedChurch[] = JSON.parse(read(SAVED_CHURCHES_KEY) ?? "[]");
    const plans: SavedPlan[] = JSON.parse(read(SAVED_PLANS_KEY) ?? "[]");
    const c = churches.find((x) => x.addresses.some((a) => a.toLowerCase() === host));
    if (!c) return null;
    const plan = plans.find((p) => p.id === c.activePlanId);
    if (c.status !== "active" || !plan) return NOT_FOUND;
    return {
      status: 200,
      body: {
        contractVersion: 1,
        church: {
          id: c.id,
          name: c.name,
          colors: c.colors,
          defaultLanguage: c.defaultLanguage,
          primaryAddress: c.addresses[0],
          addresses: c.addresses,
          dailyText: Object.fromEntries(Object.entries(c.texts).map(([lang, t]) => [lang, t.editionCode])),
          timeZone: c.timeZone || "UTC",
          ...(c.giving ? { giving: c.giving } : {}),
          // As the server does: a plan with a start date also says which day it is today in the church's time zone.
          plan: {
            id: plan.id,
            version: plan.version,
            title: plan.title,
            days: plan.days,
            startDate: plan.startDate || null,
            repeats: !!plan.repeats,
            ...(plan.startDate ? { today: planToday({ startDate: plan.startDate, repeats: !!plan.repeats, length: plan.days.length }, c.timeZone || "UTC", now) } : {}),
          },
        },
      },
    };
  } catch {
    return null;
  }
}

/** What the server would answer for this address (a plain 404 for any address the list does not know). */
export function stubFetch(url: string): ReturnType<typeof fetch> {
  const host = new URL(url, "http://stub.invalid").searchParams.get("host") ?? "";
  const key = host.toLowerCase();
  const hit = STUBS[key] ?? savedChurchAnswer(key, (k) => window.localStorage.getItem(k)) ?? { status: 404, body: { error: { code: "CHURCH_NOT_FOUND", message: "No church for this address" } } };
  const answer = () => new Response(JSON.stringify(hit.body ?? {}), { status: hit.status, headers: { "Content-Type": "application/json" } });
  return hit.delayMs ? new Promise((resolve) => setTimeout(() => resolve(answer()), hit.delayMs)) : Promise.resolve(answer());
}

export const STUB_HOSTS = Object.keys(STUBS);
