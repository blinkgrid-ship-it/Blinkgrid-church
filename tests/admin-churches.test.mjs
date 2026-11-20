import test from "node:test";
import assert from "node:assert/strict";
import { checkInput, cleanInput, normalizeAddress, missingForSwitchOn, displayName, ChurchApiError, checkTextChoice, attributionFor, effectiveStatus, statusAllows } from "../src/staff/churchEdits.ts";
import { createLocalChurchesStore, createApiChurchesStore, toChurchError, STAND_IN_EDITIONS } from "../src/staff/churchesStore.ts";

// The church screens' rules and both stores (contract file Parts 1, 2, 6). The stand-in must refuse what the server will refuse.
const good = () => ({ name: { en: "Sample Church", ml: "സാമ്പിൾ" }, colors: { accent: "#1f5f4a", accentDark: "#8fd3b8" }, defaultLanguage: "ml", addresses: ["church.example.org"] });
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
let n = 0;
const store = (storage = memory()) => createLocalChurchesStore(storage, () => "2026-11-14T10:00:00.000Z", "Test staff", () => `id-${++n}`);
const fails = async (promise, code) => {
  await assert.rejects(promise, (e) => e instanceof ChurchApiError && e.code === code);
};

test("a good edit has no problems", () => {
  assert.deepEqual(checkInput(good()), []);
});

test("a name is needed in at least one language, 80 characters at most", () => {
  assert.deepEqual(checkInput({ ...good(), name: {} }).map((p) => p.field), ["name"]);
  assert.deepEqual(checkInput({ ...good(), name: { en: "   " } }).map((p) => p.field), ["name"]);
  assert.deepEqual(checkInput({ ...good(), name: { hi: "x".repeat(81) } }), [{ field: "name.hi", problem: "tooLong" }]);
});

test("web addresses: typed forms are cleaned, a bad or repeated host is named by its place", () => {
  assert.equal(normalizeAddress(" HTTPS://Church.Example.org/path?x=1 "), "church.example.org");
  assert.equal(normalizeAddress("church.example.org:8080"), "church.example.org");
  assert.deepEqual(checkInput({ ...good(), addresses: [] }), [{ field: "addresses", problem: "required" }]);
  assert.deepEqual(checkInput({ ...good(), addresses: ["church.example.org", "no-dot", "https://CHURCH.example.org/"] }), [
    { field: "addresses.1", problem: "invalid" },
    { field: "addresses.2", problem: "duplicate" },
  ]);
});

test("colours follow the parse.ts rules: readable with white text (light) and with dark text (dark)", () => {
  assert.deepEqual(checkInput({ ...good(), colors: { accent: "#ffee00" } }), [{ field: "colors.accent", problem: "contrast" }]);
  assert.deepEqual(checkInput({ ...good(), colors: { accentDark: "#222222" } }), [{ field: "colors.accentDark", problem: "contrast" }]);
  assert.deepEqual(checkInput({ ...good(), colors: { accent: "1f5f4a" } }), [{ field: "colors.accent", problem: "contrast" }]);
  assert.deepEqual(checkInput({ ...good(), colors: {} }), []);
});

test("an edit is cleaned the way the server will: trimmed names, lower-case hosts, empty colours gone", () => {
  assert.deepEqual(cleanInput({ name: { en: " A ", ml: "  " }, colors: { accent: " #1F5F4A ", accentDark: "" }, defaultLanguage: "en", addresses: [" A.Example.ORG ", ""] }), {
    name: { en: "A" },
    colors: { accent: "#1f5f4a" },
    defaultLanguage: "en",
    addresses: ["a.example.org"],
  });
});

test("switch-on needs a name, an address, an allowed text for the default language and a plan", () => {
  const base = { name: { en: "A" }, addresses: ["a.example.org"], defaultLanguage: "en", texts: { en: { editionCode: "bolls-kjv", permissionStatus: "public-domain" } }, activePlanId: "p1" };
  assert.deepEqual(missingForSwitchOn(base), []);
  assert.deepEqual(missingForSwitchOn({ ...base, name: {}, addresses: [], activePlanId: null }), ["name", "address", "plan"]);
  assert.deepEqual(missingForSwitchOn({ ...base, texts: {} }), ["text"]);
  assert.deepEqual(missingForSwitchOn({ ...base, texts: { en: { editionCode: "x", permissionStatus: "permission-pending" } } }), ["text"]);
  assert.deepEqual(missingForSwitchOn({ ...base, defaultLanguage: "ml" }), ["text"]); // an en text does not cover an ml church
  assert.deepEqual(missingForSwitchOn({ ...base, texts: { en: { editionCode: "x", permissionStatus: "permission-granted" } } }), []);
});

