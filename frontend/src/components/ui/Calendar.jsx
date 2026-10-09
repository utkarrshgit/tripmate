import { cx } from "@/utils/cx";
import "./Calendar.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Every day cell for a month view, Sunday first; days outside the month are null. */
function monthCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

const longLabel = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

/**
 * One month of days, as a grid of buttons. Presentational: the parent owns the
 * selection and keyboard focus.
 *   year, month      Month to show (month is 0–11)
 *   start, end       Selected range, ISO dates (either may be null)
 *   today            ISO date marked as today
 *   focused          ISO date that takes tab focus (roving tabindex)
 *   isDisabled(iso)  Days that can't be picked
 *   onPick(iso)      A day was picked
 *   onKeyDown(e, iso) Arrow-key navigation, handled by the parent
 */
export default function Calendar({ year, month, start, end, today, focused, isDisabled, onPick, onKeyDown, headingId }) {
  const title = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="calendar">
      <p id={headingId} className="calendar-title">
        {title}
      </p>
      <table className="calendar-grid" role="grid" aria-labelledby={headingId}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" abbr={d}>
                <span aria-hidden="true">{d.slice(0, 1)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: monthCells(year, month).length / 7 }, (_, row) => (
            <tr key={row}>
              {monthCells(year, month)
                .slice(row * 7, row * 7 + 7)
                .map((day, col) => {
                  if (!day) return <td key={col} />;
                  const disabled = isDisabled(day);
                  const isStart = day === start;
                  const isEnd = day === end;
                  const inRange = start && end && day > start && day < end;
                  const selected = isStart || isEnd;
                  return (
                    <td
                      key={day}
                      className={cx(
                        "calendar-cell",
                        inRange && "is-in-range",
                        isStart && end && end !== start && "is-range-start",
                        isEnd && start && end !== start && "is-range-end",
                      )}
                    >
                      <button
                        type="button"
                        data-day={day}
                        className={cx("calendar-day", selected && "is-selected", day === today && "is-today")}
                        tabIndex={day === focused ? 0 : -1}
                        aria-pressed={selected}
                        aria-disabled={disabled || undefined}
                        aria-label={`${longLabel(day)}${isStart ? ", start date" : ""}${isEnd ? ", return date" : ""}${day === today ? ", today" : ""}`}
                        onClick={() => !disabled && onPick(day)}
                        onKeyDown={(e) => onKeyDown(e, day)}
                      >
                        {Number(day.slice(8))}
                      </button>
                    </td>
                  );
                })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
