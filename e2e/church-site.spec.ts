import { expect, test, type Page } from "@playwright/test";

// The church site: the church's own pages only, nothing of OriginalScript, "Not available here" for every other address.
// These tests need a build that looks the church up from test data:
//   $env:VITE_CHURCH_RESOLVE='stub'; npm run build
//   npx playwright test --config=playwright.church.config.ts
// The sample church is active.church.test (src/church/stubChurches.ts); the Bible service is stubbed.

const CHURCH = "?churchHost=active.church.test";
const BOOKS = [
  { bookid: 1, name: "Genesis", chronorder: 1, chapters: 2 },
  { bookid: 43, name: "John", chronorder: 60, chapters: 3 },
];
const verses = (n: number) => Array.from({ length: 6 }, (_, i) => ({ pk: i, verse: i + 1, text: `TEST verse ${i + 1} of chapter ${n}. ` }));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("blinkgrid-church.welcome.v1", "1");
    localStorage.setItem("blinkgrid-church.daily.pause-skipped.v1", "1");
  });
  await page.context().route("https://bolls.life/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (/^\/get-books\//.test(path)) return route.fulfill({ json: BOOKS });
    const m = path.match(/^\/get-text\/[A-Z]+\/(\d+)\/(\d+)\/$/);
    if (m) return route.fulfill({ json: verses(Number(m[2])) });
    return route.fulfill({ status: 404, json: {} });
  });
  // No real service in these tests: everything of ours that is asked for fails quietly.
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 503, json: { error: { code: "X", message: "off" } } }));
});

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const goTo = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, "", `/en${p}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);

test("the home address opens the Daily Bible, in the church's name", async ({ page }) => {
  await page.goto(`/en/${CHURCH}`);
  await expect(page).toHaveURL(/\/en\/daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Daily Bible");
  await expect(page.locator(".os-header .os-brand")).toContainText("Sample Church");
  await expect(page).toHaveTitle("Sample Church");
});

test("the menu has only the church's own pages: Daily Bible and More", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/en/daily${CHURCH}`);
  await expect(page.locator(".os-desktop-nav a")).toHaveText(["Daily Bible", "More"]);
  await expect(page.locator(".os-account, .os-search")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.locator(".os-bottom-nav a")).toHaveCount(2);
  expect(await noOverflow(page)).toBe(true);
});

test("any other address says Not available here, with a way back to the Daily Bible", async ({ page }) => {
  await page.goto(`/en/books${CHURCH}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not available here");
  await expect(page.getByRole("link", { name: "Go to the Daily Bible" })).toHaveAttribute("href", /\/en\/daily$/);
  for (const path of ["/read/genesis/1", "/study", "/search?q=love", "/courses", "/verse/john/3/16", "/account", "/admin", "/admin/churches", "/pathway", "/donate", "/terms", "/privacy", "/cookies"]) {
    await goTo(page, path);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveText("Not available here");
  }
});

test("nothing of OriginalScript shows: no link, no word, no Donate, no Powered by", async ({ page }) => {
  for (const path of ["/daily", "/daily/read/john/1", "/more", "/settings", "/books"]) {
    await page.goto(`/en${path}${CHURCH}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("a[href*='originalscript']").count(), path).toBe(0);
    expect(await page.locator("body").innerText(), path).not.toMatch(/originalscript|powered by|eastern theology|academic section|support the work/i);
  }
});

test("the Daily Bible has no Read or Study of ours, and a reading screen shows the church's text", async ({ page }) => {
  await page.goto(`/en/daily${CHURCH}`);
  await expect(page.getByRole("heading", { name: "In the meantime" })).toHaveCount(0);
  await expect(page.locator("a[href$='/books'], a[href$='/study']")).toHaveCount(0);
  await page.goto(`/en/daily/read/john/1${CHURCH}`);
  await expect(page.locator("[data-verse]")).toHaveCount(6);
});

test("More has only the church's own rows", async ({ page }) => {
  await page.goto(`/en/more${CHURCH}`);
  await expect(page.locator("main .os-row strong")).toHaveText(["Daily Bible", "Language & reading settings"]);
});

test("Settings opens, and the language menu lists the church's languages", async ({ page }) => {
  await page.goto(`/en/settings${CHURCH}`);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Not available here");
  await page.getByRole("button", { name: /Language/ }).first().click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(2);
});

