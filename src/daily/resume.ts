// "Continue where I stopped" and the text size are kept on this phone only (no login, nothing is sent anywhere).
const RESUME_KEY = "blinkgrid-church.daily.resume.v1";
const SIZE_KEY = "blinkgrid-church.daily.size.v1";

export type DailyPlace = { language: string; book: string; chapter: number; verse?: string };
export const SIZES = [18, 20, 22, 24, 28, 32] as const;
export const DEFAULT_SIZE = 22;

export function readPlace(): DailyPlace | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DailyPlace>;
    return v && typeof v.book === "string" && typeof v.chapter === "number" && typeof v.language === "string"
      ? { language: v.language, book: v.book, chapter: v.chapter, verse: typeof v.verse === "string" ? v.verse : undefined }
      : null;
  } catch {
    return null;
  }
}

export function savePlace(place: DailyPlace) {
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(place));
  } catch {
    /* a private window may refuse; reading still works */
  }
}

export function readSize(): number {
  try {
    const n = Number(window.localStorage.getItem(SIZE_KEY));
    return (SIZES as readonly number[]).includes(n) ? n : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function saveSize(size: number) {
  try {
    window.localStorage.setItem(SIZE_KEY, String(size));
  } catch {
    /* kept for this visit only */
  }
}

export const placePath = (p: DailyPlace) => `/daily/read/${p.book}/${p.chapter}${p.verse ? `?verse=${encodeURIComponent(p.verse)}` : ""}`;
