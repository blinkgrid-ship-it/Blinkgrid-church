import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import { Row, useUI } from "../Platform";
import { readSavedVerses, savedVerseKey, setVerseSaved, versePath, type SavedVerse } from "./verseBookmarks";

export function SavedVerses({ language }: { language: string }) {
  const { t } = useUI();
  const [verses, setVerses] = useState(() => readSavedVerses(language));
  const [status, setStatus] = useState("");

  function remove(verse: SavedVerse) {
    try {
      setVerses(setVerseSaved(verse, false));
      setStatus(t("daily:verseRemoved"));
    } catch {
      setStatus(t("daily:verseSaveFailed"));
    }
  }

  if (!verses.length && !status) return null;

  return (
    <section className="dl-saved" aria-labelledby="dl-saved-title">
      <h2 id="dl-saved-title">{t("daily:savedVerses")}</h2>
      {verses.length > 0 ? (
        <ul>
          {verses.map((verse) => (
            <li key={savedVerseKey(verse)}>
              <Row to={versePath(verse)} title={verse.reference} icon={<Bookmark size={20} />} />
              <button
                type="button"
                className="dl-icon-action"
                aria-label={t("daily:removeVerseReference", { reference: verse.reference })}
                onClick={() => remove(verse)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p>{t("daily:noSavedVerses")}</p>}
      <p className="dl-verse-status" role="status">{status}</p>
    </section>
  );
}
