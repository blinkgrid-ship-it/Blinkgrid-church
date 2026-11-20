import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./dropdown.css";

export type DropdownOption = { value: string; label: string; lang?: string };

/**
 * A dropdown that looks like the rest of the site (the browser's own list cannot be styled): a
 * button that opens a rounded card of choices with a tick on the current one. On a phone the
 * card is a sheet that rises from the bottom of the screen, with the name of the box on top and
 * big tap targets; on a computer it opens under the button (or above it when there is no room).
 * Arrow keys, Home, End, Enter, Space, Escape and Tab work as in a native list, and typing the
 * first letters or digits of a choice jumps to it. Escape closes only the dropdown, not the
 * panel around it.
 */
export function Dropdown({
  value,
  options,
  onChange,
  label,
  icon,
  className,
  disabled,
}: {
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  /** Names the control for screen readers, and heads the sheet on a phone. */
  label: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  // On a computer the list is cut to the room there is on screen, so its first items are never above the top edge.
  const [room, setRoom] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selected];

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    items.current[selected]?.focus();
    return () => document.removeEventListener("pointerdown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle() {
    if (!open && button.current) {
      // Opens upward when the list would run off the bottom and there is more room above.
      const box = button.current.getBoundingClientRect();
      const need = Math.min(options.length, 7) * 48 + 20;
      const below = window.innerHeight - box.bottom;
      // The site header stays on screen and sits over anything above it, so the room above starts under it.
      const header = document.querySelector(".os-header")?.getBoundingClientRect();
      const above = box.top - (header && header.top <= 0 ? Math.max(0, header.bottom) : 0);
      const opensUp = below < need && above > below;
      setUp(opensUp);
      // The card has 6px padding each side, an 8px gap to the button and a little air at the screen edge.
      setRoom(Math.max(120, Math.floor((opensUp ? above : below) - 8 - 12 - 12)));
    }
    setOpen(!open);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) button.current?.focus();
  }
  function choose(next: string) {
    if (next !== value) onChange(next);
    close();
  }
  function move(to: number) {
    items.current[(to + options.length) % options.length]?.focus();
  }
  /** Typing the start of a choice ("Ex", "12") moves to the first one that begins with it. */
  function typeAhead(key: string, from: number) {
    const now = Date.now();
    const state = typed.current;
    state.text = now - state.at < 700 ? state.text + key.toLowerCase() : key.toLowerCase();
    state.at = now;
    // A repeated single letter walks through the choices that start with it.
    const repeat = state.text.length > 1 && [...state.text].every((c) => c === state.text[0]);
    const needle = repeat ? state.text[0] : state.text;
    const order = options.map((_, i) => (from + (repeat || state.text.length === 1 ? 1 : 0) + i) % options.length);
    const found = order.find((i) => options[i].label.toLowerCase().startsWith(needle));
    if (found !== undefined) items.current[found]?.focus();
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        toggle();
      }
      return;
    }
    const at = items.current.indexOf(document.activeElement as HTMLDivElement);
    switch (event.key) {
      case "Escape":
        // Only the dropdown closes; the panel around it stays open.
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        move(at + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(at - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(options.length - 1);
        break;
      case "Enter":
      case " ":
        if (at >= 0) {
          event.preventDefault();
          choose(options[at].value);
        }
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeAhead(event.key, Math.max(at, 0));
    }
  }

  return (
    <div className={`dd${className ? ` ${className}` : ""}`} ref={root} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="dd-button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={toggle}
      >
        {icon}
        <span lang={current?.lang}>{current?.label}</span>
        <ChevronDown size={16} aria-hidden="true" className="dd-chevron" />
      </button>
      {open && (
        <>
          <div className="dd-scrim" onClick={() => close()} aria-hidden="true" />
          <div className={`dd-panel${up ? " dd-panel-up" : ""}`}>
            <p className="dd-sheet-head" aria-hidden="true">
              {label}
            </p>
            <div
              id={listId}
              className="dd-list"
              role="listbox"
              aria-label={label}
              style={room === null ? undefined : ({ "--dd-room": `${room}px` } as React.CSSProperties)}
            >
              {options.map((option, i) => (
                <div
                  key={option.value}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  role="option"
                  tabIndex={-1}
                  lang={option.lang}
                  aria-selected={option.value === value}
                  className="dd-option"
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check size={17} aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
