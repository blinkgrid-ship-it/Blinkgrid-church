import test from "node:test";
import assert from "node:assert/strict";
import { takeTurn, forgetThisPage, utcDay, addStandInCount, standInCounts, lastDays, fillDays, totalOf } from "../src/church/readerCount.ts";

// The reader count of a church (T-167, contract Part 8): once per browser per day on the site, and the days list on the staff screen.
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), m };
};
const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };

test("a browser is counted once for an address on a day, and again the next day", () => {
  forgetThisPage();
  const s = memory();
  assert.equal(takeTurn(s, "church.example.org", "2026-11-21"), true);
  assert.equal(takeTurn(s, "church.example.org", "2026-11-21"), false);
  forgetThisPage(); // the site was opened again the same day: the phone remembers
  assert.equal(takeTurn(s, "church.example.org", "2026-11-21"), false);
  assert.equal(takeTurn(s, "church.example.org", "2026-11-22"), true);
  assert.equal(takeTurn(s, "other.example.org", "2026-11-22"), true); // another address is its own count
  forgetThisPage();
  assert.equal(takeTurn(s, "church.example.org", "2026-11-22"), false);
  assert.equal(takeTurn(s, "other.example.org", "2026-11-22"), false);
});

test("without storage (private window) a browser is still counted once while the site stays open", () => {
  forgetThisPage();
  assert.equal(takeTurn(broken, "church.example.org", "2026-11-21"), true);
  assert.equal(takeTurn(broken, "church.example.org", "2026-11-21"), false);
  forgetThisPage();
  const s = memory();
  s.setItem("blinkgrid-church.church.counted.v1", "not json");
  assert.equal(takeTurn(s, "church.example.org", "2026-11-21"), true); // a damaged note is not a reason to lose the count
  forgetThisPage();
  assert.equal(takeTurn(s, "church.example.org", "2026-11-21"), false);
});

test("nothing about the reader is kept: only an address and a day", () => {
  forgetThisPage();
  const s = memory();
  takeTurn(s, "church.example.org", "2026-11-21");
  assert.deepEqual(JSON.parse(s.getItem("blinkgrid-church.church.counted.v1")), { "church.example.org": "2026-11-21" });
});

test("the UTC day is the same everywhere", () => {
  assert.equal(utcDay(new Date("2026-11-21T23:30:00Z")), "2026-11-21");
  assert.equal(utcDay(new Date("2026-11-22T00:00:00Z")), "2026-11-22");
});

test("the last days: oldest first, today last, month ends handled", () => {
  assert.deepEqual(lastDays(3, "2026-11-21"), ["2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.deepEqual(lastDays(3, "2026-12-01"), ["2026-11-29", "2026-11-30", "2026-12-01"]);
  assert.equal(lastDays(30, "2026-11-21").length, 30);
  assert.equal(lastDays(30, "2026-11-21")[0], "2026-10-23");
});

test("days with no row show 0, newest first; rows that are not usable are left out", () => {
  const days = lastDays(3, "2026-11-21");
  assert.deepEqual(fillDays([{ date: "2026-11-20", count: 14 }], days), [
    { date: "2026-11-21", count: 0 },
    { date: "2026-11-20", count: 14 },
    { date: "2026-11-19", count: 0 },
  ]);
  const messy = [{ date: "2026-11-21", count: 2 }, { date: "2026-11-21", count: 3 }, { date: "2026-11-01", count: 9 }, { date: "2026-11-20", count: -1 }, { date: "2026-11-20", count: 1.5 }, { date: "2026-11-19", count: "7" }, null, "x"];
  assert.deepEqual(fillDays(messy, days).map((r) => r.count), [5, 0, 0]);
  assert.deepEqual(fillDays(undefined, days).map((r) => r.count), [0, 0, 0]);
  assert.equal(totalOf(fillDays(messy, days)), 5);
});

test("the stand-in adds the counts of all of a church's addresses, for the days asked", () => {
  const s = memory();
  addStandInCount(s, "church.example.org", "2026-11-20");
  addStandInCount(s, "church.example.org", "2026-11-20");
  addStandInCount(s, "www.church.example.org", "2026-11-20");
  addStandInCount(s, "church.example.org", "2026-11-21");
  addStandInCount(s, "other.example.org", "2026-11-21");
  const days = lastDays(2, "2026-11-21");
  assert.deepEqual(standInCounts(s, ["church.example.org", "www.church.example.org"], days), [{ date: "2026-11-20", count: 3 }, { date: "2026-11-21", count: 1 }]);
  assert.deepEqual(standInCounts(s, ["nobody.example.org"], days), []);
  assert.deepEqual(standInCounts(memory(), ["church.example.org"], days), []);
});
