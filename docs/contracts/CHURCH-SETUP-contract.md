# First church setup: contract file (T-102, PROPOSAL, 13 Nov 2026)

Status: written by Gokul for Shalom (database and API) and Paul (scope). Nothing below exists on the server yet.
Gokul builds the screens against this file from Mon 16 with test data (stub adapter `src/church/churchStore.ts`, to be
added; only that file changes when the API is real). Shalom checks this file against the database on Sat 14.

Contract version: **1**. Every response from the church calls carries `"contractVersion": 1`. If the site gets any other
number it shows the safe state (Part 7).

## What is in and what is not

In: church identity (Part 1), which church a web address opens (Part 2), the Bible text per language with its permission
status (Part 3), one reading plan (Part 4), who may save (Part 5), error messages (Part 6), the safe state (Part 7),
reader count (Part 8, needed for T-167 and the Sat 21 check).

Out (waits for Paul's decision, not built): church logins and roles, wording overrides per church, the audio table,
the Correction desk, Stripe giving, self sign-up, apps.

## How the site works today (so nothing is invented twice)

A church copy today is `src/church/church.json`, checked by `src/church/parse.ts`: `name`, `address`, `logo`,
`colors.accent`, `colors.accentDark`, `defaultLanguage`, `dailyText` (edition code per language), `plans`. This contract
keeps those same fields and the same rules, and moves them from a file into the database, found by web address.
Where a rule below says "same as parse.ts" the code is the reference.

Rules that apply to every call below:
- Base: `/api/v1`. JSON only. Dates are ISO 8601 UTC.
- Languages are `en`, `ml`, `hi` (the three site languages). Bible books are the slugs the reader already uses
  (`genesis`, `psalms`, `mark` ...), chapters start at 1.
- Errors use the existing shape (Part 6). Staff calls need a signed-in staff token, checked **on the server on every
  call**; hiding a button is never the protection.

---

## Part 1. Church identity

A church is one row.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `id` | uuid | set by server | never changes |
| `name` | object `{ en?, ml?, hi? }` | yes, at least one language | each 1 to 80 characters, plain text, no HTML. A language left out uses the first language that has a name. |
| `logoUrl` | string or null | no | `https` address of a file the server stores. Types svg, png, webp, jpg. 500 KB at most. null = the book icon. |
| `colors.accent` | string `#rrggbb` | no | contrast against `#ffffff` at least 4.5 to 1 (same as parse.ts). null = OriginalScript brown. |
| `colors.accentDark` | string `#rrggbb` | no | contrast against `#241d17` at least 4.5 to 1. null = OriginalScript tan. |
| `defaultLanguage` | `en` \| `ml` \| `hi` | yes | the language a first-time reader gets before the phone's language. A reader's own choice always wins. |
| `addresses` | list of strings | yes, at least one | see Part 2 |
| `status` | `draft` \| `active` \| `paused` \| `archived` | yes, starts `draft` | see the table below |
| `activePlanId` | uuid or null | no | the one reading plan the church runs (Part 4) |
| `version` | integer | set by server | goes up by 1 at every save; stops two staff overwriting each other |
| `updatedBy` | string | set by server | staff display name |
| `updatedAt` | ISO time | set by server | |
| `createdAt` | ISO time | set by server | |

What `status` means to a reader:

| status | Reader sees |
| --- | --- |
| `draft` | the safe state (a church not yet switched on is the same as unknown) |
| `active` | the church's name and look |
| `paused` | the safe state |
| `archived` | the safe state |

Only `active` ever shows a church's look. Only staff can see a church in any other status.

### Staff calls (admin)

| Call | Who | Body and answer |
| --- | --- | --- |
| `GET /admin/churches?status=&q=&cursor=` | staff | `{ items: [church], nextCursor }`, 50 per page |
| `GET /admin/churches/{id}` | staff | `{ church }` |
| `POST /admin/churches` | admin, superadmin | body: `name`, `defaultLanguage`, `addresses`, optional `colors`; answer `201 { church }` with `status: "draft"` |
| `PATCH /admin/churches/{id}` | admin, superadmin | body: any of `name`, `colors`, `defaultLanguage`, `addresses`, `activePlanId`, plus `expectedVersion` (required); answer `{ church }`. `409 CONFLICT_VERSION` if the version is old. |
| `PUT /admin/churches/{id}/logo` | admin, superadmin | file upload (multipart, field `file`); answer `{ church }` with `logoUrl` set. `400 LOGO_INVALID` for a wrong type or size. |
| `DELETE /admin/churches/{id}/logo` | admin, superadmin | answer `{ church }` with `logoUrl: null` |
| `POST /admin/churches/{id}/status` | admin, superadmin | body `{ status, expectedVersion }`; answer `{ church }`. See the switch-on rule below. |

Switch-on rule (server enforces): a church can become `active` only if it has a name, at least one address, an approved
Bible text for its default language (Part 3), and an `activePlanId`. Otherwise `422 NOT_READY` with
`details: [{ field, problem }]` naming what is missing. Pausing and archiving have no condition and are instant.

Preview: the staff form shows a preview from a **draft** copy of the fields on the screen. The preview is made by the
site itself from the form values (no server call). Nothing is public until `status` is `active`.

---

## Part 2. Which church a web address opens

A web address (host name only, lower case, no `https://`, no path, no port): `church.example.org`,
`stmarys.test.originalscript.org`. One address belongs to one church. A church may have several (for example
`stmarys.org` and `www.stmarys.org`).

| Field | Type | Rule |
| --- | --- | --- |
| `addresses[]` | string | 3 to 253 characters, letters, digits, dots, hyphens; at least one dot; stored lower case, a leading `www.` is a different address |
| first in the list | | the primary address, the one used on the picture a reader shares |

Saving an address that another church already uses: `409 ADDRESS_TAKEN`.

### The one public call the site makes at start

`GET /church/resolve?host=church.example.org`  (no sign-in; the site sends its own `window.location.hostname`)

Answer when the address belongs to an **active** church (`200`):

```json
{
  "contractVersion": 1,
  "church": {
    "id": "…uuid…",
    "name": { "en": "Sample Church", "ml": "…" },
    "logoUrl": "https://…/logo.svg",
    "colors": { "accent": "#1f5f4a", "accentDark": "#8fd3b8" },
    "defaultLanguage": "ml",
    "primaryAddress": "church.example.org",
    "addresses": ["church.example.org"],
    "dailyText": { "en": "sample-church-en", "ml": "sample-church-ml" },
    "plan": { "id": "…", "version": 3, "title": { "en": "…" }, "days": [ [ { "book": "psalms", "chapter": 1 } ] ] }
  }
}
```

The answer holds **only what a reader needs**: no staff names, no `status`, no other church, no permission notes.
`dailyText` holds only texts whose permission status allows showing (Part 3).

Every other case is **`404 CHURCH_NOT_FOUND`**: unknown address, `draft`, `paused`, `archived`. The same answer for all
of them, so a stranger cannot learn that a paused church exists. Cache: `Cache-Control: public, max-age=60` and an ETag;
the cache key is the host.

Safety test 1 follows from this call: it takes **no church id**. The church is found from the address only. A reader's
site can never ask for another church's data by naming it.

---

## Part 3. Bible text per language, and its permission status

One row per church and language: which text the church reads in the Daily Bible.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `churchId` | uuid | yes | |
| `language` | `en` \| `ml` \| `hi` | yes | one row per language per church |
| `editionCode` | string | yes | `^[a-z0-9][a-z0-9-]*$`, 64 characters at most. Today's codes: `bolls-kjv` (English), `bolls-mov` (Malayalam, read from bolls.life), `bolls-hiov` (Hindi). Any other code must be an edition that exists on our server. |
| `source` | `bolls` \| `originalscript` | set by server from the code | where the text is read from |
| `permissionStatus` | see below | yes | |
| `permissionHolder` | string | needed for `permission-granted` | who gave permission (publisher or society) |
| `permissionRecord` | string | needed for `permission-granted` | where the written permission is kept (a reference, never the file or a password) |
| `permissionExpires` | date or null | no | after this date the status counts as `unknown` |
| `approvedBy` | string | set by server | staff who set the status |
| `approvedAt` | ISO time | set by server | |
| `attribution` | object `{ en?, ml?, hi? }` | yes for any shown text | the line the reader shows under the chapter |

`permissionStatus`:

| Value | Meaning | May the church show it? |
| --- | --- | --- |
| `public-domain` | no copyright (for example KJV) | yes |
| `permission-granted` | the holder gave written permission (holder and record are filled) | yes, until `permissionExpires` |
| `permission-pending` | asked, no answer | **no** |
| `permission-refused` | the holder said no | **no** |
| `unknown` | nobody has checked | **no** |

Rule (server enforces, not only the screen): a text whose status is not `public-domain` or `permission-granted` cannot be
saved as the church's text. The answer is `422 TEXT_NOT_PERMITTED`. When a permission expires, the text drops out of
`dailyText` in the public answer and the language falls back (Part 7).

For the pilot (Paul's plan): KJV (`bolls-kjv`, `public-domain`) and "Malayalam 1910". **Open question 1:** the site's
Malayalam text today is `bolls-mov` ("Malayalam Old Version" on bolls.life). Is that the same Bible as "Malayalam 1910"?
Its status stays `unknown` until Paul or Sir confirms it and gives the permission record. Our code holds
`licenceConfirmed: false` for `bolls-mov` and `bolls-hiov`.

### Staff calls

| Call | Who | Body and answer |
| --- | --- | --- |
| `GET /admin/editions/daily` | staff | the texts the selector may offer: `{ items: [{ editionCode, language, name, source, permissionStatus, permissionHolder, permissionExpires }] }` (a list kept by staff; this is what the T-148 selector shows with each status) |
| `GET /admin/churches/{id}/texts` | staff | `{ items: [text row] }` |
| `PUT /admin/churches/{id}/texts/{language}` | admin, superadmin | body `{ editionCode, attribution, expectedVersion }` where `expectedVersion` is the church's `version`; answer `{ item }`. The status comes from the edition list, **never from the request**. |
| `DELETE /admin/churches/{id}/texts/{language}` | admin, superadmin | removes the church's own choice for that language (the language falls back, Part 7). `204`. |
| `POST /admin/editions/daily/{editionCode}/permission` | admin, superadmin | body `{ permissionStatus, permissionHolder, permissionRecord, permissionExpires }`; answer `{ item }`. Changing this is how a text becomes allowed. |

### Part 3b. A church brings its own Bible text (prepared, decided 16 Nov: "they may or may not, be prepared")

Paul's answer is that a church may or may not bring its own Bible text, so the design must allow it without a rebuild.
The selector above already does: it offers every text on the staff list (`GET /admin/editions/daily`), so a text a church
brings is chosen the same way once it is on that list. No change to the choosing calls is needed.

What must exist so a church's own text can reach that list (a staff task, **not** a church login; churches have no logins yet):

1. **The text is brought in** through the import pipeline staff already use (`/admin/imports`, the spreadsheet or file check
   then upload, which produces an edition with an `editionCode`). Nothing new is asked of the frontend here.
2. **It starts as `unknown`.** A newly imported text is never allowed to be shown. It appears on the list with
   `permissionStatus: "unknown"` and `source: "originalscript"`.
3. **Permission is recorded** by admin or superadmin through `POST /admin/editions/daily/{editionCode}/permission` (Part 3,
   Staff calls): holder and where the written permission is kept are needed for `permission-granted`. Only then can a
   church choose it (`TEXT_NOT_PERMITTED` before that).
4. **The text belongs to one church if the holder said so.** Optional field on the edition, `onlyForChurchId` (uuid or
   null). When set, only that church may choose it, and it is left out of the list for other churches. (**Open question 6.**)
5. **Reading it.** A code that is not one of the three built-in texts is read from OriginalScript's own server (this is how
   the Daily Bible works today, `src/daily/source.ts`). The Daily Bible's check that a book and chapter exist applies as
   it does now.

What the frontend builds, and when:
- T-148 (done): choose from the list, with each text's status. Works for any text on the list.
- Later, only if Paul wants it in the staff form: an "Add a text" step that links to `/admin/imports` and a screen to record
  the permission (item 3). Not built; waits for Shalom's answer to open questions 6 and 7.

---

## Part 4. One reading plan

For the pilot a church has **one** plan, assigned by `activePlanId`. The plan is its own row, so it can be written
once and changed later.

Plan:

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `id` | uuid | set by server | |
| `churchId` | uuid | yes | a plan belongs to one church |
| `title` | object `{ en?, ml?, hi? }` | yes, at least one | each 1 to 80 characters, plain text |
| `days` | list of days | yes | 1 to 366 days |
| `version` | integer | set by server | goes up by 1 at every save |
| `updatedBy`, `updatedAt` | | set by server | |

A **day** is a list of 1 to 6 **readings**. A **reading** (same as `ChurchReading` in parse.ts):

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `book` | string | yes | a book slug the site knows (`^[a-z0-9-]+$`); the server checks the 66 books |
| `chapter` | integer | yes | 1 or more, and a chapter the book has |
| `part` | `[n, m]` | no | read part n of m of the chapter; 1 <= n <= m <= 10 |

Day 1 is the church's start date for that reader (the site keeps the reader's start date on the phone, as today).

