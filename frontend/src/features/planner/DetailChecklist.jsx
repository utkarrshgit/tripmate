import { Icon, Tile } from "@/components/ui";
import { cx } from "@/utils/cx";
import { REQUEST_DETAILS, detectDetails } from "./requestDetails";

/** Live "what we've picked up" list; a check pops in as each detail is detected. */
export default function DetailChecklist({ query }) {
  const found = detectDetails(query);
  return (
    <Tile className="detail-checklist">
      <p className="t-body-sm-strong c-ink">What we've picked up so far</p>
      <ul className="divided">
        {REQUEST_DETAILS.map((d) => (
          <li key={d.id} className={cx("detail-check", found[d.id] && "is-found")}>
            <span className="detail-check-icon" key={found[d.id] ? "on" : "off"}>
              <Icon name={found[d.id] ? "check" : "circle"} size={18} />
            </span>
            <span className="t-body-sm c-ink">{d.label}</span>
            <span className="t-body-sm c-mute detail-check-hint">{found[d.id] ? "Got it" : d.hint}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
