/**
 * Parallel & Opposite: the links from one verse to other verses that carry the same
 * idea (echoes) or the opposite idea (contrasts).
 *
 * Contract this screen reads (the backend owns it; see originalscript-backend
 * docs/PARALLELS-API.md):
 *   GET /api/v1/editions/:edition/verses/:verseId/parallels  ->  ParallelData
 * When the request fails the section says "coming soon"; nothing is invented.
 */

/** A date with the kind of evidence behind it: traditional, scholarly or scientific. */
export type ParallelDate = { range: string; basis?: "traditional" | "scholarly" | "scientific" | string };

export type ParallelItem = {
  /** Display reference in the reader's language, e.g. "John 1:1". */
  ref: string;
  /** English book slug, e.g. "john". Used to open the verse. */
  bookSlug: string;
  chapter: number;
  verse: string;
  testament: "OT" | "NT";
  /** Contrasts only: 4 = direct reversal ... 1 = tension. Echoes carry none. */
  strength?: 1 | 2 | 3 | 4;
  /** The linked verse's own text, with [added words] in brackets. */
  text?: string;
  /** Who speaks and to whom, as the text itself frames it. */
  speaker?: string;
  audience?: string;
  /** When the events happened and when the text was written. */
  happened?: ParallelDate;
  written?: ParallelDate;
  /** Short note on how the verse relates (plain words, English until translated). */
  note?: string;
  /** Why it echoes or contrasts. */
  why?: string;
  /**
   * Echoes & Contrasts lines (backend migration 028, docs/PARALLELS-API.md). A link with a line also carries these.
   * The text may hold familiar-name tags {f|...} and {fa|...|...}; they stay hidden until the tag switch is on.
   */
  /** Why the two verses contrast or echo. */
  whyLine?: string;
  /** Who speaks to whom, in the linked verse and in the reference (the verse being studied). */
  linkedSpeaker?: string;
  referenceSpeaker?: string;
  /** Identity, context and dates. English only. */
  contextLine?: string;
  /** "ml" when the edition's language has the line, otherwise "en" (then the screen says English is shown). */
  lineLanguage?: string;
  /** The file's own status, for example "AI draft 2026-11-02 · uploaded as draft". */
  lineStatus?: string;
  /** True while the status says draft. */
  lineDraft?: boolean;
  /** True when the cited text is in the site's library, false when only cited. */
  inLibrary?: boolean;
  /** When known, opens the verse study directly; otherwise the chapter reader opens. */
  verseId?: string;
  /** Edition the target verse is opened in (defaults to the current edition). */
  edition?: string;
};

export type ParallelData = {
  echoes: ParallelItem[];
  contrasts: ParallelItem[];
  /** New Testament links, shown apart from the Old Testament ones. */
  newTestament: ParallelItem[];
  /** For a verse without links: Sir's short note on it, in `noteLanguage` (English for now). */
  note?: string | null;
  noteLanguage?: string | null;
};
