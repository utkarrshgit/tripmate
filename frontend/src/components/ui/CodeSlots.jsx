import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cx } from "@/utils/cx";
import Icon from "./Icon";
import "./CodeSlots.css";

/*
 * CodeSlots — adapted from React Bits (https://reactbits.dev), JavaScript + CSS variant.
 * DESIGN.md changes: CSS transitions instead of the motion package, the site's icons
 * instead of Hugeicons, no hover states, the input focus ring on the active slot, and
 * slots that shrink to fit a phone-width sheet.
 *
 * One real <input> (autocomplete="one-time-code", numeric keypad) sits over the slots,
 * so screen readers announce a single field and phones can offer the code from a message.
 *
 *   length        Number of digits (6)
 *   status        "idle" | "error" | "success". error drains the slots, last to first,
 *                 then clears the code; success washes the row and locks it.
 *   onChange      (code) => void, on every edit, including the clear after an error
 *   onComplete    (code) => void, once, when the last slot fills
 *   label         Accessible name of the input
 *   describedBy   id of a message (error or help) to announce with the field
 *   disabled, autoFocus
 */
const SETTLE_MS = 300;
const CASCADE_MS = 30;

const digitsOf = (raw) => String(raw ?? "").replace(/\D/g, "");
const emptySlots = (n) => Array.from({ length: n }, () => "");
const firstEmpty = (slots) => {
  const i = slots.indexOf("");
  return i === -1 ? slots.length - 1 : i;
};

const CodeSlots = forwardRef(function CodeSlots(
  { length = 6, status = "idle", onChange, onComplete, label = "Verification code", describedBy, disabled = false, autoFocus = false, id: idProp, className },
  ref,
) {
  const uid = useId();
  const id = idProp ?? `${uid}-input`;
  const reduce = usePrefersReducedMotion();
  const inputRef = useRef(null);
  const rowRef = useRef(null);
  const [slots, setSlots] = useState(() => emptySlots(length));
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [delays, setDelays] = useState(() => Array(length).fill(0));
  const [draining, setDraining] = useState(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const drainTimer = useRef(undefined);
  const cascade = reduce ? 0 : CASCADE_MS;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  const commit = useCallback(
    (next) => {
      const wasFull = slotsRef.current.every(Boolean);
      slotsRef.current = next;
      setSlots(next);
      const code = next.join("");
      onChange?.(code);
      if (!wasFull && next.every(Boolean)) onComplete?.(code);
    },
    [onChange, onComplete],
  );

  const locked = disabled || draining || status === "success";

  // Fill from `from` onward; several digits at once (a paste) land one after another.
  function insert(raw, from = active) {
    const digits = digitsOf(raw);
    if (!digits) return;
    const next = [...slotsRef.current];
    const nextDelays = Array(length).fill(0);
    let i = from;
    for (const ch of digits) {
      if (i >= length) break;
      next[i] = ch;
      nextDelays[i] = (i - from) * cascade;
      i += 1;
    }
    if (i === from) return;
    setDelays(nextDelays);
    commit(next);
    setActive(Math.min(i, length - 1));
  }

  function clearSlot(i, stepBack = false) {
    if (stepBack) setActive(i);
    if (!slotsRef.current[i]) return;
    const next = [...slotsRef.current];
    next[i] = "";
    setDelays(Array(length).fill(0));
    commit(next);
  }

  function onKeyDown(e) {
    if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      insert(k);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (slots[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (k === "Delete") {
      e.preventDefault();
      clearSlot(active);
    } else if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") {
      e.preventDefault();
      const to = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: length - 1 }[k];
      setActive(Math.max(0, Math.min(to, firstEmpty(slotsRef.current))));
    }
  }

  // Phones and autofill type straight into the input; take whatever digits arrive.
  function onInput(e) {
    if (locked) return;
    const d = digitsOf(e.target.value);
    if (d) insert(d, d.length === 1 ? active : 0);
  }

  function onPaste(e) {
    if (locked) return;
    e.preventDefault();
    insert(e.clipboardData.getData("text"), 0);
  }

  // A press picks the slot under the pointer (never past the first empty one), then focuses.
  function onRowMouseDown(e) {
    if (disabled) return;
    e.preventDefault();
    if (!locked) {
      const cells = [...rowRef.current.querySelectorAll(".code-slots__slot")];
      const hit = cells.findIndex((c) => e.clientX <= c.getBoundingClientRect().right);
      const i = hit === -1 ? length - 1 : hit;
      setActive(Math.min(i, firstEmpty(slotsRef.current)));
    }
    inputRef.current?.focus();
  }

  // Error: drain the filled slots, last to first, then clear the code.
  useEffect(() => {
    if (status !== "error") return undefined;
    const filled = slotsRef.current.map((c, i) => (c ? i : -1)).filter((i) => i >= 0).reverse();
    if (!filled.length) return undefined;
    const nextDelays = Array(length).fill(0);
    filled.forEach((i, k) => (nextDelays[i] = k * cascade));
    setDelays(nextDelays);
    setDraining(true);
    clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(
      () => {
        setDraining(false);
        setDelays(Array(length).fill(0));
        setActive(0);
        commit(emptySlots(length));
        inputRef.current?.focus();
      },
      reduce ? 150 : (filled.length - 1) * cascade + SETTLE_MS,
    );
    return () => clearTimeout(drainTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const count = slots.filter(Boolean).length;
  const showCaret = focused && !locked && !slots[active];

  return (
    <div className={cx("code-slots", className)} data-status={status} data-disabled={disabled ? "" : undefined}>
      <div ref={rowRef} className="code-slots__row" data-focused={focused ? "" : undefined} style={{ "--cs-count": length }} onMouseDown={onRowMouseDown}>
        <input
          ref={inputRef}
          id={id}
          className="code-slots__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value=""
          maxLength={length}
          aria-label={label}
          aria-invalid={status === "error"}
          aria-describedby={[`${uid}-count`, describedBy].filter(Boolean).join(" ")}
          disabled={disabled}
          readOnly={status === "success"}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={onInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {slots.map((ch, i) => (
          <Slot
            key={i}
            char={ch}
            filled={Boolean(ch) && !draining}
            active={focused && !locked && i === active}
            caret={showCaret && i === active}
            delay={delays[i]}
          />
        ))}
        <span className="code-slots__wash" aria-hidden="true">
          <span className="code-slots__check">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
        </span>
      </div>
      <span id={`${uid}-count`} className="visually-hidden" aria-live="polite">
        {status === "success" ? "Code accepted" : `${count} of ${length} digits entered`}
      </span>
    </div>
  );
});

/** One digit. Keeps showing its last digit while it fades out, so a cleared slot drains rather than blinks. */
function Slot({ char, filled, active, caret, delay }) {
  const [shown, setShown] = useState(char);
  if (char && char !== shown) setShown(char);
  return (
    <span
      className="code-slots__slot"
      data-filled={filled ? "" : undefined}
      data-active={active ? "" : undefined}
      style={{ "--cs-delay": `${delay}ms` }}
      aria-hidden="true"
    >
      <span className="code-slots__fill" />
      {shown ? <span className="code-slots__digit">{shown}</span> : null}
      {caret && <span className="code-slots__caret" />}
    </span>
  );
}

export default CodeSlots;
