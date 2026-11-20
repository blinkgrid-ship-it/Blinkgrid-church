// Pure helpers for the error screen (ErrorBoundary.tsx), kept apart so they can be tested without React.

/**
 * A page's script (a "chunk") that could not be fetched. After a new version of the site goes live the
 * old file names are gone, so a page that was left open asks for a file that no longer exists; reloading fixes it.
 */
export function isStaleChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(text);
}

/** The note "Tell us about it" puts in the Feedback box: where it happened and what the error said. */
export function crashReport(path: string, error: unknown): string {
  const what = error instanceof Error ? error.message : String(error ?? "");
  return `Error screen on ${path.slice(0, 120)}: ${what.replace(/\s+/g, " ").trim().slice(0, 160)}`.trim();
}
