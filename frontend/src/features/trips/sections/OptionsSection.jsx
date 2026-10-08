import { Icon, Reveal, Section, Tile } from "@/components/ui";
import { plural, rupees } from "@/utils/format";

/**
 * Options as an emphasis bar chart: the option counted in the estimate (the
 * backend uses the first of each list) in ink, alternatives in stone.
 */
function OptionGroup({ icon, title, options }) {
  if (!options.length) return null;
  const max = Math.max(...options.map((o) => o.price));
  return (
    <Tile className="option-group">
      <p className="category-tile-title inline-icon">
        <Icon name={icon} size={18} /> {title}
      </p>
      <ul className="stack-md">
        {options.map((o, i) => (
          <li key={o.label} className={`option-row${i === 0 ? " is-picked" : ""}`}>
            <span className="option-label">
              <span className="t-body-sm-strong c-ink">{o.label}</span>
              {o.meta && <span className="t-caption-md c-mute">{o.meta}</span>}
            </span>
            <span className="option-bar" aria-hidden="true">
              <span style={{ width: `${(o.price / max) * 100}%`, "--i": i }} />
            </span>
            <span className="option-price">
              {i === 0 && <Icon name="check" size={14} title="Counted in your total" />}
              {rupees(o.price)}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

export default function OptionsSection({ plan }) {
  const transport = (plan.transport_options ?? []).map((o) => ({ label: o.mode, price: o.estimated_cost }));
  const stays = (plan.hotel_options ?? []).map((o) => ({
    label: o.name,
    meta: `${plural(o.rooms, "room")} · ${rupees(o.nightly_rate)}/night`,
    price: o.estimated_total,
  }));
  if (!transport.length && !stays.length) return null;

  return (
    <Section id="options" title="Getting there & staying">
      <Reveal className="option-groups">
        <OptionGroup icon="train" title="Travel" options={transport} />
        <OptionGroup icon="bed" title="Stays" options={stays} />
      </Reveal>
      <p className="t-caption-md c-mute inline-icon option-key">
        <Icon name="check" size={14} /> counted in your total
      </p>
    </Section>
  );
}
