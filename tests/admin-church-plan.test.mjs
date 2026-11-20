import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_BOOKS, findBook, parsePlan, formatPlan, formatDay, checkPlan, dayOfProblem, samePlan } from "../src/staff/churchPlanRules.ts";
import { CANON } from "../src/daily/universal.ts";
import { starterPlans } from "../src/daily/plans.ts";
import { ChurchApiError, missingForSwitchOn } from "../src/staff/churchEdits.ts";
import { createLocalChurchesStore, createApiChurchesStore, toPlan } from "../src/staff/churchesStore.ts";

// The reading plan of a church (T-159, contract Part 4): the paste-in reader, the plan rules, and both stores.
const kinds = (text) => parsePlan(text).problems.map((p) => `${p.kind}@${p.line ?? "-"}`);
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
let n = 0;
const store = (storage = memory()) => createLocalChurchesStore(storage, () => "2026-11-17T10:00:00.000Z", "Test staff", () => `id-${++n}`);
const fails = async (promise, code) => {
  await assert.rejects(promise, (e) => e instanceof ChurchApiError && e.code === code);
};
const title = { en: "Psalms and Mark" };
const days = [[{ book: "psalms", chapter: 1 }, { book: "mark", chapter: 1 }], [{ book: "psalms", chapter: 2 }, { book: "mark", chapter: 2, part: [1, 2] }]];
const newChurch = (s) => s.create({ name: { en: "Sample Church" }, colors: {}, defaultLanguage: "en", addresses: ["church.example.org"] });

test("the book table is the 66 books of the site, in its order, with 1189 chapters", () => {
  assert.deepEqual(PLAN_BOOKS.map((b) => b.slug), [...CANON]);
  assert.equal(PLAN_BOOKS.reduce((sum, b) => sum + b.chapters, 0), 1189);
  assert.equal(PLAN_BOOKS.find((b) => b.slug === "psalms").chapters, 150);
});

test("every name, slug and short form belongs to exactly one book", () => {
  for (const b of PLAN_BOOKS) for (const form of [b.name, b.slug, ...(b.short ?? [])]) assert.equal(findBook(form), b.slug, `${form} must give ${b.slug}`);
  assert.equal(findBook("I Samuel"), "1-samuel");
  assert.equal(findBook("First John"), "1-john");
  assert.equal(findBook("3rd John"), "3-john");
  assert.equal(findBook("SONG OF SOLOMON"), "song-of-songs");
  assert.equal(findBook("1 cor."), "1-corinthians");
  assert.equal(findBook("Ps"), "psalms");
  // a name is never guessed from its first letters
  assert.equal(findBook("Jo"), undefined);
  assert.equal(findBook("Jud"), undefined);
  assert.equal(findBook("Gene"), undefined);
});

test("one day on each line: with or without Day numbers, readings separated by ; , + & or and", () => {
  const read = parsePlan("Day 1: Psalms 1; Mark 1\nDay 2 - Psalms 2, Mark 2 (1/2)\n\nPsalm 3 + Mark 2 part 2 of 2\nJohn 1 and 1 John 1 & Ps 4\n");
  assert.deepEqual(read.problems, []);
  assert.equal(read.days.length, 4);
  assert.deepEqual(read.days[1], [{ book: "psalms", chapter: 2 }, { book: "mark", chapter: 2, part: [1, 2] }]);
  assert.deepEqual(read.days[2], [{ book: "psalms", chapter: 3 }, { book: "mark", chapter: 2, part: [2, 2] }]);
  assert.deepEqual(read.days[3].map((r) => `${r.book} ${r.chapter}`), ["john 1", "1-john 1", "psalms 4"]);
});

test("lines copied from a spreadsheet (day, tab, readings) work, and a heading row is skipped", () => {
  const read = parsePlan("Day\tReading\n1\tPsalms 1\tMark 1\n2\tPsalms 2; Mark 2\n﻿3 \tJohn 3");
  assert.deepEqual(read.problems, []);
  assert.deepEqual(read.days.map(formatDay), ["Psalms 1; Mark 1", "Psalms 2; Mark 2", "John 3"]);
  assert.deepEqual(parsePlan("Mark 1\r\nMark 2\r\n").days.length, 2);
});

