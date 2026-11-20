import { churchSettings } from "./settings";

/** A church's accent colour becomes the site's accent (links, primary buttons), in the light and the dark theme. Nothing happens without colours. */
export function applyChurchColors() {
  const c = churchSettings.colors;
  if (!c || typeof document === "undefined") return;
  const rule = (selector: string, hex: string) => `${selector}{--os-accent:${hex};--core-green:${hex};--core-focus:${hex};}`;
  const css = [c.accent ? rule(":root", c.accent) : "", c.accentDark ? rule('html[data-theme="dark"]', c.accentDark) : ""].join("");
  if (!css) return;
  const style = document.createElement("style");
  style.id = "church-colors";
  style.textContent = css;
  document.head.appendChild(style);
}
