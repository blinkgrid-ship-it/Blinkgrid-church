# Blinkgrid church site

One site for every church: the web address decides which church it is (`stmarys.theblinkgrid.com`). It shows the church's name, logo and colours, its Bible text, its reading plan (the Daily Bible), and the language and reading settings. Nothing else.

This is a separate project from OriginalScript. It shares only the backend (Shalom's church routes). It shows no OriginalScript content, links or Donate page.

## Run

```powershell
npm install
$env:VITE_CHURCH_RESOLVE='stub'; npm run dev
```

Open `http://localhost:5173/en/?churchHost=active.church.test` (a sample church from `src/church/stubChurches.ts`). Without `VITE_CHURCH_RESOLVE` the site runs on `src/church/church.json`.

| Setting | Meaning |
| --- | --- |
| `VITE_CHURCH_RESOLVE=api` | Ask the backend which church this address is (live) |
| `VITE_CHURCH_RESOLVE=stub` | Use the test churches in `src/church/stubChurches.ts` |
| `VITE_API_URL` | The church backend's address |

## Check

```powershell
npx tsc --noEmit -p .
npm test
$env:VITE_CHURCH_RESOLVE='stub'; npm run build
npx playwright test --config=playwright.church.config.ts
```

## Where things are

- `src/Platform.tsx`: the shell (header, language menu, pages, settings, bottom bar)
- `src/church/`: church lookup by address, name, logo, colours, reader count (browser stand-in)
- `src/daily/`: the Daily Bible (reading plan, reader)
- `src/locales/`: English, Malayalam, Hindi text (every new line needs all three; `npm test` checks)
- `docs/CHURCH-COPY.md`, `docs/contracts/CHURCH-SETUP-contract.md`: older notes from when this lived inside OriginalScript. They still mention OriginalScript and the admin screens; read them for the church settings shape and the server contract, not for the site's pages.
- `src/staff/`: the staff area at `/staff` (sign-in, churches, plan, texts, readers)
- `docs/COPIED-AND-REMOVED.md`: what was copied from OriginalScript and what was removed (19-20 Nov 2026)
