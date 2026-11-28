import { churchSettings } from "../church/settings";
import { testChurchHost } from "../church/churchStore";
import { placePath, type DailyPlace } from "./resume";

export type SavedVerse = DailyPlace & { verse: string; reference: string };

export function versePath(verse: SavedVerse): string {
  const path = placePath(verse);
  const host = testChurchHost();
  return host ? `${path}&churchHost=${encodeURIComponent(host)}` : path;
}

export function savedVerseKey(verse: SavedVerse): string {
  return placePath(verse);
}

function storageKey(language: string) {
  return `blinkgrid-church.daily.saved-verses.v1:${testChurchHost() ?? churchSettings.address}:${language}`;
}

export function readSavedVerses(language: string): SavedVerse[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(language)) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is SavedVerse =>
      v?.language === language && typeof v.book === "string" && /^[a-z0-9-]+$/i.test(v.book) &&
      Number.isInteger(v.chapter) && v.chapter > 0 && typeof v.verse === "string" &&
      !!v.verse && typeof v.reference === "string"
    ) : [];
  } catch {
    return [];
  }
}

export function setVerseSaved(verse: SavedVerse, saved: boolean): SavedVerse[] {
  const others = readSavedVerses(verse.language).filter((v) => savedVerseKey(v) !== savedVerseKey(verse));
  const next = saved ? [verse, ...others] : others;
  localStorage.setItem(storageKey(verse.language), JSON.stringify(next));
  return next;
}
