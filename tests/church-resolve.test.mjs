import test from "node:test";
import assert from "node:assert/strict";
import { churchFromAnswer, resolveChurch, safeSettings, CONTRACT_VERSION } from "../src/church/resolve.ts";
import { DEFAULTS, churchName } from "../src/church/parse.ts";

// The church found by web address (contract file, Parts 2 and 7). Anything but a clear active church is the plain default page.
const answer = (over = {}) => ({
  contractVersion: CONTRACT_VERSION,
  church: {
    name: { en: "Sample Church", ml: "സാമ്പിൾ ചർച്ച്" },
    logoUrl: "https://files.example.org/logo.svg",
    colors: { accent: "#1f5f4a", accentDark: "#8fd3b8" },
    defaultLanguage: "ml",
    primaryAddress: "church.example.org",
    addresses: ["church.example.org", "www.church.example.org"],
    dailyText: { en: "bolls-kjv", ml: "bolls-mov" },
    plan: { id: "psalms", version: 1, title: { en: "A Psalm a day" }, days: [[{ book: "psalms", chapter: 1 }], [{ book: "psalms", chapter: 119, part: [1, 4] }]] },
    ...over,
  },
});
const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ask = (doFetch, ms = 200) => resolveChurch("/api/v1/church/resolve?host=church.example.org", "church.example.org", doFetch, ms);

test("an active church answer gives its name per language, logo, colours, language, texts and plan", () => {
  const r = churchFromAnswer(answer(), "church.example.org");
  assert.equal(r.kind, "church");
  assert.deepEqual(r.problems, []);
  assert.equal(r.settings.name, "സാമ്പിൾ ചർച്ച്"); // the name for its default language (ml)
  assert.equal(churchName(r.settings, "en"), "Sample Church");
  assert.equal(churchName(r.settings, "ml"), "സാമ്പിൾ ചർച്ച്");
  assert.equal(churchName(r.settings, "hi"), "സാമ്പിൾ ചർച്ച്"); // no Hindi name: the default-language name
  assert.equal(r.settings.logo, "https://files.example.org/logo.svg");
  assert.equal(r.settings.defaultLanguage, "ml");
  assert.equal(r.settings.address, "church.example.org");
  assert.equal(r.settings.dailyText.ml, "bolls-mov");
  assert.equal(r.settings.dailyText.hi, DEFAULTS.dailyText.hi); // a language the church did not name has no text of its own
  assert.equal(r.settings.plans.length, 1);
  assert.deepEqual(r.settings.plans[0].days[1], [{ book: "psalms", chapter: 119, part: [1, 4] }]);
});

test("the address is matched without caring for capitals; another address is the safe state", () => {
  assert.equal(churchFromAnswer(answer(), "WWW.Church.Example.org").kind, "church");
  assert.deepEqual(churchFromAnswer(answer(), "other.example.org"), { kind: "safe", reason: "wrong-address" });
});

test("a wrong contract number, a missing name, or a broken answer is the safe state", () => {
  assert.deepEqual(churchFromAnswer({ ...answer(), contractVersion: 2 }, "church.example.org"), { kind: "safe", reason: "wrong-version" });
  assert.deepEqual(churchFromAnswer({ church: answer().church }, "church.example.org"), { kind: "safe", reason: "broken-answer" });
  assert.deepEqual(churchFromAnswer(answer({ name: {} }), "church.example.org"), { kind: "safe", reason: "broken-answer" });
  assert.deepEqual(churchFromAnswer(answer({ name: { fr: "Église" } }), "church.example.org"), { kind: "safe", reason: "broken-answer" });
  assert.deepEqual(churchFromAnswer(answer({ addresses: [] }), "church.example.org"), { kind: "safe", reason: "broken-answer" });
  for (const bad of [null, "text", 5, [], {}]) assert.equal(churchFromAnswer(bad, "church.example.org").kind, "safe");
});

test("a broken part is not a broken church: a malformed colour and a bad plan are left out and the church stays", () => {
  const r = churchFromAnswer(answer({ colors: { accent: "yellow" }, plan: { id: "p", title: { en: "x" }, days: [[{ book: "psalms", chapter: 0 }]] } }), "church.example.org");
  assert.equal(r.kind, "church");
  assert.equal(r.settings.colors, undefined); // default colours
  assert.equal(r.settings.plans, undefined); // the starter plans
  assert.ok(r.problems.length >= 2);
  assert.equal(r.settings.name, "സാമ്പിൾ ചർച്ച്");
});

test("a logo that is not a picture file is left out", () => {
  const r = churchFromAnswer(answer({ logoUrl: "http://example.org/logo.svg" }), "church.example.org");
  assert.equal(r.kind, "church");
  assert.equal(r.settings.logo, undefined);
});

test("safe settings are the plain default page and each call gives its own copy", () => {
  const a = safeSettings();
  assert.equal(a.name, "Daily Bible");
  assert.equal(a.logo, undefined);
  assert.equal(a.colors, undefined);
  assert.equal(a.plans, undefined);
  a.dailyText.en = "changed";
  assert.equal(safeSettings().dailyText.en, DEFAULTS.dailyText.en);
});

test("resolve: 200 gives the church; 404 (unknown, draft, paused, archived) is not-found", async () => {
  assert.equal((await ask(reply(200, answer()))).kind, "church");
  assert.deepEqual(await ask(reply(404, { error: { code: "CHURCH_NOT_FOUND" } })), { kind: "safe", reason: "not-found" });
});

test("resolve: any 5xx, another failure, a network error, or an answer that is not JSON is the safe state", async () => {
  assert.deepEqual(await ask(reply(503, {})), { kind: "safe", reason: "server-error" });
  assert.deepEqual(await ask(reply(500, {})), { kind: "safe", reason: "server-error" });
  assert.deepEqual(await ask(reply(403, {})), { kind: "safe", reason: "broken-answer" });
  assert.deepEqual(await ask(async () => { throw new TypeError("network"); }), { kind: "safe", reason: "unreachable" });
  assert.deepEqual(await ask(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } })), { kind: "safe", reason: "broken-answer" });
});

test("resolve: no answer in time is the safe state, even when the request ignores the stop signal", async () => {
  const never = () => new Promise(() => {});
  const t0 = Date.now();
  assert.deepEqual(await ask(never, 150), { kind: "safe", reason: "timeout" });
  assert.ok(Date.now() - t0 < 1000);
  const slow = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: async () => answer() }), 600));
  assert.deepEqual(await ask(slow, 100), { kind: "safe", reason: "timeout" });
});
