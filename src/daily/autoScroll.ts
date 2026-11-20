// Auto-scroll for the Daily Bible reader: a reader switches it on, puts the phone down, and the text moves up at a slow reading pace.
// The numbers and rules are plain functions (tested alone, tests/daily-autoscroll.test.mjs); the scroller at the bottom uses the browser.

export type Speed = "slow" | "normal" | "fast";
export const SPEEDS: readonly Speed[] = ["slow", "normal", "fast"];
export const DEFAULT_SPEED: Speed = "slow";

/** Seconds between the switch being pressed and the first movement (the reader gets time to look up at the text). */
export const START_DELAY_MS = 2000;

/** Pixels per second for each pixel of text size: about one line every 4, 3 and 2.2 seconds at the usual line height. */
const FACTOR: Record<Speed, number> = { slow: 0.45, normal: 0.65, fast: 0.9 };

/** How fast the page moves, in pixels per second. It follows the text size, so bigger letters give the same time per line. */
export function pxPerSecond(textSize: number, speed: Speed): number {
  const size = Number.isFinite(textSize) && textSize > 0 ? textSize : 22;
  return size * FACTOR[speed];
}

/** The next speed in the list (slow, normal, fast, then slow again). */
export function nextSpeed(speed: Speed): Speed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}

/**
 * One animation frame of movement. A page can only move whole pixels, and at a slow pace one frame is a fraction of a pixel, so the
 * fraction is carried to the next frame. A frame that took very long (the tab was hidden) counts as 100 ms, so the page never jumps.
 */
export function scrollStep(carry: number, elapsedMs: number, speedPxPerSecond: number): { whole: number; carry: number } {
  const dt = Math.min(Math.max(elapsedMs, 0), 100);
  const total = carry + (speedPxPerSecond * dt) / 1000;
  const whole = Math.floor(total);
  return { whole, carry: total - whole };
}

/** True when the page cannot move any further down (a pixel or two of rounding is allowed). */
export function atEnd(scrollY: number, viewportHeight: number, pageHeight: number): boolean {
  return scrollY + viewportHeight >= pageHeight - 2;
}

/** The keys a reader uses to move the page by hand: pressing one means they want to take over. */
export const MOVE_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "] as const;

// ---- the chosen speed stays on this phone ----
const SPEED_KEY = "blinkgrid-church.daily.autoscroll-speed.v1";
export function readSpeed(): Speed {
  try {
    const v = window.localStorage.getItem(SPEED_KEY);
    return (SPEEDS as readonly string[]).includes(v ?? "") ? (v as Speed) : DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}
export function saveSpeed(speed: Speed) {
  try {
    window.localStorage.setItem(SPEED_KEY, speed);
  } catch {
    /* a private window may refuse; the choice just lasts for this visit */
  }
}

// ---- the scroller ----
export type AutoScroller = { start: () => void; stop: () => void };

type Options = {
  getSize: () => number;
  getSpeed: () => Speed;
  /** The page reached its end. The scroller has already stopped. */
  onEnd: () => void;
  /** The reader took over (finger, wheel, keys). The scroller has already stopped. */
  onInterrupt: () => void;
  /** Keys pressed here do not count as taking over (the switch itself). */
  ignore: (target: EventTarget | null) => boolean;
};

export function createAutoScroller(o: Options): AutoScroller {
  let running = false;
  let raf = 0;
  let delay = 0;
  let last = 0;
  let carry = 0;
  let lock: { release: () => Promise<void> } | null = null;

  const acquireLock = async () => {
    try {
      const wake = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wake && !lock) lock = await wake.request("screen");
    } catch {
      /* the phone may refuse; the switch still works, the screen may dim */
    }
  };
  const releaseLock = () => {
    const held = lock;
    lock = null;
    void held?.release().catch(() => undefined);
  };
  const onVisible = () => {
    // The phone gives the screen lock back when the tab is hidden; take it again when the reader returns.
    if (running && document.visibilityState === "visible") void acquireLock();
  };

  const takeOver = (e: Event) => {
    // A key pressed on the switch itself (Space or Enter) is the switch working, not the reader taking over. A wheel or a finger moving the page always is.
    if (e.type === "keydown" && (o.ignore(e.target) || !(MOVE_KEYS as readonly string[]).includes((e as KeyboardEvent).key))) return;
    stop();
    o.onInterrupt();
  };

  const frame = (now: number) => {
    if (!running) return;
    const step = scrollStep(carry, now - last, pxPerSecond(o.getSize(), o.getSpeed()));
    last = now;
    carry = step.carry;
    if (step.whole > 0) {
      // "instant": the site's smooth scrolling would turn every small step into a slow glide that lags behind.
      window.scrollBy({ top: step.whole, behavior: "instant" as ScrollBehavior });
      if (atEnd(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)) {
        stop();
        o.onEnd();
        return;
      }
    }
    raf = window.requestAnimationFrame(frame);
  };

  function start() {
    if (running) return;
    running = true;
    carry = 0;
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchmove", takeOver, { passive: true });
    window.addEventListener("keydown", takeOver);
    document.addEventListener("visibilitychange", onVisible);
    void acquireLock();
    delay = window.setTimeout(() => {
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    }, START_DELAY_MS);
  }

  function stop() {
    if (!running) return;
    running = false;
    window.clearTimeout(delay);
    window.cancelAnimationFrame(raf);
    window.removeEventListener("wheel", takeOver);
    window.removeEventListener("touchmove", takeOver);
    window.removeEventListener("keydown", takeOver);
    document.removeEventListener("visibilitychange", onVisible);
    releaseLock();
  }

  return { start, stop };
}