| Call | Who | Body and answer |
| --- | --- | --- |
| `GET /admin/churches/{id}/plans` | staff | `{ items: [plan] }` |
| `GET /admin/plans/{planId}` | staff | `{ plan }` |
| `POST /admin/churches/{id}/plans` | admin, superadmin | body `{ title, days }`; answer `201 { plan }` |
| `PUT /admin/plans/{planId}` | admin, superadmin | body `{ title, days, expectedVersion }`; answer `{ plan }`. The whole plan is replaced. `409 CONFLICT_VERSION` if old. |
| `DELETE /admin/plans/{planId}` | admin, superadmin | `204`. `409 PLAN_IN_USE` if it is the church's `activePlanId`. |

Assign it with `PATCH /admin/churches/{id}` `{ activePlanId, expectedVersion }` (Part 1). A plan of another church is
refused: `403 FORBIDDEN`. Invalid readings: `400 PLAN_INVALID` with `details: [{ field: "days[3][0].chapter", problem }]`.

Readers get the plan only inside the `resolve` answer (Part 2). There is no separate public plan call.

### How staff write a plan on the screen (T-159, built 17 Nov, decided with Gokul: paste first, a click-and-pick editor later)

The staff screen (`/admin/churches/:id`, section "Reading plan") takes the plan as **text, one day on each line**, reads it, and sends
the `days` list of this Part. Nothing new for the server: it receives the same `{ title, days }` it always would.

