// The universal Bible for the Daily Bible door: three familiar texts (KJV in English, the Malayalam Old Version, the Hindi Old
// Version) read from an open Bible service (bolls.life), not from OriginalScript's own server. Nothing here is OriginalScript's
// own translation, and the screen says where the words come from (CLAUDE.md guardrails 5 and 9).
//
// LICENCE: the KJV is public domain. The status of the Malayalam and Hindi texts is NOT confirmed. Paul and Sir must give a
// written OK for each before the Daily Bible goes live (licenceConfirmed below stays false until then).
//
// A church that reads another Bible sets its own edition code in src/church/church.json (dailyText); a code that is not listed
// here is read from OriginalScript's own server instead (see source.ts).

const API = "https://bolls.life";

export type UniversalText = { bolls: string; languageTag: string; attribution: Record<string, string>; licenceConfirmed: boolean };

export const UNIVERSAL: Record<string, UniversalText> = {
  "bolls-kjv": {
    bolls: "KJV",
    languageTag: "en",
    licenceConfirmed: true,
    attribution: {
      en: "King James Version (public domain). Text from bolls.life.",
      ml: "കിങ് ജെയിംസ് പതിപ്പ് (പൊതുസഞ്ചയം). പാഠം bolls.life-ൽ നിന്ന്.",
      hi: "किंग जेम्स संस्करण (सार्वजनिक डोमेन)। पाठ bolls.life से।",
    },
  },
  "bolls-mov": {
    bolls: "MOV",
    languageTag: "ml",
    licenceConfirmed: false,
    attribution: {
      en: "Malayalam Sathyavedapusthakam, Old Version. Text from bolls.life.",
      ml: "സത്യവേദപുസ്തകം, പഴയ പതിപ്പ് (മലയാളം). പാഠം bolls.life-ൽ നിന്ന്.",
      hi: "मलयालम सत्यवेदपुस्तकम्, पुराना संस्करण। पाठ bolls.life से।",
    },
  },
  "bolls-hiov": {
    bolls: "HIOV",
    languageTag: "hi",
    licenceConfirmed: false,
    attribution: {
      en: "Hindi Old Version, re-edited (Bible Society of India). Text from bolls.life.",
      ml: "ഹിന്ദി പഴയ പതിപ്പ്, പുനഃപരിശോധിച്ചത് (ബൈബിൾ സൊസൈറ്റി ഓഫ് ഇന്ത്യ). പാഠം bolls.life-ൽ നിന്ന്.",
      hi: "हिन्दी पुराना संस्करण, पुनः संपादित (भारतीय बाइबल सोसाइटी)। पाठ bolls.life से।",
    },
  },
};

export const isUniversal = (edition: string | undefined): boolean => !!edition && edition in UNIVERSAL;

// The 66 books in the order the service numbers them (1 to 66), with the slugs the rest of OriginalScript uses.
export const CANON = [
  "genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth", "1-samuel", "2-samuel", "1-kings", "2-kings",
  "1-chronicles", "2-chronicles", "ezra", "nehemiah", "esther", "job", "psalms", "proverbs", "ecclesiastes", "song-of-songs", "isaiah",
  "jeremiah", "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum", "habakkuk",
  "zephaniah", "haggai", "zechariah", "malachi", "matthew", "mark", "luke", "john", "acts", "romans", "1-corinthians", "2-corinthians",
  "galatians", "ephesians", "philippians", "colossians", "1-thessalonians", "2-thessalonians", "1-timothy", "2-timothy", "titus",
  "philemon", "hebrews", "james", "1-peter", "2-peter", "1-john", "2-john", "3-john", "jude", "revelation",
] as const;

export type UniversalBook = { slug: string; bookCode: string; name: Record<string, string>; chapters: number[] };
export type UniversalVerse = { verseId: string; verseLabel: string; text: string; notes?: string[] };
export type UniversalChapter = { verses: UniversalVerse[]; direction: "ltr"; attribution: Record<string, string>; languageTag: string; studyAvailable: false };