test("a church's name in a list: the reader's language, else the first it has", () => {
  assert.equal(displayName({ name: { en: "A", ml: "B" } }, "ml"), "B");
  assert.equal(displayName({ name: { ml: "B" } }, "en"), "B");
  assert.equal(displayName({ name: {} }, "en"), "");
});

test("stand-in: create gives a draft at version 1, and it is kept in the storage", async () => {
  const storage = memory();
  const a = await store(storage).create(good());
  assert.equal(a.status, "draft");
  assert.equal(a.version, 1);
  assert.equal(a.updatedBy, "Test staff");
  assert.deepEqual(a.addresses, ["church.example.org"]);
  assert.equal((await store(storage).list()).length, 1); // a new store over the same storage sees it
  assert.equal((await store(storage).get(a.id)).id, a.id);
});

test("stand-in: a broken edit is refused with the fields named; another church's address is refused", async () => {
  const s = store();
  await assert.rejects(s.create({ ...good(), name: {} }), (e) => e.code === "VALIDATION_FAILED" && e.details[0].field === "name");
  const a = await s.create(good());
  await assert.rejects(s.create({ ...good(), addresses: ["Church.Example.org"] }), (e) => e.code === "ADDRESS_TAKEN" && e.details[0].field === "addresses.0");
  const b = await s.create({ ...good(), addresses: ["other.example.org"] });
  await fails(s.update(b.id, { ...good(), addresses: ["church.example.org"] }, b.version), "ADDRESS_TAKEN");
  const same = await s.update(a.id, { ...good(), name: { en: "Renamed" } }, a.version); // its own address is not "taken"
  assert.equal(same.name.en, "Renamed");
});

test("stand-in: an old version is refused (409), a good save goes up by one", async () => {
  const s = store();
  const a = await s.create(good());
  const b = await s.update(a.id, { ...good(), name: { en: "Two" } }, 1);
  assert.equal(b.version, 2);
  await fails(s.update(a.id, { ...good(), name: { en: "Three" } }, 1), "CONFLICT_VERSION");
  await fails(s.setStatus(a.id, "paused", 1), "CONFLICT_VERSION");
  await fails(s.get("nope"), "CHURCH_NOT_FOUND");
});

test("stand-in: switching on is refused until the church is ready; pausing and archiving are instant", async () => {
  const s = store();
  const a = await s.create(good());
  await assert.rejects(s.setStatus(a.id, "active", a.version), (e) => e.code === "NOT_READY" && e.details.map((d) => d.field).join() === "text,plan");
  const paused = await s.setStatus(a.id, "paused", a.version);
  assert.equal(paused.status, "paused");
  assert.equal((await s.setStatus(a.id, "archived", paused.version)).status, "archived");
});

test("server store: the calls and bodies follow the contract", async () => {
  const seen = [];
  const row = { id: "c1", version: 1 };
  const request = async (method, path, body) => {
    seen.push([method, path, body]);
    if (method === "GET" && path === "/admin/churches") return { items: [{ id: "c1" }], nextCursor: "next" };
    if (method === "GET" && path.startsWith("/admin/churches?cursor=")) return { items: [{ id: "c2" }], nextCursor: null };
    return { church: row };
  };
  const s = createApiChurchesStore(request);
  assert.deepEqual((await s.list()).map((c) => c.id), ["c1", "c2"]);
  await s.get("c 1");
  await s.create({ name: { en: " A " }, colors: { accent: "" }, defaultLanguage: "en", addresses: [" X.Example.org "] });
  await s.update("c1", good(), 3);
  await s.setStatus("c1", "paused", 4);
  assert.deepEqual(seen.map((x) => x[0] + " " + x[1]), [
    "GET /admin/churches",
    "GET /admin/churches?cursor=next",
    "GET /admin/churches/c%201",
    "GET /admin/churches/c%201/texts",
    "POST /admin/churches",
    "PATCH /admin/churches/c1",
    "GET /admin/churches/c1/texts",
    "POST /admin/churches/c1/status",
    "GET /admin/churches/c1/texts",
  ]);
  assert.deepEqual(seen[4][2], { name: { en: "A" }, colors: {}, defaultLanguage: "en", addresses: ["x.example.org"] });
  assert.equal(seen[5][2].expectedVersion, 3);
  assert.deepEqual(seen[7][2], { status: "paused", expectedVersion: 4 });
});

