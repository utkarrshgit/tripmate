import { forwardRef, useId } from "react";
import { Icon } from "@/components/ui";
import { formatDateRange, plural } from "@/utils/format";
import { addDays, daysBetween, todayISO } from "./dateParsing";

/**
 * "When" step: start and end date pickers (the browser's native calendar),
 * styled as DESIGN.md text-inputs. `source` says where the dates came from:
 * "prompt" (read from the request text) or "picker" (chosen by hand).
 */
const DateRangeField = forwardRef(function DateRangeField({ dates, source, error, onChange }, ref) {
  const id = useId();
  const today = todayISO();
  const complete = dates.start && dates.end && dates.end >= dates.start;
  const messageId = `${id}-message`;

  function setStart(start) {
    // Keep the trip length when moving the start; otherwise default to a 3-day trip.
    let end = dates.end;
    if (start && dates.start && dates.end) end = addDays(start, daysBetween(dates.start, dates.end));
    else if (start && (!end || end < start)) end = addDays(start, 2);
    onChange({ start, end });
  }

  return (
    <fieldset className="date-range" aria-describedby={messageId}>
      <legend className="field-label">When are you going?</legend>
      <div className="date-range-inputs">
        <div className="date-input">
          <label htmlFor={`${id}-start`} className="t-caption-md c-mute">
            Start date
          </label>
          <input
            id={`${id}-start`}
            ref={ref}
            type="date"
            className="input"
            min={today}
            value={dates.start ?? ""}
            onChange={(e) => setStart(e.target.value || null)}
            aria-invalid={Boolean(error)}
            required
          />
        </div>
        <Icon name="arrowRight" size={18} className="c-ash date-range-arrow" />
        <div className="date-input">
          <label htmlFor={`${id}-end`} className="t-caption-md c-mute">
            Return date
          </label>
          <input
            id={`${id}-end`}
            type="date"
            className="input"
            min={dates.start || today}
            value={dates.end ?? ""}
            onChange={(e) => onChange({ ...dates, end: e.target.value || null })}
            aria-invalid={Boolean(error)}
            required
          />
        </div>
      </div>
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
