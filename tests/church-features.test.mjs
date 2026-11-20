import test from "node:test";
import assert from "node:assert/strict";
import { churchPathRule, CHURCH_PAGES, CHURCH_HOME } from "../src/church/features.ts";

// What a church's site shows. Only the church's own pages are let through (no Donate page in November); every other address is blocked.

test("the church's own pages are shown", () => {
  for (const path of ["/daily", "/daily/read/john/3", "/settings", "/more"]) assert.equal(churchPathRule(path), "allow", path);
  assert.equal(CHURCH_HOME, "/daily");
  assert.ok(CHURCH_PAGES.includes("/daily") && !CHURCH_PAGES.includes("/donate"));
});

test("the home address goes to the Daily Bible", () => {
  assert.equal(churchPathRule("/"), "home");
  assert.equal(churchPathRule(""), "home");
  assert.equal(churchPathRule("//"), "home");
});

test("anything else, including the Donate page, is not shown on a church site", () => {
  for (const path of [
    "/books", "/read/genesis/1", "/read/nc/jubilees/1", "/study", "/study/depth/literal-en/abc", "/study/academic/literal-en/abc/timeline", "/verse/john/3/16",
    "/verse/john/3/16/rooms/2", "/ask/john/3/16", "/search", "/library", "/my-study", "/courses", "/courses/x/modules/y", "/pathway", "/credits", "/transcript",
    "/certificate", "/evaluation", "/videos", "/scholar", "/account", "/notifications", "/leaderboard", "/questions", "/institutions", "/datasets", "/sources",
    "/topic/mercy", "/named-gods", "/coming/other-scripts", "/coming-soon/donate", "/donate", "/terms", "/privacy", "/cookies", "/admin", "/admin/churches", "/booklet", "/join", "/batches", "/verify/123",
  ])
    assert.equal(churchPathRule(path), "block", path);
});

test("capital letters, repeated slashes and a trailing slash do not get past the rule", () => {
  assert.equal(churchPathRule("/BOOKS"), "block");
  assert.equal(churchPathRule("//books"), "block");
  assert.equal(churchPathRule("/read//genesis/1"), "block");
  assert.equal(churchPathRule("/Admin/"), "block");
  assert.equal(churchPathRule("/DAILY/"), "allow");
  assert.equal(churchPathRule("/daily//read/john/1"), "allow");
});

test("a page that only starts with the same letters is not let through", () => {
  for (const path of ["/dailybook", "/donated", "/settings-old", "/morestuff"]) assert.equal(churchPathRule(path), "block", path);
});
