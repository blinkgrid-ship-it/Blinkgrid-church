// The verse timeline API (originalscript-backend docs/TIMELINE-API.md): when the incident of a verse happened, and when
// the verse was written, with the evidence. BC years are negative; there is no year 0. Every text is plain text.

export type Years = { earliest: number | null; latest: number | null; best: number | null };

export type TimelineEvidence = {
  text: string | null;
  logic: string | null;
  archaeology: string | null;
  writings: string | null;
  science: string | null;
  materialClues: string | null;
};

export type TimelineRow = {
  /** The language of the texts; English until more are loaded. */
  language: string;
  eventNo: string | null;
  whatDates: string | null;
  /** The file's own wording ("520 BC", "AD 60 - AD 90", "undated"); shown as it is. */
  dateReadable: string | null;
  years: Years;
  /** Years counted from the birth of Jesus. */
  fromBirth: Years;
  /** "A" to "D", or null. */
  confidence: string | null;
  monthDay: string | null;
  evidence: TimelineEvidence;
  referredEvent: string | null;
  mentionedElsewhere: string | null;
  discrepancies: string | null;
  textStatus: string | null;
};

export type SameEvent = { ref: string; bookCode: string; bookSlug: string; chapter: number; verse: string };

export type VerseTimeline = {
  editionCode: string;
  verseId: string;
  bookCode: string;
  chapter: number;
  verse: string;
  birthYear: number | null;
  incident: TimelineRow | null;
  written: TimelineRow | null;
  sameEvent?: SameEvent[];
  sameEventTotal?: number;
};

/** True when the verse has at least one date row to show. */
export const hasDates = (t: VerseTimeline | null | undefined): t is VerseTimeline => !!t && (!!t.incident || !!t.written);
