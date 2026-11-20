import type { MessageKey } from "../i18n";

// The three starter plans (Paul's brief, item 5; pick A for Sir). A plan is a list of days; a day is one or two readings;
// a reading is a whole chapter, or one part of a chapter ("part 1 of 2"). Only chapters and parts are named here, never any
// Bible words, so a church can change a plan without touching the text. A church's own list of readings replaces these (item 8).
export type Reading = { book: string; chapter: number; part?: [number, number] };
export type Plan = { id: string; title: MessageKey | Record<string, string>; days: Reading[][] };

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Mark has 16 chapters. Over 30 days: chapters 2 and 16 (the shortest) are read whole and the other 14 in two parts: 14 x 2 + 2 = 30.
const MARK_WHOLE = new Set([2, 16]);
const mark30: Reading[][] = range(16).flatMap((chapter) =>
  MARK_WHOLE.has(chapter)
    ? [[{ book: "mark", chapter }]]
    : [
        [{ book: "mark", chapter, part: [1, 2] as [number, number] }],
        [{ book: "mark", chapter, part: [2, 2] as [number, number] }],
      ],
);

// One Psalm and one Proverb a day for the 150 Psalms; Proverbs (31 chapters) start again after chapter 31.
const psalmsProverbs: Reading[][] = range(150).map((n) => [
  { book: "psalms", chapter: n },
  { book: "proverbs", chapter: ((n - 1) % 31) + 1 },
]);

// One Gospel chapter a day (Matthew 28, Mark 16, Luke 24, John 21 = 89 days), each with the next Psalm.
const GOSPELS: [string, number][] = [["matthew", 28], ["mark", 16], ["luke", 24], ["john", 21]];
const gospelPsalm: Reading[][] = GOSPELS.flatMap(([book, chapters]) => range(chapters).map((chapter) => ({ book, chapter }))).map(
  (gospel, i) => [gospel, { book: "psalms", chapter: i + 1 }],
);

export const starterPlans: Plan[] = [
  { id: "mark30", title: "daily:planMark30", days: mark30 },
  { id: "psalmsProverbs", title: "daily:planPsalmsProverbs", days: psalmsProverbs },
  { id: "gospelPsalm", title: "daily:planGospelPsalm", days: gospelPsalm },
];

export const readingPath = (r: Reading) => `/daily/read/${r.book}/${r.chapter}${r.part ? `?part=${r.part[0]}of${r.part[1]}` : ""}`;