- A line is `Day 3: Psalms 3; Mark 2 (2/2)`. The `Day 3:` is optional (if given it must be the line's own number, so a gap is found, not
  guessed). Readings are separated by `;`, `,`, `+`, `&` or `and`. A part of a chapter is `(1/2)` or `part 1 of 2`. Lines copied from a
  spreadsheet (day, tab, readings) work.
- Only whole English book names, the `slug` and a fixed list of short forms are understood (never a guess from the first letters).
  Malayalam and Hindi book names are **not** read yet (open question 8).
- The screen shows how it understood the plan (the first five days and the last) and names every line it cannot read, before anything is sent.
- A saved plan comes back as the same text, so a change is: change the text, save again (`PUT`, the whole plan is replaced).
- **Order of calls for a church with no plan:** `GET /admin/churches/{id}/plans` (to reuse a plan made earlier but never assigned), then
  `POST /admin/churches/{id}/plans`, then `PATCH /admin/churches/{id}` with `{ activePlanId, expectedVersion }`. If the `PATCH` fails
  the plan exists but is not assigned; the next save finds it in the list and writes it again, so no second plan is made.
- Server please: a plan `PUT` does not need to raise the **church** `version`; only the `PATCH` that assigns it does (the screen
  assumes this). Tell Gokul if not.
