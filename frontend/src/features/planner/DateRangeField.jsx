import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { Button, Calendar, Icon, IconButton } from "@/components/ui";
import { useDismiss } from "@/hooks/useDismiss";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cx } from "@/utils/cx";
import { formatDateRange, plural } from "@/utils/format";
import { MAX_TRIP_DAYS, addDays, daysBetween, fromISO, todayISO } from "./dateParsing";

const shortDate = (value) =>
  fromISO(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Month (0–11) and year of an ISO date, shifted by `by` months. */
const monthOf = (value, by = 0) => {
  const d = fromISO(value);
  const m = new Date(d.getFullYear(), d.getMonth() + by, 1);
  return { year: m.getFullYear(), month: m.getMonth() };
};

/**
 * "When are you going?": two field-style buttons (start, return) that open one
 * calendar for choosing the range. The first pick sets the start, the second the
 * return. Past days, and returns more than MAX_TRIP_DAYS after the start, can't be picked.
 *
 * `source` says where the dates came from: "prompt" (read from the request) or "picker".
 * The forwarded ref exposes focus(), so the form can send people here on an error.
 */
const DateRangeField = forwardRef(function DateRangeField({ dates, source, error, onChange }, ref) {
  const id = useId();
  const today = todayISO();
  const twoMonths = useMediaQuery("(min-width: 769px)");
  const [open, setOpen] = useState(null); // null | "start" | "end": which date the next pick sets
  const [view, setView] = useState(() => monthOf(dates.start ?? today));
  const [focused, setFocused] = useState(dates.start ?? today);
  const wrapRef = useRef(null);
  const startRef = useRef(null);
  const endRef = useRef(null);
  const popRef = useRef(null);
  const complete = dates.start && dates.end && dates.end >= dates.start;
  const messageId = `${id}-message`;

  useImperativeHandle(ref, () => ({ focus: () => startRef.current?.focus() }), []);

  const close = useCallback(
    (returnFocus = true) => {
      if (open && returnFocus) (open === "end" ? endRef : startRef).current?.focus();
      setOpen(null);
    },
    [open],
  );
  // Escape or a press outside: hand focus back only if it was inside the calendar.
  useDismiss(wrapRef, () => close(Boolean(popRef.current?.contains(document.activeElement))), Boolean(open));

  function openAt(which) {
    const anchor = (which === "end" ? dates.end ?? dates.start : dates.start) ?? today;
    setView(monthOf(anchor));
    setFocused(anchor);
    setOpen(which);
  }

  // Move keyboard focus onto the focused day whenever it changes while open.
  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector(`[data-day="${focused}"]`)?.focus();
  }, [open, focused, view]);

  const isDisabled = (day) => {
    if (day < today) return true;
    if (open === "end" && dates.start) return day < dates.start || daysBetween(dates.start, day) + 1 > MAX_TRIP_DAYS;
    return false;
  };

  function pick(day) {
    if (open === "start" || !dates.start || day < dates.start) {
      // New start: keep the old return only if it still makes a valid trip.
      const keepEnd = dates.end && dates.end >= day && daysBetween(day, dates.end) + 1 <= MAX_TRIP_DAYS;
      onChange({ start: day, end: keepEnd ? dates.end : null });
      setFocused(day);
      setOpen("end");
      return;
    }
    onChange({ start: dates.start, end: day });
    close();
  }

  // Grid keyboard: arrows move by day and week, Page Up/Down by month, Home/End to the week's ends.
  function onKeyDown(e, day) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (moves[e.key] != null) next = addDays(day, moves[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const d = fromISO(day);
      const m = new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), d.getDate());
      next = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
    } else if (e.key === "Home") next = addDays(day, -fromISO(day).getDay());
    else if (e.key === "End") next = addDays(day, 6 - fromISO(day).getDay());
    else if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (!next) return;
    e.preventDefault();
    setFocused(next);
    // Keep the focused day in view.
    const first = monthOf(`${view.year}-${String(view.month + 1).padStart(2, "0")}-01`);
    const lastShown = monthOf(`${first.year}-${String(first.month + 1).padStart(2, "0")}-01`, twoMonths ? 1 : 0);
    const nm = monthOf(next);
    const index = (v) => v.year * 12 + v.month;
    if (index(nm) < index(first)) setView(nm);
    else if (index(nm) > index(lastShown)) setView(monthOf(next, twoMonths ? -1 : 0));
  }

  const shift = (by) => setView((v) => monthOf(`${v.year}-${String(v.month + 1).padStart(2, "0")}-01`, by));
  const atFirstMonth = view.year * 12 + view.month <= monthOf(today).year * 12 + monthOf(today).month;
  const second = monthOf(`${view.year}-${String(view.month + 1).padStart(2, "0")}-01`, 1);

  const trigger = (which, value, btnRef, labelText) => (
    <div className="date-input">
      <span id={`${id}-${which}-label`} className="t-caption-md c-mute">
        {labelText}
      </span>
      <button
        ref={btnRef}
        type="button"
        className={cx("input date-trigger", open === which && "is-open", !value && "is-empty")}
        aria-haspopup="dialog"
        aria-expanded={open === which}
        aria-labelledby={`${id}-${which}-label ${id}-${which}-value`}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        onClick={() => (open === which ? close() : openAt(which))}
      >
        <span id={`${id}-${which}-value`}>{value ? shortDate(value) : "Select a date"}</span>
        <Icon name="calendar" size={18} />
      </button>
    </div>
  );

  return (
    <fieldset className="date-range" ref={wrapRef}>
      <legend className="field-label">When are you going?</legend>
      <div className="date-range-inputs">
        {trigger("start", dates.start, startRef, "Start date")}
        <Icon name="arrowRight" size={18} className="c-ash date-range-arrow" />
        {trigger("end", dates.end, endRef, "Return date")}
      </div>

      {open && (
        <div ref={popRef} className="date-popover" role="dialog" aria-label={open === "start" ? "Choose a start date" : "Choose a return date"}>
          <div className="date-popover-nav">
            <IconButton icon="arrowLeft" size={18} label="Previous month" onClick={() => shift(-1)} disabled={atFirstMonth} />
            <p className="t-body-sm c-mute" aria-live="polite">
              {open === "start" ? "Select a start date" : "Select a return date"}
            </p>
            <IconButton icon="arrowRight" size={18} label="Next month" onClick={() => shift(1)} />
          </div>
          <div className={cx("date-popover-months", twoMonths && "is-two")}>
            <Calendar
              {...view}
              headingId={`${id}-m1`}
              start={dates.start}
              end={dates.end}
              today={today}
              focused={focused}
              isDisabled={isDisabled}
              onPick={pick}
              onKeyDown={onKeyDown}
            />
            {twoMonths && (
              <Calendar
                {...second}
                headingId={`${id}-m2`}
                start={dates.start}
                end={dates.end}
                today={today}
                focused={focused}
                isDisabled={isDisabled}
                onPick={pick}
                onKeyDown={onKeyDown}
              />
            )}
          </div>
          <div className="date-popover-foot">
            <span className="t-body-sm c-mute">
              {complete ? `${formatDateRange(dates.start, dates.end)} · ${plural(daysBetween(dates.start, dates.end) + 1, "day")}` : `Up to ${MAX_TRIP_DAYS} days`}
            </span>
            <Button variant="secondary" onClick={() => close()}>
              Done
            </Button>
          </div>
        </div>
      )}

      <p id={messageId} className={error ? "field-error swap-in" : "field-help"} aria-live="polite">
        {error ??
          (complete
            ? `${formatDateRange(dates.start, dates.end)} · ${plural(daysBetween(dates.start, dates.end) + 1, "day")}${
                source === "prompt" ? " — from your request" : ""
              }`
            : "Or type them in your request, like “12–16 Dec”.")}
      </p>
    </fieldset>
  );
});

export default DateRangeField;
