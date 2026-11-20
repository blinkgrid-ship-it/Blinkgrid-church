import test from "node:test";
import assert from "node:assert/strict";
import { starterPlans as plans, readingPath } from "../src/daily/plans.ts";
import { daysSince, todayKey } from "../src/daily/planStore.ts";

// The three starter plans (Paul's brief, item 5): the day counts and the order are fixed, and a part is never half of nothing.
const plan = (id) => plans.find((p) => p.id === id);

test("Mark in 30 days: 16 chapters over 30 days, 2 and 16 whole and the rest in two parts, in order", () => {
  const days = plan("mark30").days;
  assert.equal(days.length, 30);
  assert.deepEqual(days.slice(0, 4).map((d) => readingPath(d[0])), ["/daily/read/mark/1?part=1of2", "/daily/read/mark/1?part=2of2", "/daily/read/mark/2", "/daily/read/mark/3?part=1of2"]);
  assert.equal(readingPath(days[29][0]), "/daily/read/mark/16");
  const chapters = new Set(days.map((d) => d[0].chapter));
  assert.equal(chapters.size, 16);
});

test("Psalms and Proverbs: 150 days, a Psalm and a Proverb each day, Proverbs starting again after 31", () => {
  const days = plan("psalmsProverbs").days;
  assert.equal(days.length, 150);
  assert.deepEqual(days[0].map((r) => `${r.book} ${r.chapter}`), ["psalms 1", "proverbs 1"]);
  assert.equal(days[30][1].chapter, 31);
  assert.equal(days[31][1].chapter, 1);
  assert.equal(days[149][0].chapter, 150);
});

test("One Gospel chapter with a Psalm: 89 days, Matthew then Mark, Luke and John, with Psalms 1 to 89", () => {
  const days = plan("gospelPsalm").days;
  assert.equal(days.length, 89);
  assert.deepEqual(days[0].map((r) => `${r.book} ${r.chapter}`), ["matthew 1", "psalms 1"]);
  assert.deepEqual(days[28].map((r) => `${r.book} ${r.chapter}`), ["mark 1", "psalms 29"]);
  assert.deepEqual(days[88].map((r) => `${r.book} ${r.chapter}`), ["john 21", "psalms 89"]);
});

test("every plan has an id, a title key and only chapters from 1 up", () => {
  assert.equal(plans.length, 3);
  for (const p of plans) {
    assert.ok(p.id && p.title.startsWith("daily:"));
    for (const day of p.days) for (const r of day) assert.ok(r.chapter >= 1 && r.book);
  }
  assert.equal(plan("nothing"), undefined);
});

test("days since the start count calendar days, from 0 on the first day", () => {
  assert.equal(daysSince("2026-11-11", "2026-11-11"), 0);
  assert.equal(daysSince("2026-11-11", "2026-11-12"), 1);
  assert.equal(daysSince("2026-10-31", "2026-11-02"), 2);
  assert.equal(daysSince("2026-03-28", "2026-03-30"), 2);
  assert.match(todayKey(new Date(2026, 10, 5)), /^2026-11-05$/);
});
