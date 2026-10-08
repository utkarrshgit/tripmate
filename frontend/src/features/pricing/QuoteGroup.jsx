import { useId } from "react";
import { Icon, Tile } from "@/components/ui";
import { cx } from "@/utils/cx";
import { rupees } from "@/utils/format";

/**
 * A choosable list of quotes (radio group) drawn as an emphasis bar chart:
 * the selected option in ink, the rest in stone. Quotes arrive cheapest first.
 */
export default function QuoteGroup({ icon, title, quotes, selected, onSelect, empty }) {
  const name = useId();
  const max = Math.max(...quotes.map((q) => q.price), 1);

  return (
    <Tile className="quote-group">
      <p className="category-tile-title inline-icon">
        <Icon name={icon} size={18} /> {title}
      </p>
      {quotes.length === 0 ? (
        <p className="t-body-sm c-mute">{empty}</p>
      ) : (
        <div className="quote-list" role="radiogroup" aria-label={title}>
          {quotes.map((q, i) => (
            <label key={`${q.name}-${i}`} className={cx("quote-row", i === selected && "is-selected")}>
              <input type="radio" name={name} className="visually-hidden" checked={i === selected} onChange={() => onSelect(i)} />
              <span className="quote-label">
                <span className="t-body-sm-strong c-ink">
                  {q.name}
                  {i === 0 && <span className="quote-tag">Cheapest</span>}
                </span>
                <span className="t-caption-md c-mute">{q.detail}</span>
              </span>
              <span className="quote-bar" aria-hidden="true">
                <span style={{ width: `${(q.price / max) * 100}%`, "--i": i }} />
              </span>
              <span className="quote-price">
                {i === selected && <Icon name="check" size={14} />}
                {rupees(q.price)}
              </span>
            </label>
          ))}
        </div>
      )}
    </Tile>
  );
}
