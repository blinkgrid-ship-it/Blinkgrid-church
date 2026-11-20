import { BookOpen } from "lucide-react";
import i18n from "../i18n";
import { churchName } from "./parse";
import { churchSettings } from "./settings";

/**
 * The mark and the name in the header and footer: the church's logo (or the book icon) and its name.
 */
export function Brand({ size, strokeWidth, twoTone }: { size: number; strokeWidth?: number; twoTone?: boolean }) {
  return (
    <>
      {churchSettings.logo ? <img className="os-brand-logo" src={churchSettings.logo} alt="" width={size} height={size} /> : <BookOpen size={size} strokeWidth={strokeWidth} />}
      <span>{churchName(churchSettings, i18n.language)}</span>
    </>
  );
}
