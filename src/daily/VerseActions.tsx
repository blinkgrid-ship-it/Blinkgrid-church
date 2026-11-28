import { useId, useLayoutEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Share2, X } from "lucide-react";
import { useUI } from "../Platform";
import { shareableUrl } from "../lang/urlLanguage";
import { readSavedVerses, savedVerseKey, setVerseSaved, versePath, type SavedVerse } from "./verseBookmarks";

export function VerseActions({ verse, onClose, onSaved }: {
  verse: SavedVerse;
  onClose: () => void;
  onSaved: (verses: SavedVerse[]) => void;
}) {
  const { t } = useUI();
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(() => readSavedVerses(verse.language).some((v) => savedVerseKey(v) === savedVerseKey(verse)));
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const url = shareableUrl(versePath(verse), verse.language);
  const canShare = typeof navigator.share === "function";

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setManualCopy(false);
      setStatus(t("daily:verseLinkCopied"));
    } catch {
      setManualCopy(true);
      setStatus(t("daily:verseLinkManual"));
    }
  }

  async function shareLink() {
    setSharing(true);
    setStatus("");
    try {
      await navigator.share({ title: verse.reference, url });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) await copyLink();
    } finally {
      setSharing(false);
    }
  }

  function toggleSave() {
    try {
      onSaved(setVerseSaved(verse, !saved));
      setStatus(t(saved ? "daily:verseRemoved" : "daily:verseSaved"));
      setSaved(!saved);
    } catch {
      setStatus(t("daily:verseSaveFailed"));
    }
  }

  return (
    <dialog
      ref={dialog}
      className="dl-verse-dialog"
      aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="dl-verse-panel">
        <header>
          <h2 id={heading}>{verse.reference}</h2>
          <button type="button" className="dl-icon-action" aria-label={t("daily:verseActionsClose")} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <button type="button" className="os-secondary" onClick={toggleSave}>
          {saved ? <BookmarkCheck size={20} aria-hidden="true" /> : <Bookmark size={20} aria-hidden="true" />}
          {t(saved ? "daily:removeSavedVerse" : "daily:saveVerse")}
        </button>
        {canShare && (
          <button type="button" className="os-secondary" disabled={sharing} onClick={() => void shareLink()}>
            <Share2 size={20} aria-hidden="true" />
            {t("daily:shareVerseLink")}
          </button>
        )}
        <button type="button" className="os-secondary" onClick={() => void copyLink()}>
          <Copy size={20} aria-hidden="true" />
          {t("daily:copyVerseLink")}
        </button>
        <p className="dl-verse-status" role="status">{status}</p>
        {manualCopy && <input readOnly value={url} aria-label={t("daily:verseLink")} onFocus={(event) => event.currentTarget.select()} />}
      </div>
    </dialog>
  );
}