test("every line it cannot read is named by its line number, nothing is guessed", () => {
  assert.deepEqual(kinds("Psalms 1\nPsalm 151\nPsalms\nPsalms 1/2\nGenesis 1-3\nPsalms 119:1\nNoah 3\n2"), [
    "badChapter@2",
    "noChapter@3",
    "noChapter@4",
    "range@5",
    "verse@6",
    "unknownBook@7",
    "noBook@8",
  ]);
  const found = parsePlan("Psalms 151").problems[0];
  assert.deepEqual({ book: found.book, chapter: found.chapter, max: found.max }, { book: "Psalms", chapter: 151, max: 150 });
  assert.deepEqual(kinds("Mark 1 (3/2)\nMark 1 (1/11)\nMark 1 (0/2)"), ["badPart@1", "badPart@2", "badPart@3"]);
  assert.deepEqual(kinds("Mark 0"), ["badChapter@1"]);
  assert.deepEqual(kinds("Day 1: Mark 1\nDay 3: Mark 2"), ["dayNumber@2"]);
  assert.deepEqual(kinds("Day 1:"), ["emptyDay@1"]);
  assert.deepEqual(kinds("Mark 1; Mark 2; Mark 3; Mark 4; Mark 5; Mark 6; Mark 7"), ["tooManyReadings@1"]);
  assert.deepEqual(kinds(""), ["noDays@-"]);
  assert.deepEqual(kinds("  \n \n"), ["noDays@-"]);
  assert.deepEqual(kinds(Array.from({ length: 367 }, () => "Mark 1").join("\n")), ["tooManyDays@-"]);
  assert.deepEqual(parsePlan(Array.from({ length: 366 }, () => "Mark 1").join("\n")).problems, []);
});

test("the three starter plans of the site go to text and come back the same", () => {
  assert.deepEqual(starterPlans.map((p) => p.days.length), [30, 150, 89]);
  for (const plan of starterPlans) {
    const text = formatPlan(plan.days);
    const again = parsePlan(text);
    assert.deepEqual(again.problems, [], plan.id);
    assert.deepEqual(again.days, plan.days, plan.id);
    assert.deepEqual(checkPlan({ title, days: plan.days }), [], plan.id);
  }
  assert.equal(formatPlan(starterPlans[0].days).split("\n")[0], "Day 1: Mark 1 (1/2)");
});

test("checkPlan names the places the server names (contract Part 4)", () => {
  assert.deepEqual(checkPlan({ title, days }), []);
  assert.deepEqual(checkPlan({ title: {}, days }), [{ field: "title", problem: "required" }]);
  assert.deepEqual(checkPlan({ title: { ml: "x".repeat(81) }, days }), [{ field: "title.ml", problem: "tooLong" }]);
  assert.deepEqual(checkPlan({ title, days: [] }), [{ field: "days", problem: "required" }]);
  assert.deepEqual(checkPlan({ title, days: Array.from({ length: 367 }, () => days[0]) }), [{ field: "days", problem: "tooMany" }]);
  const bad = checkPlan({ title, days: [days[0], [], [{ book: "narnia", chapter: 1 }], [{ book: "mark", chapter: 17 }], [{ book: "mark", chapter: 1, part: [2, 1] }]] });
  assert.deepEqual(bad.map((d) => d.field), ["days[1]", "days[2][0].book", "days[3][0].chapter", "days[4][0].part"]);
  assert.equal(dayOfProblem(bad), 2);
  assert.equal(dayOfProblem([{ field: "title", problem: "required" }]), undefined);
});

test("two plans are the same whatever the order of the keys or the spelling of the title", () => {
  const a = { title: { en: " X " }, days: [[{ chapter: 1, book: "mark", part: [1, 2] }]] };
  const b = { title: { en: "X" }, days: [[{ book: "mark", chapter: 1, part: [1, 2] }]] };
  assert.ok(samePlan(a, b));
  assert.equal(samePlan(a, { ...b, days: [[{ book: "mark", chapter: 1 }]] }), false);
});

test("browser stand-in: the first save makes the plan the church's plan, a later save replaces it", async () => {
  const s = store();
  const church = await newChurch(s);
  assert.equal(await s.plan(church), null);
  assert.deepEqual(missingForSwitchOn(church).includes("plan"), true);
  const first = await s.savePlan(church, { title, days }, null);
  assert.equal(first.church.activePlanId, first.plan.id);
  assert.equal(first.church.version, church.version + 1);
  assert.equal(first.plan.version, 1);
  assert.equal(missingForSwitchOn(first.church).includes("plan"), false);
  assert.equal((await s.get(church.id)).activePlanId, first.plan.id);
  assert.deepEqual((await s.plan(first.church)).days, days);

  const second = await s.savePlan(first.church, { title: { en: "Changed" }, days: [days[0]] }, first.plan);
  assert.equal(second.plan.id, first.plan.id); // replaced, not duplicated
  assert.equal(second.plan.version, 2);
  assert.equal(second.church.version, first.church.version); // the church row did not change
  assert.equal((await s.plan(second.church)).days.length, 1);
});