test("a church site fits a 320 px phone in English, Malayalam and Hindi", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const lang of ["en", "ml", "hi"]) {
    for (const path of ["/daily", "/more", "/settings", "/books"]) {
      await page.goto(`/${lang}${path}${CHURCH}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await noOverflow(page), `${lang} ${path}`).toBe(true);
    }
  }
});

test("an address that is not an active church shows only Not available, never OriginalScript and never a half church", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const host of ["unknown.church.test", "paused.church.test", "broken.church.test"]) {
    await page.goto(`/en/daily?churchHost=${host}`);
    await expect(page.getByRole("heading", { level: 1 }), host).toHaveText("Not available here");
    await expect(page.locator(".os-desktop-nav a"), host).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go to the Daily Bible" }), host).toHaveCount(0);
    expect(await page.locator("body").innerText(), host).not.toMatch(/originalscript/i);
  }
});

// ---- The staff area (/staff) ----
// Sign-in is not tried for real here (no passwords in tests). A saved session is faked in the browser and the server's answer to "what may I do" is stubbed;
// the churches themselves are then the browser stand-in of a test build.
const fakeSession = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "staff-1", email: "staff@example.org", exp: 4102444800 })}.x`;
  return { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: { id: "staff-1", email: "staff@example.org", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
};
async function signedInStaff(page: Page, manageChurches: boolean) {
  await page.addInitScript((s) => localStorage.setItem("blinkgrid-staff-auth", JSON.stringify(s)), fakeSession());
  await page.route("**/api/v1/me/bootstrap", (route) => route.fulfill({ json: { profile: {}, capabilities: { manageChurches } } }));
}

test("staff area: signed out shows only a sign-in form, in the site's own look, with no OriginalScript word", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/en/staff");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await page.locator("body").innerText()).not.toMatch(/originalscript/i);
  await expect(page.locator(".os-bottom-nav")).toHaveCount(0);
});

test("staff area: church staff see the churches and the new-church form", async ({ page }) => {
  await signedInStaff(page, true);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/en/staff");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Churches");
  await page.getByRole("link", { name: /new church/i }).first().click();
  await expect(page).toHaveURL(/\/en\/staff\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await page.locator("body").innerText()).not.toMatch(/originalscript/i);
});

test("staff area: a signed-in account without the church staff role sees no churches", async ({ page }) => {
  await signedInStaff(page, false);
  await page.goto("/en/staff");
  await expect(page.getByText("This account is not church staff", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /new church/i })).toHaveCount(0);
});

// ---- Auto-scroll switch in the Daily Bible reader ----
const LONG = (n: number) => Array.from({ length: 90 }, (_, i) => ({ pk: i, verse: i + 1, text: `TEST verse ${i + 1} of chapter ${n}. The text goes on for a while so that every verse takes a few lines on a phone screen and the chapter is long. ` }));
async function openLongChapter(page: Page, speed?: string) {
  if (speed) await page.addInitScript((s) => localStorage.setItem("blinkgrid-church.daily.autoscroll-speed.v1", s), speed);
  await page.route("https://bolls.life/get-text/**", (route) => route.fulfill({ json: LONG(1) }));
  await page.goto(`/en/daily/read/john/1${CHURCH}`);
  await expect(page.locator("[data-verse]")).toHaveCount(90);
}
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

test("auto-scroll: switched on it waits, then moves the page; switched off it stops", async ({ page }) => {
  await openLongChapter(page, "fast");
  const sw = page.getByRole("button", { name: "Auto-scroll" });
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1200);
  expect(await scrollY(page), "nothing moves during the first two seconds").toBe(0);
  await page.waitForTimeout(3500);
  const moved = await scrollY(page);
  expect(moved).toBeGreaterThan(20);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  const stoppedAt = await scrollY(page);
  await page.waitForTimeout(1500);
  expect(await scrollY(page), "after switching off the page stays where it is").toBe(stoppedAt);
});

test("auto-scroll: the reader's own hand takes over, and the speed button changes the pace", async ({ page }) => {
  await openLongChapter(page, "fast");
  const sw = page.getByRole("button", { name: "Auto-scroll" });
  await sw.click();
  await page.getByRole("button", { name: /Scrolling speed: Fast/ }).click();
  await expect(page.getByRole("button", { name: /Scrolling speed: Slow/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("blinkgrid-church.daily.autoscroll-speed.v1"))).toBe("slow");
  await page.mouse.wheel(0, 200);
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "Auto-scroll is off" })).toHaveCount(1);
});

test("auto-scroll: it is off when a chapter opens, and on a phone the button clears the bottom bar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openLongChapter(page);
  const sw = page.getByRole("button", { name: "Auto-scroll" });
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  const a = await sw.boundingBox();
  const b = await page.locator(".os-bottom-nav").boundingBox();
  expect(a && b && a.y + a.height <= b.y).toBe(true);
  expect(a && a.x + a.width <= 320).toBe(true);
  expect(await noOverflow(page)).toBe(true);
});