- The screen needs no more than: `GET /admin/plans/{planId}` for the church's `activePlanId`, and `400 PLAN_INVALID` with
  `details[].field` like `days[3][0].chapter` (counted from 0; the screen says "Day 4").

---

## Part 5. Who is allowed to save

Our staff only, for now. No church member can sign in or save.

| Role (existing) | Read staff calls | Save (POST, PUT, PATCH, DELETE) |
| --- | --- | --- |
| no sign-in | no (`401 AUTH_REQUIRED`) | no |
| `learner`, `feedback` | no (`403 FORBIDDEN`) | no |
| `editor` | yes | **no** (open question 2) |
| `admin`, `superadmin` | yes | yes |

Rules:
1. The server checks the role **on every call**. The screen hides what a role may not use, but only the server is trusted.
2. Public calls (`/church/resolve`, `/church/reading-count`) need no sign-in and can read or write nothing else.
3. Every save puts `updatedBy` and `updatedAt` on the row and one line in a change log (who, what, when, church).
4. A save sends `expectedVersion`; an old one is refused with `409`.

**Open question 2:** may an `editor` write a church's reading plan, or only `admin` and `superadmin`? This file assumes
only `admin` and `superadmin` ("staff only") until Paul says otherwise.

---

## Part 6. Error messages

