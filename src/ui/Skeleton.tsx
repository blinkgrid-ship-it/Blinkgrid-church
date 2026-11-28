import { useTranslation } from "react-i18next";
import "./skeleton.css";

/**
 * What a reader sees while a page or a list is on its way, in place of the words "Loading…": grey
 * blocks in the shape of the content that is coming, so the page keeps its size and nothing jumps
 * when the content arrives. Full-page variants carry `os-route-loading`, so the footer waits for them too
 * (platform.css). Screen readers get the words ("Loading…", or the label given); the blocks are hidden from them.
 *
 *  - "page":   a heading and a few lines of text (a course, a study page, most pages).
 *  - "list":   rows with an icon and a title (the book lists, saved reading).
 *  - "reader": the Book / Chapter / Verse boxes, the heading and a few verses.
 *  - "row": a single inline navigation placeholder.
 */
export type SkeletonKind = "page" | "list" | "reader" | "row";

export function Skeleton({ kind = "page", label }: { kind?: SkeletonKind; label?: string }) {
  const { t } = useTranslation();
  return (
    <div className={`os-skel ${kind === "row" ? "os-skel-inline" : `os-skel-${kind} os-route-loading`}`} role="status" aria-busy="true">
      <span className="sr-only">{label ?? t("common:loading")}</span>
      <div className="os-skel-body" aria-hidden="true">
        {(kind === "list" || kind === "row") &&
          Array.from({ length: kind === "row" ? 1 : 6 }, (_, i) => (
            <div className="os-skel-row" key={i}>
              <span className="os-skel-icon" />
              <span className="os-skel-bar os-skel-bar-title" style={{ width: `${48 + ((i * 13) % 32)}%` }} />
            </div>
          ))}
        {kind === "reader" && (
          <>
            <span className="os-skel-box" />
            <div className="os-skel-pair">
              <span className="os-skel-box" />
              <span className="os-skel-box" />
            </div>
            <span className="os-skel-heading" />
            {Array.from({ length: 4 }, (_, i) => (
              <div className="os-skel-verse" key={i}>
                <span className="os-skel-bar" />
                <span className="os-skel-bar" />
                <span className="os-skel-bar os-skel-bar-short" />
              </div>
            ))}
          </>
        )}
        {kind === "page" && (
          <>
            <span className="os-skel-heading" />
            <span className="os-skel-bar" />
            <span className="os-skel-bar" />
            <span className="os-skel-bar os-skel-bar-short" />
            <span className="os-skel-box os-skel-card" />
            <span className="os-skel-bar" />
            <span className="os-skel-bar os-skel-bar-short" />
          </>
        )}
      </div>
    </div>
  );
}
