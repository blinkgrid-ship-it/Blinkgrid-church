import raw from "./church.json";
import { DEFAULTS, parseChurchSettings, type ChurchSettings } from "./parse";

// The settings this copy of the site runs with: src/church/church.json, checked by parse.ts. See docs/CHURCH-COPY.md.
export type { ChurchPlan, ChurchReading, ChurchSettings } from "./parse";

const parsed = parseChurchSettings(raw);
if (parsed.problems.length && typeof console !== "undefined") console.warn("church.json:", parsed.problems.join("; "));

const isPlain = (s: ChurchSettings) => s.name === DEFAULTS.name && !s.logo && !s.names;

/**
 * The settings this copy of the site runs with. They start as src/church/church.json and, on a build that looks the church up by
 * web address (churchStore.ts), are replaced ONCE before anything is drawn. These are live bindings: read them when used, never keep them
 * in a top-level constant.
 */
export let churchSettings: ChurchSettings = parsed.settings;
export let isDefaultChurch = isPlain(churchSettings);

/** Replaces the settings (once, at start). The only place that writes them. */
export function setChurchSettings(next: ChurchSettings) {
  churchSettings = next;
  isDefaultChurch = isPlain(next);
}