Every error has this shape (the one the server already uses):

```json
{ "error": { "code": "TEXT_NOT_PERMITTED", "message": "This Bible text is not cleared for use.", "details": [ { "field": "editionCode", "problem": "permission is pending" } ] }, "requestId": "…" }
```

`details` is optional. The screen shows **its own sentence from the language files** for each `code` (so it is in
English, Malayalam and Hindi); the server `message` is for the log and for Shalom, never shown as it is.

| HTTP | `code` | When | Screen shows (English wording; ml and hi follow) |
| --- | --- | --- | --- |
| 400 | `VALIDATION_FAILED` | a field breaks a rule; `details` names each field | "Check the marked fields." |
| 400 | `PLAN_INVALID` | a day or reading is wrong | "A day in this plan is not valid." (names the day) |
| 400 | `LOGO_INVALID` | wrong type or over 500 KB | "Use an svg, png, webp or jpg picture under 500 KB." |
| 401 | `AUTH_REQUIRED` | no or old sign-in | "Please sign in again." |
| 403 | `FORBIDDEN` | role not allowed, or another church's plan | "You may not do this." |
| 404 | `CHURCH_NOT_FOUND` | unknown, draft, paused or archived (public call); unknown id (staff call) | public call: the safe state (Part 7); staff call: "This church was not found." |
| 409 | `CONFLICT_VERSION` | `expectedVersion` is old | "Someone else saved first. Reload and try again." |
| 409 | `ADDRESS_TAKEN` | another church uses this address | "This web address belongs to another church." |
| 409 | `PLAN_IN_USE` | deleting the active plan | "This plan is in use. Choose another plan first." |
| 422 | `TEXT_NOT_PERMITTED` | status is not `public-domain` or `permission-granted` | "This Bible text is not cleared yet." |
| 422 | `NOT_READY` | switch-on rule broken; `details` lists what is missing | "Not ready to switch on: " + the list |
| 429 | `RATE_LIMITED` | too many calls | "Too many tries. Wait a minute." |
| 500 / 503 | `SERVER_ERROR` / `UNAVAILABLE` | the server failed | "Could not save. Nothing was changed. Try again." |

On every failed save the screen keeps what the staff member typed, shows the sentence next to the field, and does
not look as if it saved (CLAUDE.md guardrail 8).

---

## Part 7. What the site shows when a church is unknown, paused or will not load

**The safe state is the plain OriginalScript page**: the name "OriginalScript", the OriginalScript colours, no logo, the
OriginalScript Bible texts (`bolls-kjv`, `bolls-mov`, `bolls-hiov`) and the starter plans. It is the site as it is today
with no church settings. It never shows another church's name, look, text or plan.

