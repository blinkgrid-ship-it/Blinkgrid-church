// A church found by web address (docs/contracts/CHURCH-SETUP-contract.md, Parts 2 and 7). This file has no browser code, so it is tested alone.
// One question is asked at start: "which church is this address?". Anything but a clear, valid "active church" answer gives the SAFE STATE:
// the plain OriginalScript page. Never another church's look, never an old copy.
import { DEFAULTS, parseChurchSettings, type ChurchSettings } from "./parse.ts";

export const CONTRACT_VERSION = 1;
export const RESOLVE_TIMEOUT_MS = 4000;

export type SafeReason = "not-found" | "unreachable" | "timeout" | "server-error" | "broken-answer" | "wrong-version" | "wrong-address";
export type ChurchResult =
  | { kind: "church"; settings: ChurchSettings; problems: string[] }
  | { kind: "safe"; reason: SafeReason };

const LANGUAGES = ["en", "ml", "hi"];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const words = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The plain OriginalScript page: the defaults, with nothing of any church. A fresh copy each time. */
export function safeSettings(): ChurchSettings {
  return { ...DEFAULTS, dailyText: { ...DEFAULTS.dailyText } };
}

/**
 * Turns the answer of `GET /church/resolve` into settings, or says why it cannot.
 * A part that breaks its rule (a colour too light, a plan with a bad day) is left out and the OriginalScript default is used for it:
 * a broken part is not a broken church (contract Part 7, rule 2). A missing name, a wrong contract number or an answer for another
 * address is a broken church: the safe state.
 */
export function churchFromAnswer(body: unknown, host: string): ChurchResult {
  if (!isObject(body)) return { kind: "safe", reason: "broken-answer" };
  if (typeof body.contractVersion !== "number") return { kind: "safe", reason: "broken-answer" };
  if (body.contractVersion !== CONTRACT_VERSION) return { kind: "safe", reason: "wrong-version" };
  const church = body.church;
  if (!isObject(church)) return { kind: "safe", reason: "broken-answer" };

  const names: Record<string, string> = {};
  if (isObject(church.name)) for (const [lang, value] of Object.entries(church.name)) if (LANGUAGES.includes(lang) && words(value)) names[lang] = words(value) as string;
  if (!Object.keys(names).length) return { kind: "safe", reason: "broken-answer" };

  const addresses = Array.isArray(church.addresses) ? church.addresses.filter((a): a is string => typeof a === "string").map((a) => a.toLowerCase()) : [];
  const primary = words(church.primaryAddress)?.toLowerCase();
  if (!addresses.length || !primary) return { kind: "safe", reason: "broken-answer" };
  if (!addresses.includes(host.toLowerCase())) return { kind: "safe", reason: "wrong-address" };

  const defaultLanguage = typeof church.defaultLanguage === "string" ? church.defaultLanguage : undefined;
  const plan = isObject(church.plan) ? church.plan : undefined;
  const input: Record<string, unknown> = {
    name: (defaultLanguage && names[defaultLanguage]) || names.en || Object.values(names)[0],
    address: primary,
    ...(typeof church.logoUrl === "string" ? { logo: church.logoUrl } : {}),
    ...(isObject(church.colors) ? { colors: church.colors } : {}),
    ...(defaultLanguage ? { defaultLanguage } : {}),
    ...(isObject(church.dailyText) ? { dailyText: church.dailyText } : {}),
    ...(plan ? { plans: [{ id: plan.id, title: plan.title, days: plan.days }] } : {}),
  };
  const { settings, problems } = parseChurchSettings(input, { remoteLogo: true });
  return { kind: "church", settings: { ...settings, names }, problems };
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Asks the server which church this address is. `doFetch` is the browser's fetch (or the test stand-in).
 * No answer in `timeoutMs`, a network failure, any 5xx, a 404, or a broken answer all give the safe state.
 */
export async function resolveChurch(url: string, host: string, doFetch: FetchLike, timeoutMs = RESOLVE_TIMEOUT_MS): Promise<ChurchResult> {
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<ChurchResult>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve({ kind: "safe", reason: "timeout" });
    }, timeoutMs);
  });
  const ask = (async (): Promise<ChurchResult> => {
    let res;
    try {
      res = await doFetch(url, { signal: controller?.signal });
    } catch {
      return { kind: "safe", reason: "unreachable" };
    }
    if (res.status === 404) return { kind: "safe", reason: "not-found" };
    if (res.status >= 500) return { kind: "safe", reason: "server-error" };
    if (!res.ok) return { kind: "safe", reason: "broken-answer" };
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: "safe", reason: "broken-answer" };
    }
    return churchFromAnswer(body, host);
  })();
  try {
    return await Promise.race([ask, late]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
