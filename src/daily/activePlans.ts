import type { MessageKey } from "../i18n";
import { pick } from "../i18n";
import { churchSettings } from "../church/settings";
import { starterPlans, type Plan } from "./plans";

/** The church's own plans when its settings file has them (src/church/church.json), else the three starter plans. */
export const getPlans = (): Plan[] => (churchSettings.plans?.length ? churchSettings.plans : starterPlans);

export const planById = (id: string | null | undefined) => getPlans().find((p) => p.id === id);

/** A plan's title in the reader's language: a text key for the starter plans, or the church's own words. */
export const planTitle = (plan: Plan, t: (key: MessageKey) => string, language: string): string =>
  typeof plan.title === "string" ? t(plan.title) : pick(plan.title, language) || plan.title.en || plan.id;
