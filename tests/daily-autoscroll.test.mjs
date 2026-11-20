import test from "node:test";
import assert from "node:assert/strict";
import { pxPerSecond, nextSpeed, scrollStep, atEnd, SPEEDS, DEFAULT_SPEED, START_DELAY_MS, MOVE_KEYS } from "../src/daily/autoScroll.ts";

// The auto-scroll switch of the Daily Bible reader: the pace and the rules, apart from the browser.

test("the pace follows the text size and grows from slow to fast", () => {
  assert.ok(pxPerSecond(22, "slow") < pxPerSecond(22, "normal"));
  assert.ok(pxPerSecond(22, "normal") < pxPerSecond(22, "fast"));
  assert.ok(pxPerSecond(32, "slow") > pxPerSecond(18, "slow"), "bigger letters move faster, so a line stays on screen as long");
  // The slow pace is a readable one: about one 40 px line every 4 seconds at the usual size, never a crawl and never a rush.
  assert.ok(pxPerSecond(22, "slow") >= 8 && pxPerSecond(22, "slow") <= 12);
});

test("a size that is not a number falls back to the usual one", () => {
  for (const bad of [0, -5, NaN, Infinity * 0]) assert.equal(pxPerSecond(bad, "normal"), pxPerSecond(22, "normal"));
});

test("the speed button goes round: slow, normal, fast, slow", () => {
  assert.deepEqual(SPEEDS, ["slow", "normal", "fast"]);
  assert.equal(DEFAULT_SPEED, "slow");
  assert.equal(nextSpeed("slow"), "normal");
  assert.equal(nextSpeed("normal"), "fast");
  assert.equal(nextSpeed("fast"), "slow");
});

test("a slow pace still moves: fractions of a pixel are carried from frame to frame", () => {
  const perSecond = pxPerSecond(22, "slow"); // 9.9 px a second
  let carry = 0;
  let moved = 0;
  for (let i = 0; i < 60; i++) {
    const step = scrollStep(carry, 1000 / 60, perSecond);
    carry = step.carry;
    moved += step.whole;
    assert.ok(Number.isInteger(step.whole) && step.whole >= 0);
    assert.ok(carry >= 0 && carry < 1);
  }
  assert.ok(Math.abs(moved + carry - perSecond) < 0.001, `one second of frames moves ${perSecond} px, got ${moved + carry}`);
});

test("a very long frame (the tab was hidden) never makes the page jump", () => {
  const step = scrollStep(0, 60_000, 100);
  assert.equal(step.whole + step.carry, 10); // counted as 100 ms: 10 px at 100 px a second
  assert.equal(scrollStep(0.5, -50, 100).whole, 0, "time going backwards moves nothing");
});

test("the end of the page is found, with a pixel or two of rounding allowed", () => {
  assert.equal(atEnd(1000, 700, 1700), true);
  assert.equal(atEnd(998.5, 700, 1700), true);
  assert.equal(atEnd(900, 700, 1700), false);
  assert.equal(atEnd(0, 700, 600), true, "a page that fits the screen is already at its end");
});

test("the start waits two seconds, and the arrow, page and space keys count as taking over", () => {
  assert.equal(START_DELAY_MS, 2000);
  for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]) assert.ok(MOVE_KEYS.includes(key), key);
  assert.ok(!MOVE_KEYS.includes("Tab") && !MOVE_KEYS.includes("a"));
});
