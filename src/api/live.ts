import { createRequestCache } from "./requestCache";
import { getAccessToken } from "../staff/auth";
import type { ParallelData } from "../parallel/types";
import type { VerseTimeline } from "../timeline/types";

export const apiBase = (import.meta.env.VITE_API_URL?.trim() || "").replace(
  /\/+$/,
  "",
);
export type Role = { role: "learner" | "editor" | "admin" | "superadmin" | "feedback"; scope: string };
export type ProfileResponse = {
  profile: {
    id: string;
    displayName: string | null;
    fullName: string | null;
    locale: string;
    timezone: string;
    countryCode: string | null;
    status: string;
    settings: Record<string, unknown>;
    settingsVersion: number;
    defaultEditionId: string | null;
    roles: Role[];
  };
  email: string;
  capabilities: {
    saveReading: boolean;
    manageContent: boolean;
    publishContent: boolean;
    reviewFeedback: boolean;
    manageTeam: boolean;
    manageAdmins: boolean;
  };
  /** Whether the reader has agreed to the current Terms and Privacy Policy. */
  consent?: ConsentState;
};
/** The reader's agreement to the Terms of Use and Privacy Policy, as the server records it. */
export type ConsentState = {
  current: string;
  agreedVersion: string | null;
  firstAgreedAt: string | null;
  needed: boolean;
};
export type EditionBook = {
  bookCode: string;
  slug: string;
  name: Record<string, string>;
  testament: "OT" | "NT" | "NC";
  bookVersion: number;
  chapters: number[];
};
export type Edition = {
  id: string;
  code: string;
  name: Record<string, string>;
  languageTag: string;
  scriptCode: string;
  direction: "ltr" | "rtl";
  numbering: string;
  /** "non-canonical" editions are listed on the Non-Canonical tab only. */
  section?: "main" | "non-canonical";
  attribution: Record<string, string>;
  books: EditionBook[];
};
export type Verse = {
  verseId: string;
  verseLabel: string;
  text: string;
  textHash: string;
  /** No English yet: the text shown is the original. */
  noTranslation?: boolean;
  /** No manuscript before 400 CE has this verse (Version 2); the reader shows "Coming soon". */
  notSourced?: boolean;
};
export type LiveChapter = {
  editionCode: string;
  bookCode: string;
  bookSlug: string;
  bookName: Record<string, string>;
  chapterNumber: number;
  bookVersion: number;
  bookVersionId: string;
  /** When this version of the book was uploaded (the "Version 1 · Testing · date" label). */
  publishedAt?: string;
  /** The public release name: "Version 1", "Version 2". */
  release?: string;
  direction: "ltr" | "rtl";
  attribution: Record<string, string>;
  availableChapters: number[];
  studyAvailable: boolean;
  /** Named chapters (Qumran scroll columns); chapter 0 is a prologue. */
  chapterLabels?: Record<string, string> | null;
  languageTag?: string;
  verses: Verse[];
};
/** Which version of a book the signed-in reader is on, and any update on offer. */
export type ReadingState = {
  editionCode: string;
  bookCode: string;
  bookSlug: string;
  bookVersionId: string;
  bookVersion: number;
  position: { chapter: number; verseLabel: string | null } | null;
  update: {
    bookVersion: number;
    bookVersionId: string;
    changeKind: "initial" | "text" | "notes";
    changeNote: string;
    publishedAt: string;
    currentExpiresAt: string | null;
    dismissed: boolean;
  } | null;
  moved: { fromVersion: number; reason: "expired" | "withdrawn" } | null;
};
export type Segment = { verseLabel: string; start: number; end: number; quote: string; textHash: string };
export type Annotation = {
  id: string;
  kind: "bookmark" | "highlight" | "note";
  editionCode: string;
  bookCode: string;
  bookSlug: string;
  bookVersion: number;
  chapter: number;
  verseLabel: string;
  segments: Segment[] | null;
  anchorStatus: "exact" | "moved" | "needs_review";
  color: "amber" | "green" | "blue" | "rose" | null;
  label: string | null;
  body: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export class LiveError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
// ── Slow-service notice ──────────────────────────────────────────────────────
// The free API server sleeps when idle and takes up to a minute to wake. A
// request still running after SLOW_MS counts as slow; ServiceWaking shows a
// notice while any is.
const SLOW_MS = 4000;
let slowRequests = 0;
const slowListeners = new Set<(slow: boolean) => void>();
export function onServiceSlow(listener: (slow: boolean) => void) {
  slowListeners.add(listener);
  listener(slowRequests > 0);
  return () => void slowListeners.delete(listener);
}
const setSlow = (change: number) => {
  slowRequests += change;
  for (const listener of slowListeners) listener(slowRequests > 0);
};

// ── Unreachable-service notice ───────────────────────────────────────────────
// Set when the reading service cannot be reached (a network error, a timeout, or a 502/503/504 after
// the retry, as when the host has paused it) and cleared by its next answer; ServiceDownNotice shows
// a notice while it is set.
let serviceDown = false;
const downListeners = new Set<(down: boolean) => void>();
export function onServiceDown(listener: (down: boolean) => void) {
  downListeners.add(listener);
  listener(serviceDown);
  return () => void downListeners.delete(listener);
}
const setDown = (down: boolean) => {
  if (down === serviceDown) return;
  serviceDown = down;
  for (const listener of downListeners) listener(down);
};

/** The caller's signal and a timeout, as one signal. */
function withTimeout(signal: AbortSignal | null | undefined, ms: number) {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return { signal: timeout, timeout };
  if ("any" in AbortSignal) return { signal: AbortSignal.any([signal, timeout]), timeout };
  const both = new AbortController();
  for (const s of [signal, timeout]) s.addEventListener("abort", () => both.abort(s.reason), { once: true });
  return { signal: both.signal, timeout };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One request to the reading service. Reads wait up to 75 s (a sleeping server
 * takes up to a minute to wake) and are tried once more after a network error
 * or a 502/503/504; writes wait up to 30 s and are never repeated here (writeLive
 * repeats them safely with an idempotency key).
 */
export async function liveRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  // Only the staff area signs in (src/staff/auth.tsx); a church's readers never do.
  if (authenticated) {
    const token = await getAccessToken();
    if (!token) throw new LiveError("Sign in to continue.", "AUTH_REQUIRED", 401);
    headers.set("Authorization", `Bearer ${token}`);
  }
  const read = !options.method || options.method === "GET";
  let counted = false;
  const slow = setTimeout(() => {
    counted = true;
    setSlow(1);
  }, SLOW_MS);
  let response!: Response;
  try {
    for (let attempt = 0; ; attempt++) {
      const { signal, timeout } = withTimeout(options.signal, read ? 75000 : 30000);
      try {
        response = await fetch(`${apiBase}/api/v1${path}`, { ...options, headers, signal });
        if (!(read && attempt === 0 && [502, 503, 504].includes(response.status))) break;
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (timeout.aborted) {
          setDown(true);
          throw new LiveError(
            "The reading service is taking too long to respond. Please try again.",
            "TIMEOUT",
            504,
          );
        }
        if (!read || attempt > 0) {
          setDown(true);
          throw new LiveError(
            "The reading service could not be reached. Check your connection and try again.",
            "SERVICE_UNAVAILABLE",
            503,
          );
        }
      }
      await wait(1500);
      if (options.signal?.aborted) throw options.signal.reason;
    }
  } finally {
    clearTimeout(slow);
    if (counted) setSlow(-1);
  }
  // Any answer other than a gateway failure means the service is there.
  setDown([502, 503, 504].includes(response.status));
  if (response.status === 204) return undefined as T;
  let result;
  try {
    result = await response.json();
  } catch {
    throw new LiveError(
      "The reading service did not respond. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }
  if (!response.ok)
    throw new LiveError(
      result.error?.message || "The request could not be completed.",
      result.error?.code || "REQUEST_FAILED",
      response.status,
    );
  return result;
}
export const bootstrapProfile = (signal?: AbortSignal) =>
  liveRequest<ProfileResponse>(
    "/me/bootstrap",
    { method: "POST", body: "{}", signal },
    true,
  );
const pendingWrites = new Map<string, string>();
export async function writeLive<T>(
  path: string,
  method: string,
  body: unknown,
  key?: string,
): Promise<T> {
  const encoded = JSON.stringify(body),
    fingerprint = method + path + encoded;
  const retryKey = key || pendingWrites.get(fingerprint) || crypto.randomUUID();
  pendingWrites.set(fingerprint, retryKey);
  try {
    const result = await liveRequest<T>(
      path,
      { method, body: encoded, headers: { "Idempotency-Key": retryKey } },
      true,
    );
    pendingWrites.delete(fingerprint);
    return result;
  } catch (e) {
    if (e instanceof LiveError && e.status < 500)
      pendingWrites.delete(fingerprint);
    throw e;
  }
}
/** Loads every page of the reader's annotations matching a query string. */
export async function allAnnotations(query: string, signal?: AbortSignal) {
  const items: Annotation[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: Annotation[]; nextCursor: string | null } = await liveRequest(
      `/me/annotations?${query}&limit=100${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      { signal },
      true,
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && !signal?.aborted);
  return items;
}

// ── Shared, cached reads ─────────────────────────────────────────────────────
// The catalogue is fetched once per visit and shared by every page; chapters
// already read are kept. A chapter at a versioned address never changes, so it
// is kept for the visit; the current version of a chapter for a minute.
const cache = createRequestCache(200);
const CATALOGUE_MS = 5 * 60000,
  CURRENT_MS = 60000;
const chapterAge = (path: string) => (path.includes("/versions/") ? Infinity : CURRENT_MS);

/** Every published edition with its books, shared across the site. */
export const getEditions = (signal?: AbortSignal) =>
  cache
    .get("/editions", () => liveRequest<{ items: Edition[] }>("/editions"), CATALOGUE_MS, signal)
    .then((r) => r.items);
/** The catalogue if it has already arrived, so a page can render without waiting. */
export const peekEditions = () => cache.peek<{ items: Edition[] }>("/editions", CATALOGUE_MS)?.items;

export function chapterPath(edition: string, book: string, chapter: number | string, version?: number) {
  const base = `/editions/${encodeURIComponent(edition)}/books/${encodeURIComponent(book)}`;
  return `${base}${version ? `/versions/${version}` : ""}/chapters/${chapter}`;
}
export const getChapter = (path: string, signal?: AbortSignal) =>
  cache.get(path, () => liveRequest<LiveChapter>(path), chapterAge(path), signal);

// A verse's study and its Parallel & Opposite links: kept for the visit's back-and-forth
// between linked verses, and fetched together (or ahead, when the reader points at a verse).
const versePath = (edition: string, verseId: string, part: "study" | "parallels") =>
  `/editions/${encodeURIComponent(edition)}/verses/${encodeURIComponent(verseId)}/${part}`;
export const getStudy = <T,>(edition: string, verseId: string, signal?: AbortSignal) => {
  const path = versePath(edition, verseId, "study");
  return cache.get(path, () => liveRequest<T>(path), CATALOGUE_MS, signal);
};
export const getParallels = (edition: string, verseId: string, signal?: AbortSignal) => {
  const path = versePath(edition, verseId, "parallels");
  return cache.get(path, () => liveRequest<ParallelData>(path), CURRENT_MS, signal);
};
/** When the verse's incident happened and when it was written (docs/TIMELINE-API.md). A verse the files do not cover answers 200 with no rows. */
export const getTimeline = (edition: string, verseId: string, signal?: AbortSignal) => {
  const path = `/editions/${encodeURIComponent(edition)}/verses/${encodeURIComponent(verseId)}/timeline`;
  return cache.get(path, () => liveRequest<VerseTimeline>(path), CATALOGUE_MS, signal);
};
/** Starts loading a verse's study page (study and links) so opening it is instant. */
export function prefetchVerse(edition: string, verseId: string) {
  void getStudy(edition, verseId).catch(() => {});
  void getParallels(edition, verseId).catch(() => {});
}
export const peekChapter = (path: string) => cache.peek<LiveChapter>(path, chapterAge(path));
/** Loads a chapter in the background so opening it is instant. */
export const prefetchChapter = (path: string) => void getChapter(path).catch(() => {});

/** What a signed-in reader needs to open a chapter, from one request. */
export type ChapterReading = {
  reading: ReadingState;
  chapter: LiveChapter;
  annotations: Annotation[];
  annotationsComplete: boolean;
};
export async function readChapterSignedIn(
  edition: string,
  book: string,
  chapter: number | string,
  signal?: AbortSignal,
): Promise<ChapterReading> {
  const path = `/me/reading/${encodeURIComponent(edition)}/${encodeURIComponent(book)}/chapters/${chapter}`;
  let result: ChapterReading;
  try {
    result = await liveRequest<ChapterReading>(path, { signal }, true);
  } catch (e) {
    // A profile is created once, on the first signed-in read.
    if (!(e instanceof LiveError && e.code === "PROFILE_NOT_BOOTSTRAPPED")) throw e;
    await bootstrapProfile(signal);
    result = await liveRequest<ChapterReading>(path, { signal }, true);
  }
  cache.set(chapterPath(edition, book, chapter, result.reading.bookVersion), result.chapter);
  return result;
}

/** One verse found by the word search, with its book. */
export type WordHit = {
  verseId: string;
  bookCode: string;
  bookSlug: string;
  bookName: Record<string, string> | null;
  chapter: number;
  verseLabel: string;
  text: string;
};
export type WordSearch = {
  editionCode: string | null;
  languageTag: string;
  /** The words searched (Malayalam ones without their changing last letter), for highlighting. */
  words: string[];
  total: number;
  items: WordHit[];
  nextOffset: number | null;
};
/** Verses containing the words, in the language the words are written in. */
export function searchWords(q: string, offset = 0, signal?: AbortSignal) {
  return liveRequest<WordSearch>(`/search?q=${encodeURIComponent(q)}&offset=${offset}`, { signal });
}

/** Records that the reader agreed to the current Terms and Privacy Policy (version from the server). */
export function agreeToTerms(version: string) {
  return writeLive<ConsentState>("/me/consents", "POST", { version });
}
