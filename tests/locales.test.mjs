import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LANGUAGES } from "../src/lang/languages.ts";

// Interface text lives in src/locales/<lang>/<namespace>.json (src/i18n.ts). These checks keep
// every language complete and every key the code uses defined.
const root = path.resolve("src/locales");
const languages = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
const namespaces = fs.readdirSync(path.join(root, "en")).map((f) => f.replace(/\.json$/, ""));
const load = (lang, ns) => JSON.parse(fs.readFileSync(path.join(root, lang, `${ns}.json`), "utf8"));
const placeholders = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "locales" ? [] : sourceFiles(p);
    return /\.(tsx?|mjs)$/.test(e.name) ? [p] : [];
  });
}
const source = sourceFiles(path.resolve("src")).map((f) => fs.readFileSync(f, "utf8")).join("\n");

// The one language list (src/lang/languages.ts). "Full" languages (English, Malayalam, Hindi) are
// translated everywhere; the others have only the Donate and Feedback words, and English fills the rest.
const full = new Set(LANGUAGES.filter((l) => l.full).map((l) => l.code));

test("every folder in src/locales is a language named in src/lang/languages.ts", () => {
  const named = new Set(LANGUAGES.map((l) => l.code));
  assert.deepEqual(languages.filter((l) => !named.has(l)), [], "add the language to src/lang/languages.ts");
  for (const l of LANGUAGES) assert.ok(l.native && l.english && l.tag, `${l.code} needs a name and a tag`);
  assert.equal(new Set(LANGUAGES.map((l) => l.code)).size, LANGUAGES.length, "a language code is listed twice");
});

test("full languages have the same namespaces and keys as English", () => {
  assert.ok([...full].every((l) => languages.includes(l)) && full.has("en") && full.has("ml") && full.has("hi"));
  for (const lang of languages.filter((l) => full.has(l))) {
    assert.deepEqual(fs.readdirSync(path.join(root, lang)).map((f) => f.replace(/\.json$/, "")).sort(), [...namespaces].sort(), lang);
    for (const ns of namespaces) {
      const en = load("en", ns);
      const other = load(lang, ns);
      assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), `${lang}/${ns}.json`);
      for (const [key, text] of Object.entries(other)) {
        assert.equal(typeof text, "string", `${lang}/${ns}:${key}`);
        assert.ok(text.trim(), `${lang}/${ns}:${key} is empty`);
        // A translation may leave a placeholder out ("Updated" for "{{book}} updated"), but never add one the site cannot fill.
        const extra = placeholders(text).split(",").filter(Boolean).filter((name) => !placeholders(en[key]).split(",").includes(name));
        assert.deepEqual(extra, [], `${lang}/${ns}:${key} uses placeholders English does not have`);
      }
    }
  }
});

test("partial languages only have lines English has, with the same placeholders and tags", () => {
  const markup = (s) => (s.match(/<\/?\w+>/g) ?? []).join("");
  for (const lang of languages.filter((l) => !full.has(l))) {
    const files = fs.readdirSync(path.join(root, lang)).map((f) => f.replace(/\.json$/, ""));
    assert.deepEqual(files.filter((f) => !namespaces.includes(f)), [], `${lang} has a file English does not have`);
    assert.ok(files.includes("feedback") && files.includes("comingsoon"), `${lang} needs the Donate and Feedback words`);
    for (const ns of files) {
      const en = load("en", ns);
      for (const [key, text] of Object.entries(load(lang, ns))) {
        assert.ok(key in en, `${lang}/${ns}:${key} is not a line English has`);
        assert.equal(typeof text, "string", `${lang}/${ns}:${key}`);
        assert.ok(text.trim(), `${lang}/${ns}:${key} is empty`);
        assert.equal(placeholders(text), placeholders(en[key]), `${lang}/${ns}:${key} placeholders differ from English`);
        assert.equal(markup(text), markup(en[key]), `${lang}/${ns}:${key} tags differ from English`);
      }
    }
  }
});

test("every key the code names exists in English", () => {
  const used = new Set([...source.matchAll(/["'`]([a-z]+):([A-Za-z0-9_.]+)["'`]/g)].filter((m) => namespaces.includes(m[1])).map((m) => `${m[1]}:${m[2]}`));
  assert.ok(used.size > 50, `only ${used.size} keys found in src`);
  const missing = [...used].filter((id) => {
    const [ns, key] = id.split(":");
    const en = load("en", ns);
    return !(key in en) && !(`${key}_one` in en);
  });
  assert.deepEqual(missing, []);
});

test("no two-language t(\"English\", \"മലയാളം\") calls are left", () => {
  assert.deepEqual(source.match(/\bt\(\s*"[^"\n]+",\s*"[^"\n]*[ഀ-ൿ][^"\n]*"\s*\)/g) ?? [], []);
});
