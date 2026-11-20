// The pause before reading (Paul's brief, item 6): one calm line, "Take a moment", that goes on by itself after a few seconds.
// Skip goes straight to reading and is remembered on this phone. We write no prayers; the screen holds no other text.
const SKIPPED = "blinkgrid-church.daily.pause-skipped.v1";
const SEEN = "blinkgrid-church.daily.pause-seen.v1";
export const PAUSE_SECONDS = 5;

const get = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key) === "1";
  } catch {
    return false;
  }
};
const set = (store: () => Storage, key: string) => {
  try {
    store().setItem(key, "1");
  } catch {
    /* kept for this visit only */
  }
};

/** Shown once per visit, and never again once the reader has skipped it. */
export const shouldPause = () => !get(() => window.localStorage, SKIPPED) && !get(() => window.sessionStorage, SEEN);
export const finishPause = () => set(() => window.sessionStorage, SEEN);
export function skipPause() {
  set(() => window.localStorage, SKIPPED);
  finishPause();
}
