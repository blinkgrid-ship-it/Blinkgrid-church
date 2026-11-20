/**
 * Where Back goes when the reader did not come from another page of this site (a link opened from
 * Facebook, Instagram or WhatsApp, a bookmark, a fresh tab). The paths are router paths, so the
 * reader's own language is added by the router ("/" is the Malayalam home for a Malayalam reader).
 *
 * A page that has a fixed `back` of its own (a lesson goes back to its module) keeps it; this table
 * is for pages that name none. A page without a Back link must be added to NO_BACK_NEEDED in
 * e2e/back-links.spec.ts on purpose, or that test fails.
 */
export const BACK_FALLBACKS: Record<string, string> = {
  // Account pages go back to More.
  "/settings": "/more",
  "/questions": "/more",
  "/my-study": "/more",
  "/account": "/more",
  "/notifications": "/more",
  "/leaderboard": "/more",
  // Study and information pages, Donate and Admin go back to Home.
  "/search": "/",
  "/sources": "/",
  "/datasets": "/",
  "/topic/:topic": "/",
  "/booklet": "/",
  "/library": "/",
  "/pathway": "/",
  "/verify/:id": "/",
  "/support/chapter-audio": "/",
  "/donate": "/",
  "/admin": "/",
  "/admin/imports": "/admin",
  "/admin/feedback": "/admin",
  "/admin/editions": "/admin",
  "/admin/traffic": "/admin",
  "/admin/donations": "/admin",
  "/admin/team": "/admin",
  "/admin/texts": "/admin",
  "/admin/churches": "/admin",
  "/admin/churches/new": "/admin/churches",
  "/admin/churches/:id": "/admin/churches",
};
