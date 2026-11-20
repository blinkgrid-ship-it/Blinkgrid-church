# Copied from OriginalScript, and what was removed (19 Nov 2026)

Source: branch `church-reading-plan` of the OriginalScript frontend (no git history copied).

## Copied (unchanged unless noted)
- Church lookup by address: `src/church/` (`churchStore`, `resolve`, `parse`, `settings`, `applyColors`, `readerCount`, `stubChurches`). Changed: default name "Daily Bible", default address theblinkgrid.com, no Hindi in the default texts, no list of OriginalScript's own addresses, an address that is not an active church now sets `churchUnavailable`.
- Daily Bible: `src/daily/` (page, reader, plans, today's plan, pause screen, universal and own text sources).
- Language: `src/lang/`, `src/i18n.ts`, `src/locales/` (English, Malayalam, Hindi only).
- Small parts: `src/ui/` (Notice, Dropdown, Skeleton, ErrorBoundary), `src/nav/BackLink`, `src/api/live.ts` (church and Bible calls only), styles `platform.css`, `core.css`, fonts.
- Church tests: church features, settings, resolve, reader count, daily plans, locales; browser tests `e2e/church-site.spec.ts` (rewritten).

## New
- `src/Platform.tsx`: a small shell written for the church site (about 430 lines; OriginalScript's was 2,500). Reading settings page and language menu are simplified copies.

## Removed
- Every OriginalScript page and feature: Bible reader, study, search, courses, pathway, videos, account and sign-in, admin screens (including `/admin/churches`), feedback box, cookie banner, analytics, consent gate, Donate and support pages, Sources, Other Scripts.
- "Powered by OriginalScript" footer line, "Go to academic section" links (Daily Bible page and reader), the "Open originalscript.org" link on the not-available page, "Beta testing version" and "© Eastern Theology Inc" lines, the Donate row in More, the Donate address.
- Terms, Privacy and Cookies pages (OriginalScript's text). Church legal pages wait for Blinkgrid's neutral text (open: Paul / Sir).
- All other interface languages and every text line the church site does not use (from about 2,050 lines to about 70 in English).
- OriginalScript's account code (Supabase) and its dependency; the `zod`, `exceljs`, axe test and Hebrew font dependencies.
- OriginalScript's build scripts, content import, research data, images, sitemap, `og-image`, docs, tests and about 50 browser tests.

## Still to do / open
- Words still naming OriginalScript only in code comments and in `docs/CHURCH-COPY.md` and the contract file (they describe the old setup).
- `src/nc/names.ts` (book names for Other Scripts) is still imported by the Daily Bible for book names; check it shows nothing from OriginalScript.
- The new not-available line ("This page is not available.") and the new temporary-translation line are new Malayalam and Hindi words: Jincy / Teeja to check.
- Staff console, reader count on the server, logo upload, git repository name and Render sites: waiting on answers (see the doubts list).

## Staff area added (19 Nov 2026, Paul chose "option B")
- `/staff` inside this project (not on any church's own pages): sign-in, then the churches list, new/edit church (names, colours, default language, addresses, status), Bible text per language, reading plan, readers. Copied from OriginalScript's `/admin/churches` screens into `src/staff/` and changed: own sign-in (`src/staff/auth.tsx`, email and password, its own saved session), access from the server's `capabilities.manageChurches` (church staff), links `/staff...`, wording without OriginalScript or "administrators".
- Shows on any address; the server decides who may use it. With `VITE_CHURCH_RESOLVE=api` it saves on the server; in a stub build churches are kept in the browser.
- Not tried against the real server yet (no test copy of the backend). Sign-in itself is not tried (needs a real staff account); browser tests fake a saved session.
- Still to check against Shalom's real answers (his task 12): plan start date, repeats and time zone, addresses, problem words.