test("server store: every failure becomes an error the screen can word", async () => {
  const failing = (e) => createApiChurchesStore(async () => { throw e; });
  await fails(failing({ status: 409, code: "ADDRESS_TAKEN", details: [{ field: "addresses.0", problem: "taken" }] }).list(), "ADDRESS_TAKEN");
  await fails(failing({ status: 401 }).list(), "AUTH_REQUIRED");
  await fails(failing({ status: 403 }).list(), "FORBIDDEN");
  await fails(failing({ status: 409 }).list(), "CONFLICT_VERSION");
  await fails(failing({ status: 422 }).list(), "VALIDATION_FAILED");
  await fails(failing({ status: 429 }).list(), "RATE_LIMITED");
  await fails(failing({ status: 503 }).list(), "UNAVAILABLE");
  await fails(failing(new TypeError("network")).list(), "UNAVAILABLE");
  assert.equal(toChurchError({ code: "NOT_READY", status: 422, details: [{ field: "plan", problem: "missing" }] }).details[0].field, "plan");
  assert.equal(toChurchError({ code: "SOMETHING_NEW", status: 500 }).code, "UNAVAILABLE");
});

// ---- Bible text per language (T-148, contract Part 3) ----

test("a text may be shown only when it is public domain or permission is granted", () => {
  assert.ok(statusAllows("public-domain") && statusAllows("permission-granted"));
  for (const s of ["permission-pending", "permission-refused", "unknown"]) assert.equal(statusAllows(s), false, s);
});

test("a granted permission that has ended counts as unknown", () => {
  const granted = { permissionStatus: "permission-granted", permissionExpires: "2026-11-15" };
  assert.equal(effectiveStatus(granted, "2026-11-15"), "permission-granted"); // the last day still counts
  assert.equal(effectiveStatus(granted, "2026-11-16"), "unknown");
  assert.equal(effectiveStatus({ permissionStatus: "permission-granted", permissionExpires: null }, "2030-01-01"), "permission-granted");
  assert.equal(effectiveStatus({ permissionStatus: "public-domain", permissionExpires: "2020-01-01" }, "2030-01-01"), "public-domain");
});

test("choosing a text: the code is checked, and the line under the chapter is needed (300 characters at most)", () => {
  assert.deepEqual(checkTextChoice("bolls-kjv", "King James Version"), []);
  assert.deepEqual(checkTextChoice("Bad Code", "x"), [{ field: "editionCode", problem: "invalid" }]);
  assert.deepEqual(checkTextChoice("bolls-kjv", "   "), [{ field: "attribution", problem: "required" }]);
  assert.deepEqual(checkTextChoice("bolls-kjv", "x".repeat(301)), [{ field: "attribution", problem: "tooLong" }]);
});

test("the line is sent in the text's language; a known line is sent in all three unless staff changed it", () => {
  assert.deepEqual(attributionFor("ml", " Own line "), { ml: "Own line" });
  const known = { en: "E", ml: "M", hi: "H" };
  assert.deepEqual(attributionFor("ml", "M", known), { en: "E", ml: "M", hi: "H" });
  assert.deepEqual(attributionFor("ml", "M changed", known), { ml: "M changed" });
});

const kjv = { editionCode: "bolls-kjv", attribution: { en: "King James Version (public domain)." } };

test("stand-in: the offered texts carry their real status (the Malayalam and Hindi old versions are not confirmed)", async () => {
  const list = await store().editions();
  const status = (code) => list.find((e) => e.editionCode === code)?.permissionStatus;
  assert.equal(status("bolls-kjv"), "public-domain");
  assert.equal(status("bolls-mov"), "unknown");
  assert.equal(status("bolls-hiov"), "unknown");
  assert.equal(list.length, STAND_IN_EDITIONS.length);
});

