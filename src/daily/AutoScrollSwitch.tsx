import { useEffect, useRef, useState } from "react";
import { ChevronsDown, Pause } from "lucide-react";
import { useUI } from "../Platform";
import { createAutoScroller, nextSpeed, readSpeed, saveSpeed, type AutoScroller, type Speed } from "./autoScroll";

/**
 * The auto-scroll switch of the Daily Bible reader: a round button on the right. On, the page starts moving after two seconds at a slow
 * reading pace; off, it stops. Touching the page, the wheel or the arrow keys also stops it (so it never fights the reader's hand), and it
 * stops by itself at the end of the chapter. It is always off when a chapter opens. `resetKey` changes with the chapter.
 */
export function AutoScrollSwitch({ size, resetKey }: { size: number; resetKey: string }) {
  const { t } = useUI();
  const [on, setOn] = useState(false);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [message, setMessage] = useState("");
  const sizeRef = useRef(size);
  const speedRef = useRef(speed);
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<AutoScroller | null>(null);
  sizeRef.current = size;
  speedRef.current = speed;

  useEffect(() => {
    scroller.current = createAutoScroller({
      getSize: () => sizeRef.current,
      getSpeed: () => speedRef.current,
      onEnd: () => {
        setOn(false);
        setMessage(t("daily:autoScrollEnded"));
      },
      onInterrupt: () => {
        setOn(false);
        setMessage(t("daily:autoScrollOff"));
      },
      ignore: (target) => target instanceof Node && !!box.current?.contains(target),
    });
    return () => scroller.current?.stop();
  }, []);

  // A new chapter always opens with the switch off.
  useEffect(() => {
    scroller.current?.stop();
    setOn(false);
    setMessage("");
  }, [resetKey]);

  const toggle = () => {
    if (on) {
      scroller.current?.stop();
      setOn(false);
      setMessage(t("daily:autoScrollOff"));
    } else {
      scroller.current?.start();
      setOn(true);
      setMessage(t("daily:autoScrollOn"));
    }
  };
  const cycle = () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    saveSpeed(next);
  };
  const speedName = t(`daily:speed_${speed}`);

  return (
    <div className="dl-auto" ref={box}>
      {on && (
        <button type="button" className="dl-auto-speed" onClick={cycle} aria-label={t("daily:autoScrollSpeed", { speed: speedName })}>
          {speedName}
        </button>
      )}
      <button type="button" className="dl-auto-switch" aria-pressed={on} aria-label={t("daily:autoScroll")} title={t("daily:autoScroll")} onClick={toggle}>
        {on ? <Pause size={24} aria-hidden="true" /> : <ChevronsDown size={24} aria-hidden="true" />}
      </button>
      <span className="dl-auto-status" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
