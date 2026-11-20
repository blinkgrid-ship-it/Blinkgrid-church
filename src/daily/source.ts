// Where the Daily Bible reads its text from. The edition code a language (or a church) is set to decides it:
// a code listed in universal.ts is read from the open Bible service; any other code is read from OriginalScript's own server.
import { chapterPath, getChapter, getEditions } from "../api/live";
import { isUniversal, universalBooks, universalChapter, type UniversalBook, type UniversalChapter } from "./universal";

export type DailyBook = UniversalBook;
export type DailyChapter = UniversalChapter | (Awaited<ReturnType<typeof getChapter>> & { languageTag?: string });

export async function dailyBooks(edition: string, signal?: AbortSignal): Promise<DailyBook[]> {
  if (isUniversal(edition)) return universalBooks(edition);
  const editions = await getEditions(signal);
  return (editions.find((e) => e.code === edition)?.books ?? []).map((b) => ({ slug: b.slug, bookCode: b.bookCode, name: b.name, chapters: b.chapters }));
}

export function dailyChapter(edition: string, slug: string, chapter: number, signal?: AbortSignal): Promise<DailyChapter> {
  return isUniversal(edition) ? universalChapter(edition, slug, chapter, signal) : getChapter(chapterPath(edition, slug, chapter), signal);
}