/** The translators' margin notes the service sends as <sup>…</sup>, taken out of the verse so they can be shown apart (words are kept as sent). */
export function splitNotes(raw: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const rest = raw.replace(/<sup>([\s\S]*?)<\/sup>/gi, (_m, note: string) => {
    const n = cleanVerse(note);
    if (n) notes.push(n);
    return " ";
  });
  return { text: cleanVerse(rest), notes };
}

/** Plain words only: the service sends its own markup (Strong's numbers, line breaks) inside the verse. */
export function cleanVerse(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<S>[^<]*<\/S>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

// A chapter read once stays on this phone, so it still opens if the service is down or the phone is offline.
const KEEP = 60;
const INDEX = "blinkgrid-church.daily.universal.index";
function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    const index: string[] = JSON.parse(localStorage.getItem(INDEX) ?? "[]").filter((k: string) => k !== key);
    index.push(key);
    while (index.length > KEEP) localStorage.removeItem(index.shift() as string);
    localStorage.setItem(INDEX, JSON.stringify(index));
  } catch {
    /* storage full or blocked: reading still works without the keepsake */
  }
}
function recall<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`The Bible service answered ${res.status}`);
  return (await res.json()) as T;
}

const bookLists = new Map<string, Promise<UniversalBook[]>>();
// The list is shared by every screen that asks for it, so one screen leaving must not cancel it for the others: no signal here.
export function universalBooks(edition: string): Promise<UniversalBook[]> {
  const text = UNIVERSAL[edition];
  if (!text) return Promise.reject(new Error("Unknown Bible text"));
  const cached = bookLists.get(edition);
  if (cached) return cached;
  const key = `blinkgrid-church.daily.universal.books.${edition}`;
  const request = getJson<{ bookid: number; name: string; chapters: number }[]>(`${API}/get-books/${text.bolls}/`)
    .then((rows) => {
      const books = rows
        .filter((r) => r.bookid >= 1 && r.bookid <= CANON.length)
        .sort((a, b) => a.bookid - b.bookid)
        .map<UniversalBook>((r) => ({
          slug: CANON[r.bookid - 1],
          bookCode: CANON[r.bookid - 1].toUpperCase(),
          name: { [text.languageTag]: r.name },
          chapters: Array.from({ length: r.chapters }, (_, i) => i + 1),
        }));
      remember(key, books);
      return books;
    })
    .catch((e) => {
      const kept = recall<UniversalBook[]>(key);
      if (kept) return kept;
      bookLists.delete(edition);
      throw e;
    });
  bookLists.set(edition, request);
  return request;
}

export async function universalChapter(edition: string, slug: string, chapter: number, signal?: AbortSignal): Promise<UniversalChapter> {
  const text = UNIVERSAL[edition];
  const id = CANON.indexOf(slug as (typeof CANON)[number]) + 1;
  if (!text || id < 1) throw new Error("Unknown book");
  const key = `blinkgrid-church.daily.universal.${edition}.${slug}.${chapter}`;
  const shape = (verses: UniversalVerse[]): UniversalChapter => ({
    verses,
    direction: "ltr",
    attribution: text.attribution,
    languageTag: text.languageTag,
    studyAvailable: false,
  });
  try {
    const rows = await getJson<{ verse: number; text: string }[]>(`${API}/get-text/${text.bolls}/${id}/${chapter}/`, signal);
    const verses = rows
      .map((r) => {
        const { text: words, notes } = splitNotes(r.text);
        return { verseId: `${slug}-${chapter}-${r.verse}`, verseLabel: String(r.verse), text: words, ...(notes.length ? { notes } : {}) };
      })
      .filter((v) => v.text);
    if (!verses.length) throw new Error("The Bible service sent an empty chapter");
    remember(key, verses);
    return shape(verses);
  } catch (e) {
    if (signal?.aborted) throw e;
    const kept = recall<UniversalVerse[]>(key);
    if (kept) return shape(kept);
    throw e;
  }
}
