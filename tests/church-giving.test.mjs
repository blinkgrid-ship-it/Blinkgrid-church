import test from "node:test";
import assert from "node:assert/strict";
import { parseChurchSettings, parseGiving } from "../src/church/parse.ts";
import { churchFromAnswer } from "../src/church/resolve.ts";
import { demoGiving } from "../src/church/demoGiving.ts";

// The Giving page only SHOWS what the church gave. Nothing is trusted: a link must be https, text is short, junk is dropped and named.

test("a church's giving link and bank details are kept, trimmed", () => {
  const g = parseGiving({ link: " https://give.example.org/now ", bank: { accountName: " Grace Church ", accountNumber: "123456789", ifsc: "SBIN0000001" }, note: " Thank you. " });
  assert.deepEqual(g, { link: "https://give.example.org/now", bank: { accountName: "Grace Church", accountNumber: "123456789", ifsc: "SBIN0000001" }, note: "Thank you." });
});

test("only an https link is accepted: never javascript:, http or an address with a password", () => {
  for (const bad of ["javascript:alert(1)", "http://give.example.org", "ftp://x.org", "https://user:pw@give.example.org", "not a link", "https://" + "a".repeat(600) + ".org"]) {
    const problems = [];
    assert.equal(parseGiving({ link: bad }, problems), undefined, bad.slice(0, 30));
    assert.ok(problems.length, bad.slice(0, 30));
  }
});

test("a bad part is dropped and named, the good part stays; nothing usable gives no giving at all", () => {
  const problems = [];
  const g = parseGiving({ link: "https://give.example.org", bank: { accountNumber: "x".repeat(200), bankName: "Sample Bank", surprise: "ignored" } }, problems);
  assert.deepEqual(g, { link: "https://give.example.org", bank: { bankName: "Sample Bank" } });
  assert.match(problems.join(";"), /accountNumber/);
  assert.equal(parseGiving({ note: "only a note" }), undefined);
  assert.equal(parseGiving({}), undefined);
  assert.equal(parseGiving("text", []), undefined);
});

test("giving travels with the church settings, and is optional", () => {
  const withGiving = parseChurchSettings({ name: "X", giving: { link: "https://give.example.org" } });
  assert.equal(withGiving.settings.giving.link, "https://give.example.org");
  const without = parseChurchSettings({ name: "X" });
  assert.equal(without.settings.giving, undefined);
});

test("the server's answer may carry giving; a church without it still loads", () => {
  const answer = (extra) => ({
    contractVersion: 1,
    church: { id: "c", name: { en: "Grace" }, primaryAddress: "grace.example.org", addresses: ["grace.example.org"], defaultLanguage: "en", dailyText: { en: "bolls-kjv" }, ...extra },
  });
  const ok = churchFromAnswer(answer({ giving: { bank: { bankName: "Sample Bank" } } }), "grace.example.org");
  assert.equal(ok.kind, "church");
  assert.equal(ok.settings.giving.bank.bankName, "Sample Bank");
  const none = churchFromAnswer(answer({}), "grace.example.org");
  assert.equal(none.kind, "church");
  assert.equal(none.settings.giving, undefined);
});

test("the demo details are made up and say so", () => {
  const g = demoGiving();
  assert.equal(g.sample, true);
  assert.match(g.link, /^https:\/\/example\.org\//);
  assert.equal(parseGiving(g).sample, true); // they pass the same check as real details
});
