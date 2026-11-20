# Interface text

Every word of the interface comes from here through react-i18next (`src/i18n.ts`). One folder per
language, one file per area of the site; each file maps a key to the text shown on screen. Bible
text and other content (course titles, book names) is not here; it comes from the API and content
files and is chosen with `pick()`.

| File | Area |
| --- | --- |
| `common.json` | Header, menus, language menu, reader settings, shared labels, Platform pages |
| `home.json` | Home page |
| `reader.json` | Reader and verse-study pages |
| `account.json` | Sign in and account |
| `courses.json` | Courses, modules, lessons, practice tests |
| `pathway.json` | Degree pathway, credits, certificate, institutions |
| `comingsoon.json` | Coming Soon, Donate and Support pages |
| `nc.json` | Other Scripts |
| `feedback.json` | Feedback box and welcome card |
| `study.json` | My study record and learning portfolio |
| `research.json` | Named Gods research pages |
| `videos.json` | Videos and video quizzes |
| `admin.json` | Admin imports and feedback inbox |

## Using a key

```tsx
const { t } = useUI();                       // or useTranslation() from react-i18next
<button>{t("common:startReading")}</button>
t("reader:switchToVersion", { version: 3 }) // fills {{version}}
t("courses:cooldownActive", { count: 2 })   // picks cooldownActive_one / _other
```

Write keys in full `"namespace:key"` form. Add a new key to **all** language files; `npm test`
(`tests/locales.test.mjs`) fails if a language is missing a key, a placeholder differs, or the code
names a key English does not have.

## Adding a language

The one list of languages is `src/lang/languages.ts` (name, code, language tag). The menus,
the Feedback box and the Donate page all read it. A language that is not "full" has only the Donate
and Feedback words. It is chosen with the language box on those two pages (one remembered choice,
shared), never in the site-wide menu, it is never the site's language, and a phone set to it is not
sent to it. A link such as `/sw/donate` opens Donate in Swahili on the English site.

1. Add a line to `src/lang/languages.ts` (`partial("sw", "Kiswahili", "Swahili")`).
2. Add a column with the language's name (as written in `languages.ts`) to the translations sheet
   "Donate and feedback wordings" and fill it.
3. In the sheet choose File > Download > CSV, then run:

   ```
   npm run translations:load -- "<the downloaded file>.csv" --dry-run   # shows what would change
   npm run translations:load -- "<the downloaded file>.csv"             # writes the language files
   ```

   Only the lines in the sheet are written (a new folder under `src/locales/<code>/`). English,
   Malayalam and Hindi are the site's own text and are never overwritten unless you add
   `--include=ml,hi`; `--add-missing=en,ml,hi` lets a brand-new line come in from the sheet when
   Malayalam and Hindi have it too. A cell whose `{{placeholders}}` or `<tags>` differ from English
   is skipped and listed.
4. `npm test` and rebuild.

Copying the whole `en` folder (the old way) still works for a language that is translated in full:
mark it `full: true` in `languages.ts`. Malayalam and Hindi pages need their fonts (`main.tsx`); a
new script may need one too (the other scripts use the reader's own phone font until then).

## Review status

Where the site already had Malayalam, that Malayalam was kept. The rest of `ml`, and all of `hi`,
is machine translation and needs a review by a native reader.
