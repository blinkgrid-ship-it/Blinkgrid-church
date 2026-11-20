import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useUI } from "../Platform";
import { BACK_FALLBACKS } from "./backFallbacks";

/** The fallback for the page being shown, from the table above. */
function fallbackFor(pathname: string): string | undefined {
  for (const [pattern, to] of Object.entries(BACK_FALLBACKS)) {
    if (matchPath({ path: pattern, end: true }, pathname)) return to;
  }
  return undefined;
}

/**
 * True only when the reader reached this page from another page of this site in this tab.
 * The router numbers its own entries from 0 at the first page it showed; an entry above 0 has a
 * page of ours before it. A reader who arrived from Facebook, Instagram or WhatsApp is at 0 (or
 * has no number at all), so Back never takes them out of the site.
 */
function cameFromThisSite(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * Goes back once in the reader's own history when they came from this site; otherwise goes to the
 * fallback, replacing this page so the browser's back button does not return here.
 */
export function useSafeBack(fallback?: string) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const to = fallback ?? fallbackFor(pathname) ?? "/";
  return {
    to,
    go: () => {
      if (cameFromThisSite()) navigate(-1);
      else navigate(to, { replace: true });
    },
  };
}

/**
 * The Back link. `fallback` is the page's own fixed parent when it has one, else the table in
 * backFallbacks.ts. Its words come from the language file ("common:back").
 */
export function BackLink({ fallback }: { fallback?: string }) {
  const { t } = useUI();
  const { pathname } = useLocation();
  const { to, go } = useSafeBack(fallback);
  if (!fallback && !fallbackFor(pathname)) return null;
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle a modified click (new tab) the normal way.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go();
  };
  return (
    <Link className="os-back" to={to} onClick={onClick}>
      <ArrowLeft size={18} /> {t("common:back")}
    </Link>
  );
}
