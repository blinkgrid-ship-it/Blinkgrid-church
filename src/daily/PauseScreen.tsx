import { useEffect } from "react";
import { useUI } from "../Platform";
import { PAUSE_SECONDS } from "./pause";
import "./daily.css";

/** One line, a thin bar that fills, and Skip. It goes on by itself; Skip goes on at once and is remembered. */
export function PauseScreen({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const { t } = useUI();
  useEffect(() => {
    const timer = window.setTimeout(onDone, PAUSE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="os-page dl-pause">
      <p className="dl-pause-line" role="status">
        {t("daily:takeAMoment")}
      </p>
      <div className="dl-pause-bar" aria-hidden="true">
        <span style={{ animationDuration: `${PAUSE_SECONDS}s` }} />
      </div>
      <button type="button" className="os-secondary" onClick={onSkip}>
        {t("daily:skip")}
      </button>
    </div>
  );
}
