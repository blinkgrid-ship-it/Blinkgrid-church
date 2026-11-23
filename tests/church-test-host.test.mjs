import test from "node:test";
import assert from "node:assert/strict";
import { chooseHost, testChurchLink } from "../src/church/testHost.ts";

// The test switch: ?churchHost= works only on a test site, never on a real church site.
test("a real api build ignores ?churchHost and uses its own address", () => {
  assert.deepEqual(chooseHost("api", false, "?churchHost=other.org", "Grace.Church.org", "remembered.org"), { host: "grace.church.org", remember: false });
});
test("a test api build uses ?churchHost and remembers it", () => {
  assert.deepEqual(chooseHost("api", true, "?churchHost=Sample.Test", "site.onrender.com", null), { host: "sample.test", remember: true });
});
test("a test api build keeps the remembered church after a reload, and falls back to its own address", () => {
  assert.deepEqual(chooseHost("api", true, "", "site.onrender.com", "sample.test"), { host: "sample.test", remember: false });
  assert.deepEqual(chooseHost("api", true, "", "site.onrender.com", null), { host: "site.onrender.com", remember: false });
});
test("a stub build and a build with no mode behave as before", () => {
  assert.deepEqual(chooseHost("stub", true, "?churchHost=active.church.test", "localhost", "x"), { host: "active.church.test", remember: true });
  assert.equal(chooseHost(undefined, false, "?churchHost=a.test", "localhost", null), null);
});
test("the open-page link exists only on a test site, for a church with an address", () => {
  assert.equal(testChurchLink(false, "en", "a.test"), null);
  assert.equal(testChurchLink(true, "en", undefined), null);
  assert.equal(testChurchLink(true, "ml", " Sample.Test "), "/ml/daily?churchHost=sample.test");
});

// A church made on the test staff screen answers a lookup like the server: active with a plan only.
import { savedChurchAnswer } from "../src/church/stubChurches.ts";
const saved = (status, activePlanId) =>
  JSON.stringify([{ id: "c1", name: { en: "My Church" }, colors: { accent: "#1f5f4a" }, defaultLanguage: "en", addresses: ["My.Church.example.org"], status, texts: { en: { editionCode: "bolls-kjv" } }, activePlanId }]);
const plans = JSON.stringify([{ id: "p1", version: 2, title: { en: "Psalms" }, days: [[{ book: "psalms", chapter: 1 }]] }]);
const reader = (churches) => (k) => (k.includes("plans") ? plans : churches);
test("a saved active church with a plan answers like the server", () => {
  const a = savedChurchAnswer("my.church.example.org", reader(saved("active", "p1")));
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.church.dailyText, { en: "bolls-kjv" });
  assert.equal(a.body.church.plan.days.length, 1);
});
test("a saved church that is not active, or has no plan, is a plain 404; an unsaved address is unknown", () => {
  assert.equal(savedChurchAnswer("my.church.example.org", reader(saved("draft", "p1"))).status, 404);
  assert.equal(savedChurchAnswer("my.church.example.org", reader(saved("active", null))).status, 404);
  assert.equal(savedChurchAnswer("other.org", reader(saved("active", "p1"))), null);
});
