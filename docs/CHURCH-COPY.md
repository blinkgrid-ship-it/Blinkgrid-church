# Making a church copy (Daily Bible door, item 8)

One platform, many copies. A church copy is **the same code** with **one settings file** changed:
`src/church/church.json`. Never copy the code for each church.

## The file

```json
{
  "name": "Sample Church",
  "address": "church.example.org",
  "logo": "/church/logo.svg",
  "colors": { "accent": "#1f5f4a", "accentDark": "#8fd3b8" },
  "defaultLanguage": "ml",
  "dailyText": { "en": "sample-church-en", "ml": "sample-church-ml" },
  "plans": [
    { "id": "sunday-psalms", "title": { "en": "A Psalm a day", "ml": "ദിവസം ഒരു സങ്കീർത്തനം" },
      "days": [[{ "book": "psalms", "chapter": 1 }], [{ "book": "psalms", "chapter": 119, "part": [1, 4] }]] }
  ]
}
```

A full example is `src/church/church.sample.json`.

| Field | What it does | If left out |
|---|---|---|
| `name` | The name in the header and footer | OriginalScript |
| `address` | The web address on the picture a reader shares (no `https://`) | originalscript.org |
| `logo` | A picture in `public/` (svg, png, webp or jpg), such as `/church/logo.svg` | the book icon |
| `colors.accent` | Links and buttons, light theme. Must be dark enough for white text (contrast 4.5 to 1) | OriginalScript brown |
| `colors.accentDark` | The same for the dark theme. Must be light enough for dark text (4.5 to 1) | OriginalScript tan |
| `defaultLanguage` | `en`, `ml` or `hi`: the language a first-time reader gets, before the phone's language. A reader's own choice always wins | the phone's language |
| `dailyText` | The edition code each language reads in the Daily Bible | The universal Bible: `bolls-kjv` (English), `bolls-mov` (Malayalam), `bolls-hiov` (Hindi), read from bolls.life |
| `plans` | The church's own reading plans (book slug, chapter, optional `part` as `[1, 2]` for "part 1 of 2"). When present they **replace** the three starter plans | the three starter plans |

## How the file is checked

`src/church/parse.ts` checks every part and never throws. A part that is wrong is **ignored** (the OriginalScript
default is used) and named in the browser console as `church.json: ...`, so a typing slip cannot break the site.
`tests/church-settings.test.mjs` covers it, including the sample file.

## Steps for a new church

1. Deploy a copy of the same code (same repository, its own site).
2. Edit `src/church/church.json`. Put the logo in `public/church/`.
3. **The Bible text:** `dailyText` names one edition code per language. The codes `bolls-kjv`, `bolls-mov` and `bolls-hiov` are read from the open Bible service (bolls.life); any other code must be an edition that exists in the backend. Shalom loads the church's text
   as an edition first. Nothing under copyright is named without the publisher's written permission (CLAUDE.md guardrail 9).