test("browser stand-in: refuses what the server refuses", async () => {
  const s = store();
  const church = await newChurch(s);
  await fails(s.savePlan(church, { title, days: [[{ book: "mark", chapter: 99 }]] }, null), "PLAN_INVALID");
  await assert.rejects(s.savePlan(church, { title, days: [[{ book: "mark", chapter: 99 }]] }, null), (e) => e.details[0].field === "days[0][0].chapter");
  await fails(s.savePlan(church, { title: {}, days }, null), "PLAN_INVALID");
  assert.equal(await s.plan(church), null); // a refused plan is not kept
  const saved = await s.savePlan(church, { title, days }, null);
  await fails(s.savePlan(saved.church, { title, days }, { ...saved.plan, version: 7 }), "CONFLICT_VERSION"); // someone saved first
  await fails(s.savePlan({ ...church, id: "nope" }, { title, days }, null), "CHURCH_NOT_FOUND");
  // a plan of another church is refused
  const other = await s.create({ name: { en: "Other" }, colors: {}, defaultLanguage: "en", addresses: ["other.example.org"] });
  await fails(s.savePlan(other, { title, days }, saved.plan), "FORBIDDEN");
});

test("server store: reads the plan, saves it with POST then assigns it, then replaces it with PUT", async () => {
  const seen = [];
  const plan = (version) => ({ id: "p1", churchId: "c1", title, days, version, updatedBy: "Staff", updatedAt: "2026-11-17T10:00:00Z" });
  const request = async (method, path, body) => {
    seen.push([method, path, body]);
    if (method === "GET" && path === "/admin/churches/c1/plans") return { items: [] };
    if (method === "POST" && path === "/admin/churches/c1/plans") return { plan: plan(1) };
    if (method === "PUT") return { plan: plan(2) };
    if (method === "PATCH") return { church: { id: "c1", version: 6, activePlanId: "p1" } };
    if (method === "GET" && path.endsWith("/texts")) return { items: [] };
    throw new Error(`unexpected ${method} ${path}`);
  };
  const s = createApiChurchesStore(request);
  const church = { id: "c1", version: 5, activePlanId: null, texts: {} };
  assert.equal(await s.plan(church), null);
  const first = await s.savePlan(church, { title: { en: " Psalms and Mark ", ml: "" }, days }, null);
  assert.equal(first.plan.id, "p1");
  assert.equal(first.church.activePlanId, "p1");
  const second = await s.savePlan(first.church, { title, days }, first.plan);
  assert.equal(second.plan.version, 2);
  assert.deepEqual(seen.map((x) => `${x[0]} ${x[1]}`), [
    "GET /admin/churches/c1/plans", // plan(): none yet
    "GET /admin/churches/c1/plans", // savePlan with no plan loaded looks for an unassigned one first
    "POST /admin/churches/c1/plans",
    "PATCH /admin/churches/c1",
    "GET /admin/churches/c1/texts",
    "PUT /admin/plans/p1",
  ]);
  assert.deepEqual(seen[2][2], { title: { en: "Psalms and Mark" }, days });
  assert.deepEqual(seen[3][2], { activePlanId: "p1", expectedVersion: 5 });
  assert.deepEqual(seen[5][2], { title, days, expectedVersion: 1 });
});

test("server store: a plan made earlier but never assigned is written again, not duplicated", async () => {
  const seen = [];
  const request = async (method, path, body) => {
    seen.push(`${method} ${path}`);
    if (method === "GET") return { items: [{ id: "p9", churchId: "c1", title, days, version: 3 }] };
    if (method === "PUT") return { plan: { id: "p9", churchId: "c1", title, days, version: 4 } };
    return { church: { id: "c1", version: 6, activePlanId: "p9" } };
  };
  const s = createApiChurchesStore(request);
  const church = { id: "c1", version: 5, activePlanId: null, texts: {} };
  assert.equal((await s.plan(church)).id, "p9");
  await s.savePlan(church, { title, days }, null);
  assert.ok(seen.includes("PUT /admin/plans/p9"));
  assert.equal(seen.some((x) => x.startsWith("POST")), false);
});

test("server store: the plan row is read as it is sent, what is not a plan is refused", async () => {
  assert.deepEqual(toPlan({ id: "p", version: 1, days: [[{ book: "mark", chapter: 1 }, { nope: 1 }], "x"] }).days, [[{ book: "mark", chapter: 1 }], []]);
  assert.throws(() => toPlan({ id: "p" }), (e) => e instanceof ChurchApiError && e.code === "UNAVAILABLE");
  assert.throws(() => toPlan(null), (e) => e instanceof ChurchApiError);
  const s = createApiChurchesStore(async () => {
    throw { status: 400, code: "PLAN_INVALID", details: [{ field: "days[3][0].chapter", problem: "invalid" }] };
  });
  await assert.rejects(s.savePlan({ id: "c1", version: 1, activePlanId: null, texts: {} }, { title, days }, { id: "p1", version: 1, days: [] }), (e) => e.code === "PLAN_INVALID" && dayOfProblem(e.details) === 4);
});
