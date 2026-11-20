// Which Bible text each language reads in the Daily Bible door: one edition code per language.
// A church's own version is switched in src/church/church.json (dailyText).
// For now every language reads OriginalScript's own literal edition, and the screen says so
// (CLAUDE.md guardrail 5: no silent substitution). Nothing under copyright is named here without written permission.
import { churchSettings } from "../church/settings";

/** Read when used, not kept: the church may be found by web address after this file loads. */
const dailyText = (): Record<string, string> => churchSettings.dailyText;
/** True while the text this language reads is OriginalScript's own literal edition, not a familiar Bible text, so the page must say so. */
export const dailyTextIsStandIn = (language: string): boolean => (dailyText()[language] ?? "").startsWith("literal-");

export const dailyEdition = (language: string): string | undefined => dailyText()[language];
