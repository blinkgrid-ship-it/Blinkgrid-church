import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import "./notice.css";

/**
 * What a message means, which decides its colour and icon everywhere on the site:
 *  - error: something failed and the reader may need to act (red)
 *  - warning: it did not fully work, or needs a step from the reader (amber)
 *  - success: it worked (green)
 *  - info: good to know (blue)
 * The icon means colour is never the only signal; the words stay the main one.
 */
export type Tone = "error" | "warning" | "success" | "info";
export type NoticeState = { text: string; tone: Tone };

const ICON = { error: CircleAlert, warning: TriangleAlert, success: CircleCheck, info: Info } as const;

/** One message box. Errors are announced at once (alert); the rest wait their turn (status). */
export function Notice({
  tone,
  children,
  className,
  role,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = ICON[tone];
  return (
    <div className={`os-notice os-notice--${tone}${className ? ` ${className}` : ""}`} role={role ?? (tone === "error" ? "alert" : "status")}>
      <Icon className="os-notice-icon" size={20} aria-hidden="true" />
      <div className="os-notice-body">{children}</div>
    </div>
  );
}

/** For a screen that keeps its latest message in state: nothing when there is none. */
export function NoticeLine({ note, className }: { note: NoticeState | null | undefined; className?: string }) {
  return note && note.text ? (
    <Notice tone={note.tone} className={className}>
      <p>{note.text}</p>
    </Notice>
  ) : null;
}

/** A short error under a field (an input that is not valid). Same red as the error box. */
export const FIELD_ERROR_CLASS = "os-field-error";
