import { Icon, Reveal, Section } from "@/components/ui";
import { rupees } from "@/utils/format";
import { COST_CATEGORIES } from "../tripMeta";

// Sequential neutrals from DESIGN.md: largest share darkest. Identity comes from the labels.
const SHADES = ["var(--color-ink)", "var(--color-mute)", "var(--color-ash)", "var(--color-stone)"];

/** Part-to-whole as one stacked bar, sorted by amount, every segment directly labelled. */
export default function SpendSection({ plan }) {
  const rows = Object.entries(plan.cost_breakdown ?? {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  if (!rows.length) return null;
  const sum = rows.reduce((total, [, v]) => total + v, 0);

  return (
    <Section id="spend" title="Where the money goes">
      <Reveal className="spend">
        <div className="spend-bar" aria-hidden="true">
          {rows.map(([key, value], i) => (
            <span key={key} style={{ flexGrow: value, background: SHADES[i % SHADES.length], "--i": i }} />
          ))}
        </div>
        <ul className="spend-legend">
          {rows.map(([key, value], i) => {
            const meta = COST_CATEGORIES[key] ?? { label: key, icon: "wallet" };
            return (
              <li key={key} className="spend-item">
                <span className="spend-swatch" style={{ background: SHADES[i % SHADES.length] }} aria-hidden="true" />
                <Icon name={meta.icon} size={18} className="c-mute" />
                <span className="t-body-sm c-body">{meta.label}</span>
                <span className="spend-value">{rupees(value)}</span>
                <span className="t-caption-md c-mute">{Math.round((value / sum) * 100)}%</span>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </Section>
  );
}