The site shows the safe state when any of these happens:

| Case | How the site knows |
| --- | --- |
| unknown, draft, paused or archived address | `404 CHURCH_NOT_FOUND` from `resolve` |
| the server does not answer | network error, or no answer in **4 seconds** |
| the server fails | any 5xx |
| the answer is broken | not JSON, `contractVersion` is not 1, or `church.name` is missing |
| the answer is for another address | the site's `window.location.hostname` is not in the answer's `addresses` list |

Rules:
1. **Never another church's look.** The site keeps no copy of a church's settings across addresses. If it caches, the
   cache key is the host name; a failed call does **not** fall back to an old copy, it shows the safe state (Paul's
   rule). A reload tries again.
2. **A broken part is not a broken church.** A field that fails its rule (for example a colour with low contrast) is
   ignored and the OriginalScript default for that field is used, like parse.ts does today. The church stays active.
3. **A language with no allowed text.** If the church has no allowed text for a language, that language reads the
   OriginalScript text for it. The reader is never shown a text whose status is not allowed.
4. The safe state shows no error words, no "church not found" and no church name. It is a normal OriginalScript page.
5. The staff screens never show the safe state; they show the error sentence from Part 6.

Safety test 2 (before any church goes live): for each of unknown, paused and broken (and a fake slow server), the page
at that address is the plain OriginalScript page. Screenshots at 320 px.

---

## Part 8. Reader count

How many people opened the church's reading each day. A number only, no names, no phone numbers, no sign-in.

| Call | Who | Body and answer |
| --- | --- | --- |
| `POST /church/reading-count` | no sign-in | body `{ host }` only; answer `204`. The server finds the church from the address (like `resolve`), adds one to that church's count for today's date, and ignores unknown or inactive addresses (still `204`). The site calls it once per browser per day (it remembers the date on the phone). |
| `GET /admin/churches/{id}/readers?from=&to=` | staff | `{ items: [ { date: "2026-11-21", count: 14 } ] }`, one row per day with a count, dates in UTC |

Stored: church, date, count. Nothing else. (Open question 3: Shalom decides how the count avoids simple abuse.)

### How the site and the staff screen use it (T-167, built 17 Nov)

- **The site** counts a reader when a Daily Bible **reading screen** opens (not only the Today page), on an address that resolved to an **active**
  church (Part 2). Never on `originalscript.org` itself, and never in the safe state (unknown, paused, archived or broken church).
- One call per browser per day: the site writes today's UTC date on the phone **before** sending, so a browser makes one try a day, with no retry.
  A failed call is silent and never disturbs the reading. Without storage (a private window) it is counted once each time the site is opened.
- The call sends the address only: `POST /church/reading-count` with `{ "host": "church.example.org" }`, `Content-Type: application/json`, no sign-in,
  no cookie, no other field.
- **The staff screen** (`/admin/churches/:id`, section "Readers") shows the last 7 or 30 UTC days with `GET /admin/churches/{id}/readers?from=2026-11-15&to=2026-11-21`
  (both ends are days, `yyyy-mm-dd`, the screen assumes both are included). A day with no row is shown as 0. Every staff role may look (Part 5).
- Server please: the site runs on each church's own domain, so the browser calls this API from another origin. The server must answer the
  `POST` from those addresses (CORS), the same as it will for `GET /church/resolve`.

---

## Part 9. What a church's site shows (T-167, pilot features only, built 18 Nov)

A church's site is the same site opened on the church's own address. It shows the church's own pages and **none of OriginalScript's own Bible or study**
(our literal translation, Verse study, Echoes and the rest are ours alone). Nothing here needs a server call: the site decides from what it already knows.

- **A church site** is an address that was found to be an active church (Part 2), or a copy built with its own `src/church/church.json`.
  `originalscript.org` is never a church site, so nothing changes there.
