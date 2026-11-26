# Giving page (26 Nov 2026, Paul's Thursday goal)

The church site has a **Giving** page (`/give`, tab "Giving" in the bottom bar). It only SHOWS what the church gave: its own giving link and/or its bank details. **No payment goes through this site and it keeps nothing**: the link opens the church's own page in a new tab, and the bank details are copied by the reader. There is no payment code.

## What the page needs from the server (not built yet: front end only)

`GET /church/resolve` may add an optional `giving` object to `church`. A church without it simply has no Giving tab.

```json
"giving": {
  "link": "https://give.example.org/now",
  "bank": {
    "accountName": "…", "bankName": "…", "branch": "…",
    "accountNumber": "…", "ifsc": "…", "swift": "…", "upi": "…"
  },
  "note": "A short line from the church (optional)"
}
```

Rules the site applies (`parseGiving` in `src/church/parse.ts`; a bad part is dropped, the rest stays):

- `link`: an **https** address only (never `javascript:` or plain `http:`), no password in it, at most 500 characters.
- each `bank` field: plain text, at most 120 characters; unknown fields are ignored.
- `note`: at most 300 characters.
- nothing usable (no link and no bank field): no Giving page at all.

The staff screen has no fields for these yet (they wait for the server). Until the server sends them, **a test site shows SAMPLE details** (`src/church/demoGiving.ts`, marked `sample: true`, with a notice on the page) for any church that has none. A real build (without `VITE_ALLOW_TEST_HOST`) never shows sample details.
