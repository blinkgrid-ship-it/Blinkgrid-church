import test from "node:test";
import assert from "node:assert/strict";
import { planToday } from "../src/church/planToday.ts";
import { parseSchedule } from "../src/church/parse.ts";
import { churchFromAnswer, CONTRACT_VERSION } from "../src/church/resolve.ts";
import { savedChurchAnswer } from "../src/church/stubChurches.ts";
import { checkInput, cleanInput } from "../src/staff/churchEdits.ts";

// A plan with a start date: the whole church reads the same day, and the day changes at the church's own midnight.
const plan = { startDate: "2026-12-01", repeats: false, length: 3 };
const at = (iso, zone, p = plan) => planToday(p, zone, new Date(iso));

test("before the start there is no day; then day 1, 2, 3; after the last day none", () => {
  assert.equal(at("2026-11-30T12:00:00Z", "UTC").dayNumber, null);
  assert.equal(at("2026-12-01T12:00:00Z", "UTC").dayNumber, 1);
  assert.equal(at("2026-12-02T12:00:00Z", "UTC").dayNumber, 2);
  assert.equal(at("2026-12-03T12:00:00Z", "UTC").dayNumber, 3);
  assert.equal(at("2026-12-04T12:00:00Z", "UTC").dayNumber, null);
});
test("a plan that repeats begins again after its last day", () => {
  const r = { ...plan, repeats: true };
  assert.equal(at("2026-12-04T12:00:00Z", "UTC", r).dayNumber, 1);
  assert.equal(at("2026-12-06T12:00:00Z", "UTC", r).dayNumber, 3);
  assert.equal(at("2026-12-07T12:00:00Z", "UTC", r).dayNumber, 1);
});
test("the day changes at the church's midnight, not at midnight in UTC", () => {
  // 20:00 UTC on 30 Nov is already 01:30 on 1 Dec in India.
  assert.equal(at("2026-11-30T20:00:00Z", "Asia/Kolkata").dayNumber, 1);
  assert.equal(at("2026-11-30T20:00:00Z", "UTC").dayNumber, null);
  assert.equal(at("2026-11-30T20:00:00Z", "Asia/Kolkata").date, "2026-12-01");
});

test("a schedule is read when it is complete and the day is inside the plan, else it is left out", () => {
  const good = { startDate: "2026-12-01", repeats: false, today: { date: "2026-12-02", dayNumber: 2 } };
  assert.deepEqual(parseSchedule(good, 3), good);
  assert.deepEqual(parseSchedule({ ...good, today: { date: "2026-11-30", dayNumber: null } }, 3)?.today.dayNumber, null);
  assert.equal(parseSchedule({ ...good, today: { date: "2026-12-02", dayNumber: 4 } }, 3), undefined); // day 4 of 3
  assert.equal(parseSchedule({ ...good, startDate: "tomorrow" }, 3), undefined);
  assert.equal(parseSchedule({ ...good, repeats: "yes" }, 3), undefined);
  assert.equal(parseSchedule(undefined, 3), undefined);
});

const answer = (p) => ({
  contractVersion: CONTRACT_VERSION,
  church: { name: { en: "Grace" }, primaryAddress: "grace.example.org", addresses: ["grace.example.org"], defaultLanguage: "en", dailyText: { en: "bolls-kjv" }, plan: { id: "p1", title: { en: "Psalms" }, days: [[{ book: "psalms", chapter: 1 }], [{ book: "psalms", chapter: 23 }]], ...p } },
});
test("the server's start date, repeat flag and today reach the plan the site shows", () => {
  const r = churchFromAnswer(answer({ startDate: "2026-12-01", repeats: true, today: { date: "2026-12-02", dayNumber: 2, readings: [] } }), "grace.example.org");
  assert.equal(r.kind, "church");
  assert.deepEqual(r.settings.plans[0].schedule, { startDate: "2026-12-01", repeats: true, today: { date: "2026-12-02", dayNumber: 2 } });
});
test("a plan without a start date has no schedule (each reader starts on their own day, as before)", () => {
  const r = churchFromAnswer(answer({ startDate: null, repeats: false }), "grace.example.org");
  assert.equal(r.settings.plans[0].schedule, undefined);
  assert.deepEqual(r.problems, []);
});
test("a wrong schedule does not break the church: the plan stays, without a start date, and the problem is named", () => {
  const r = churchFromAnswer(answer({ startDate: "2026-12-01", repeats: false, today: { date: "2026-12-02", dayNumber: 9 } }), "grace.example.org");
  assert.equal(r.kind, "church");
  assert.equal(r.settings.plans[0].schedule, undefined);
  assert.equal(r.problems.length, 1);
});

test("the test site's stand-in lookup answers like the server for a plan with a start date", () => {
  const churches = JSON.stringify([{ id: "c1", name: { en: "My Church" }, colors: {}, defaultLanguage: "en", timeZone: "Asia/Kolkata", addresses: ["my.example.org"], status: "active", texts: {}, activePlanId: "p1" }]);
  const plans = JSON.stringify([{ id: "p1", version: 1, title: { en: "P" }, days: [[{ book: "psalms", chapter: 1 }], [{ book: "psalms", chapter: 2 }]], startDate: "2026-12-01", repeats: false }]);
  const read = (k) => (k.includes("plans") ? plans : churches);
  const a = savedChurchAnswer("my.example.org", read, new Date("2026-11-30T20:00:00Z"));
  assert.equal(a.body.church.timeZone, "Asia/Kolkata");
  assert.deepEqual(a.body.church.plan.today, { date: "2026-12-01", dayNumber: 1 });
  // and the site reads that answer into a schedule
  assert.equal(churchFromAnswer(a.body, "my.example.org").settings.plans[0].schedule.today.dayNumber, 1);
});

test("a church's time zone is checked and kept; none given is left to the server", () => {
  const base = { name: { en: "A" }, colors: {}, defaultLanguage: "en", addresses: ["a.example.org"] };
  assert.deepEqual(checkInput({ ...base, timeZone: "Asia/Kolkata" }), []);
  assert.deepEqual(checkInput({ ...base, timeZone: "UTC" }), []);
  assert.deepEqual(checkInput(base), []);
  assert.deepEqual(checkInput({ ...base, timeZone: "Kerala time" }).map((d) => d.field), ["timeZone"]);
  assert.deepEqual(checkInput({ ...base, timeZone: "" }).map((d) => d.field), ["timeZone"]);
  assert.equal(cleanInput({ ...base, timeZone: " Asia/Kolkata " }).timeZone, "Asia/Kolkata");
  assert.equal("timeZone" in cleanInput(base), false);
});
