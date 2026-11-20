import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULTS, contrast, parseChurchSettings } from "../src/church/parse.ts";

// The one settings file for a church copy (Paul's brief, item 8). A wrong part is ignored and named; the site never breaks.
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

test("the shipped file is the plain default church and has no problems", () => {
  const { settings, problems } = parseChurchSettings(read("src/church/church.json"));
  assert.deepEqual(problems, []);
  assert.equal(settings.name, "Daily Bible");
  assert.equal(settings.logo, undefined);
  assert.equal(settings.plans, undefined);
  assert.deepEqual(settings.dailyText, DEFAULTS.dailyText);
});

test("the sample church file is accepted: name, logo, colours, language, texts and its own plan", () => {
  const { settings, problems } = parseChurchSettings(read("src/church/church.sample.json"));
  assert.deepEqual(problems, []);
  assert.equal(settings.name, "Sample Church");
  assert.equal(settings.address, "church.example.org");
  assert.equal(settings.logo, "/church/logo.svg");
  assert.equal(settings.defaultLanguage, "ml");
  assert.equal(settings.dailyText.ml, "sample-church-ml");
  assert.equal(settings.dailyText.hi, DEFAULTS.dailyText.hi);
  assert.equal(settings.colors.accent, "#1f5f4a");
  assert.equal(settings.plans.length, 1);
  assert.deepEqual(settings.plans[0].days[2][0], { book: "psalms", chapter: 119, part: [1, 4] });
});

test("anything that is not a settings file gives the defaults and never throws", () => {
  for (const junk of [null, undefined, 5, "text", [], [1, 2]]) {
    const { settings, problems } = parseChurchSettings(junk);
    assert.equal(settings.name, "Daily Bible");
    assert.ok(problems.length > 0);
  }
});

test("a colour that cannot carry readable button text is refused and named", () => {
  const { settings, problems } = parseChurchSettings({ name: "X", colors: { accent: "#ffee00", accentDark: "#101010" } });
  assert.equal(settings.colors, undefined);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /colors\.accent/);
  assert.match(problems[1], /colors\.accentDark/);
  assert.ok(contrast("#895031", "#ffffff") >= 4.5);
  assert.ok(contrast("#ffffff", "#ffffff") < 1.1);
});

test("a bad logo, language, text or plan is ignored one by one while the good parts stay", () => {
  const { settings, problems } = parseChurchSettings({
    name: "Good Church", logo: "https://evil.example/x.png", defaultLanguage: "fr", dailyText: { en: "ok-en", fr: "nope", ml: "bad code!" },
    plans: [{ id: "p1", title: { en: "One" }, days: [[{ book: "mark", chapter: 0 }]] }, { id: "p2", title: { en: "Two" }, days: [[{ book: "mark", chapter: 1 }]] }],
  });
  assert.equal(settings.name, "Good Church");
  assert.equal(settings.logo, undefined);
  assert.equal(settings.defaultLanguage, undefined);
  assert.equal(settings.dailyText.en, "ok-en");
  assert.equal(settings.dailyText.ml, DEFAULTS.dailyText.ml);
  assert.deepEqual(settings.plans.map((p) => p.id), ["p2"]);
  assert.ok(problems.some((p) => p.startsWith("logo")));
  assert.ok(problems.some((p) => p.startsWith("defaultLanguage")));
  assert.ok(problems.some((p) => p.startsWith("plans[0]")));
});

test("the address is kept without https:// and a trailing slash", () => {
  assert.equal(parseChurchSettings({ name: "X", address: "https://church.example.org/" }).settings.address, "church.example.org");
});