4. Build with `VITE_DAILY_BIBLE=1` if the church should see the Daily Bible door (it is hidden by default until Sir's written OK).
5. Check at 320 px in each language the church uses.

## What the file does not change yet

These need the admin panel or a texts change and are **not** in the settings file:

- the browser tab title ("OriginalScript · Read. Understand. Grow.");
- the word "OriginalScript" inside interface sentences (home line, legal pages, feedback, Donate) in `src/locales`;
- the home page captions and topic tiles, and the Study door's own content;
- Donate and payment details (the donation page is on hold and has its own links).

A church copy that must change those lists them for the admin panel; do not edit the locale files by hand for one church.

## Finding the church by web address (T-137, built 14 Nov 2026, OFF by default)

Instead of `church.json`, a build can ask the server which church its web address is (contract file `docs/contracts/CHURCH-SETUP-contract.md`, Parts 2 and 7).

- `VITE_CHURCH_RESOLVE=api` asks `GET /api/v1/church/resolve?host=` (the server side does not exist yet).
- `VITE_CHURCH_RESOLVE=stub` uses the contract's test data (`src/church/stubChurches.ts`, never in a normal build). On the test site, `?churchHost=active.church.test` picks the case: `active`, `paused`, `unknown`, `broken`, `lowcontrast`, `server-error`, `slow`.
- Without the variable nothing changes: `church.json` is used and no extra call is made. `originalscript.org` itself never asks.
- Unknown, paused, broken, slow (4 seconds) or any server fault gives the plain OriginalScript page. No copy of a church is kept between visits or addresses.
- Code: `src/church/resolve.ts` (answer check, tested in `tests/church-resolve.test.mjs`), `churchStore.ts` (the one place that knows server or test data), `settings.ts` (`setChurchSettings`, once at start).

## The Bible text of one church (T-148, built 16 Nov 2026, stand-in until the server has the calls)

On `/admin/churches/:id`, a section "Bible text" lets an administrator choose, for each of English, Malayalam and Hindi, which text the church reads in the Daily Bible (contract Part 3). An editor can look, not save.

- The list of texts comes from `GET /admin/editions/daily`, each with its permission status: public domain, permission given, pending, refused, not checked (a given permission that has ended counts as not checked).
- A text that is not public domain or permission given is shown but cannot be chosen (the Save button is off and the screen says why). The server must refuse it as well (`422 TEXT_NOT_PERMITTED`); the screen words that code itself.
- Each text needs the line shown under the chapter (300 characters at most). The three built-in texts fill it in; staff may change it. It is sent in the text's language; a known line is sent in all three languages unless staff changed it.
- "Use OriginalScript text" removes the church's choice for that language (`DELETE .../texts/{language}`); the language falls back (contract Part 7).
- Until the server has the calls, the browser stand-in offers the real status of the three built-in texts (KJV is public domain; the Malayalam and Hindi old versions are NOT confirmed) and two SAMPLE texts (test data) so the screens can be tried to the end.
- Not built: changing a text's permission status (`POST /admin/editions/daily/{code}/permission`). That is for Paul or Sir to record, in a later task.
- Code: `src/admin/ChurchTexts.tsx`, rules in `src/admin/churchEdits.ts`, calls in `src/admin/churchesStore.ts`; tests in `tests/admin-churches.test.mjs` and `e2e/admin-churches.spec.ts`.

## The reading plan of one church (T-159, built 17 Nov 2026, stand-in until the server has the calls)

On `/admin/churches/:id`, a section "Reading plan" lets an administrator give the church its one plan (contract Part 4). A church cannot be switched on without it.

- The plan is written as **text, one day on each line**: `Day 1: Psalms 1; Mark 1`. The `Day n:` is optional; readings are separated by `;`, `,`, `+`, `&` or `and`; a part of a chapter is `(1/2)`. Lines copied from a spreadsheet work.
- Only whole English book names, the book's slug and a fixed list of short forms are read. Malayalam and Hindi book names are not (contract open question 8). A name is never guessed from its first letters.
- The screen names every line it cannot read (unknown book, a chapter the book does not have, a part like 3/2, a range, a verse) and sends nothing until all lines are clear. It then shows how it understood the plan (the first five days and the last).
- A saved plan comes back as the same text; a change is: change the text, save again. One plan per church; saving replaces it and makes it the church's `activePlanId`.
- A title in at least one language is needed (80 characters at most each).
- Only administrators save; an editor can look (contract open question 2).
- Until the server has the calls, the plans are kept in this browser (`original-script.admin-church-plans-preview.v1`), like the churches.
- Not built: a click-and-pick day editor (contract open question 9), Malayalam and Hindi book names, more than one plan per church, deleting a plan.
- Code: `src/admin/ChurchPlan.tsx`, the rules and the text reader in `src/admin/churchPlanRules.ts`, the calls in `src/admin/churchesStore.ts`; tests in `tests/admin-church-plan.test.mjs` and `e2e/admin-churches.spec.ts`.

## The readers of one church (T-167, built 17 Nov 2026, stand-in until the server has the calls)

How many people opened the church's reading each day (contract Part 8). A number only: no names, no phone numbers, no sign-in.

- **The site** counts a reader when a Daily Bible reading screen opens, once per browser per day, only on an address that resolved to an active church (`countReaderToday` in `src/church/churchStore.ts`, called from `DailyReader.tsx`). It sends `POST /api/v1/church/reading-count` with the address only. It does nothing on `originalscript.org`, for an unknown or paused church, or if this browser was counted today; a failed call is silent.
- The browser remembers the day (`original-script.church.counted.v1`) before it sends, so there is at most one try a day.
- **The staff screen** (`/admin/churches/:id`, section "Readers") lists the last 7 or 30 UTC days, newest first, each with its count and a small bar. A day with no count is shown as 0. Any staff role may look.
- A build with `VITE_CHURCH_RESOLVE=stub` keeps the counts in this browser (`original-script.church-readers-preview.v1`), so the staff screen's stand-in can show them. A build without the variable does not count at all.
- Code: `src/church/readerCount.ts` (the rules, tested alone), `src/admin/ChurchReaders.tsx`, `readers()` in `src/admin/churchesStore.ts`; tests in `tests/church-reader-count.test.mjs` and `e2e/admin-churches.spec.ts`.
- Not built: the rest of T-167 ("pilot features only" and the "not available" state) waits for Paul's list of pilot features.

## What a church's site shows (T-167 parts 2 and 3, built 18 Nov 2026, frontend only)

On a church's address the site shows only the church's own pages (contract Part 9). OriginalScript's own Bible and study are never shown there.

- **A church site** = an address found to be an active church, or a copy built with its own `church.json` (`isChurchSite()` in `src/church/site.ts`). `originalscript.org` is never one.
- **The list** is one file, `src/church/features.ts` (`CHURCH_PAGES`): Daily Bible, Donate, Settings, More, Terms, Privacy, Cookies. The rule `churchPathRule` is tested alone (`tests/church-features.test.mjs`).
- **The guard** sits in front of the routes in `src/Platform.tsx`: a blocked address shows "Not available here" (`src/church/ChurchPages.tsx`), the home address goes to `/daily`. No route was changed.
- **The menus**: header and bottom bar show Home, Donate, More. The search band, the account link, the Degree pathway link and the footer tagline are hidden. The footer adds "Powered by OriginalScript".
- **The Daily Bible** is on for a church site without the build switch (`dailyBibleOn()`), and stays hidden on OriginalScript's own site. "Go to academic section" and the landing page's link open originalscript.org.
- **Tested** with a build that looks the church up from test data: `$env:VITE_CHURCH_RESOLVE='stub'; npm run build:preview`, then `npx playwright test --config=playwright.church.config.ts` (`e2e/church-site.spec.ts`), then build again without the variable.
- Not built: choosing the features church by church (needs a `features` field from the server and a checklist on the church screen).
