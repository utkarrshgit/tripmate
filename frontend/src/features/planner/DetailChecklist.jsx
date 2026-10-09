import { Icon, Tile } from "@/components/ui";
import { cx } from "@/utils/cx";
import { plural } from "@/utils/format";
import { daysBetween } from "./dateParsing";
import { REQUEST_DETAILS, detectDetails } from "./requestDetails";

/**
 * Live "what we've picked up" list; a check pops in as each detail is detected.
 * Travel dates (from the text or the picker) also settle the trip length.
 */
export default function DetailChecklist({ query, dates }) {
  const found = detectDetails(query);
  const hasDates = Boolean(dates?.start && dates?.end && dates.end >= dates.start);
  if (hasDates) found.days = true;
  const hints = { days: hasDates ? `From your dates: ${plural(daysBetween(dates.start, dates.end) + 1, "day")}` : null };
  return (
    <Tile className="detail-checklist">
      <p className="t-body-sm-strong c-ink">What we found in your request</p>
      <ul className="divided">
        {REQUEST_DETAILS.map((d) => (
          <li key={d.id} className={cx("detail-check", found[d.id] && "is-found")}>
            <span className="detail-check-icon" key={found[d.id] ? "on" : "off"}>
              <Icon name={found[d.id] ? "check" : "circle"} size={18} />
            </span>
            <span className="t-body-sm c-ink">{d.label}</span>
            <span className="t-body-sm c-mute detail-check-hint">{hints[d.id] ?? (found[d.id] ? "Found" : d.hint)}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