test("stand-in: a cleared text is saved, the version goes up, and the switch-on rule then misses only the plan", async () => {
  const s = store();
  const a = await s.create({ ...good(), defaultLanguage: "en" });
  const b = await s.setText(a.id, "en", kjv, a.version);
  assert.equal(b.version, 2);
  assert.equal(b.texts.en.editionCode, "bolls-kjv");
  assert.equal(b.texts.en.permissionStatus, "public-domain");
  assert.deepEqual(b.texts.en.attribution, kjv.attribution);
  await assert.rejects(s.setStatus(a.id, "active", b.version), (e) => e.code === "NOT_READY" && e.details.map((d) => d.field).join() === "plan");
});

test("stand-in: a text that is not cleared is refused with TEXT_NOT_PERMITTED, and nothing is saved", async () => {
  const s = store();
  const a = await s.create(good());
  await assert.rejects(
    s.setText(a.id, "ml", { editionCode: "bolls-mov", attribution: { ml: "x" } }, a.version),
    (e) => e instanceof ChurchApiError && e.code === "TEXT_NOT_PERMITTED" && e.details[0].field === "editionCode",
  );
  assert.deepEqual((await s.get(a.id)).texts, {});
  assert.equal((await s.get(a.id)).version, a.version);
});

test("stand-in: a code of another language, an unknown code or an empty line is VALIDATION_FAILED", async () => {
  const s = store();
  const a = await s.create(good());
  await fails(s.setText(a.id, "ml", kjv, a.version), "VALIDATION_FAILED"); // an English text for Malayalam
  await fails(s.setText(a.id, "en", { editionCode: "nope-1", attribution: { en: "x" } }, a.version), "VALIDATION_FAILED");
  await fails(s.setText(a.id, "en", { editionCode: "bolls-kjv", attribution: { en: "  " } }, a.version), "VALIDATION_FAILED");
});

test("stand-in: an old version is refused; removing a choice puts the language back to the OriginalScript text", async () => {
  const s = store();
  const a = await s.create({ ...good(), defaultLanguage: "en" });
  await fails(s.setText(a.id, "en", kjv, 99), "CONFLICT_VERSION");
  const b = await s.setText(a.id, "en", kjv, a.version);
  const c = await s.removeText(a.id, "en");
  assert.deepEqual(c.texts, {});
  assert.equal(c.version, b.version + 1);
  await assert.rejects(s.setStatus(a.id, "active", c.version), (e) => e.details.map((d) => d.field).join() === "text,plan");
});

test("server store: text calls follow the contract and the church is read again afterwards", async () => {
  const seen = [];
  const request = async (method, path, body) => {
    seen.push([method, path, body]);
    if (method === "GET" && path === "/admin/editions/daily") return { items: [{ editionCode: "bolls-kjv", language: "en", name: "KJV", source: "bolls", permissionStatus: "public-domain" }] };
    if (method === "GET" && path.endsWith("/texts"))
      return { items: [{ language: "en", editionCode: "bolls-kjv", permissionStatus: "public-domain", attribution: { en: "KJV" } }, { language: "xx", editionCode: "x", permissionStatus: "unknown" }] };
    if (method === "GET") return { church: { id: "c1", version: 5 } };
    return {};
  };
  const s = createApiChurchesStore(request);
  assert.equal((await s.editions())[0].editionCode, "bolls-kjv");
  const c = await s.setText("c1", "en", kjv, 4);
  assert.deepEqual(Object.keys(c.texts), ["en"]); // a language the site does not have is left out
  assert.equal(c.version, 5);
  await s.removeText("c1", "ml");
  assert.deepEqual(seen.map((x) => x[0] + " " + x[1]), [
    "GET /admin/editions/daily",
    "PUT /admin/churches/c1/texts/en",
    "GET /admin/churches/c1",
    "GET /admin/churches/c1/texts",
    "DELETE /admin/churches/c1/texts/ml",
    "GET /admin/churches/c1",
    "GET /admin/churches/c1/texts",
  ]);
  assert.deepEqual(seen[1][2], { editionCode: "bolls-kjv", attribution: kjv.attribution, expectedVersion: 4 });
});

test("server store: TEXT_NOT_PERMITTED from the server reaches the screen as that code", async () => {
  const s = createApiChurchesStore(async () => {
    throw { status: 422, code: "TEXT_NOT_PERMITTED", details: [{ field: "editionCode", problem: "permission is pending" }] };
  });
  await assert.rejects(s.setText("c1", "en", kjv, 1), (e) => e instanceof ChurchApiError && e.code === "TEXT_NOT_PERMITTED");
});