- **Shown:** the Daily Bible (`/daily`, with the church's text and plan; it is always on for a church), Donate (it raises money for OriginalScript: our outreach),
  Settings (language, text size, dark mode), More, Terms, Privacy, Cookies, the language menu and the Feedback box.
- **The home address** opens the Daily Bible.
- **Never shown:** Read, Study, Search, Echoes, Verse dates, Other Scripts, Courses, Degree pathway, Videos, Account, Sources, the admin. An address of any of them shows
  "Not available here", with a button to the church's Daily Bible and a link to originalscript.org.
- **Outreach:** "Go to academic section" in the Daily Bible opens originalscript.org (in the reader's language), and the footer says "Powered by OriginalScript" with the same link.
- **One list for every church** for the pilot (`src/church/features.ts`). A list chosen church by church would need a `features` field in the resolve answer and a checklist on the church screen.
- **Limits:** this decides what the church site shows. Our content server is public, as it is for our own site, so this is not a lock. The page's crawl links to our Read and Study pages are
  removed on a church site by script (a search engine that does not run scripts still sees them).
- **A church address that cannot be loaded** gets the plain OriginalScript site (Part 7), so it also shows our own Bible. See open question 12.

---

## Open questions

1. **Paul or Sir:** is "Malayalam 1910" the same text as the site's `bolls-mov` ("Malayalam Old Version")? What is its
   permission status and where is the written permission kept?
2. **Paul:** may an `editor` save a church's reading plan, or only `admin` and `superadmin`?
3. **Shalom:** where the logo file is stored, and how the reader count avoids abuse.
4. **Shalom:** the test address pattern (for example `NAME.test.originalscript.org`) and whether the test site can answer
   `resolve` for it.
5. **Shalom:** the site sends the host as `?host=`. Is a header better for him? The frontend can send either.
6. **Paul and Shalom:** may a text belong to one church only (`onlyForChurchId`), or is every imported text open to every church once its permission is recorded?
7. **Shalom:** does the existing import (`/admin/imports`) produce an edition the Daily Bible can read from our server, and can it set `source: "originalscript"` and start the status at `unknown`?
8. **Paul:** will a church write its reading plan with English book names only, or also with Malayalam and Hindi names? (The paste screen reads English names and short forms only; Malayalam and Hindi names can be added if a church needs them.)
9. **Paul:** does a church need to change a plan day by day with clicks (a full editor), or is changing the text enough for the pilot? (Paste-in is built; the editor can come later on top of it, nothing to throw away.)
10. **Paul:** what counts as "a reader opened the church's reading"? Built: opening any Daily Bible reading screen on the church's address, once a day per browser. The other choice is only the Today page.
11. **Shalom:** are `from` and `to` both included? What is the longest range one call may ask (the screen asks for 7 or 30 days)? Does the server answer the cross-origin `POST /church/reading-count` from every active church address?
12. **Paul:** when a church's address cannot be loaded (the server is down, or the church is paused), Part 7 shows the plain OriginalScript site, with our own Bible and study. Should it show a plain "This church's site is not available" page instead, so our own Bible never appears on a church's address?

## Test data (what Gokul uses until the API is real)

The stub returns these cases for these hosts, so every screen and the safe state can be tested:

| Host | Answer |
| --- | --- |
| `active.church.test` | `200`, the full example in Part 2 |
| `paused.church.test` | `404 CHURCH_NOT_FOUND` |
| `unknown.church.test` | `404 CHURCH_NOT_FOUND` |
| `broken.church.test` | `200` with `contractVersion: 2` (must show the safe state) |
| `slow.church.test` | no answer for 10 seconds (must show the safe state after 4) |
| `lowcontrast.church.test` | `200`, `colors.accent: "#ffee00"` (colour ignored, church still shown) |

Sample church for `active.church.test`: name "Sample Church", Malayalam default, `sample-church-en` and
`sample-church-ml` texts both `public-domain` (SAMPLE, test only, never shown on a live site), plan "A Psalm a day"
with three days (Psalm 1, Psalm 23, Psalm 119 part 1 of 4).
