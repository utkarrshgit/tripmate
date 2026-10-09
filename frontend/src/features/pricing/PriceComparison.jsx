import { Icon, StatusPill } from "@/components/ui";
import { rupees } from "@/utils/format";

const LABELS = { transport: "Getting there", hotel: "Stays", food: "Food", activities: "Activities" };

/** Estimated vs exact totals, with what changed and which parts are still estimates. */
export default function PriceComparison({ estimate, exact, parts }) {
  const diff = exact - estimate;
  const tone = Math.abs(diff) < 1 ? "neutral" : diff < 0 ? "success" : "error";
  const stillEstimated = Object.entries(parts)
    .filter(([, p]) => !p.exact && p.value > 0)
    .map(([k]) => LABELS[k].toLowerCase());

  return (
    <div className="price-compare">
      <div className="price-compare-cell">
        <p className="t-body-sm c-mute">Estimated</p>
        <p className="kpi-value c-mute price-compare-old">{rupees(estimate)}</p>
      </div>
      <Icon name="arrowRight" size={20} className="c-ash" />
      <div className="price-compare-cell">
        <p className="t-body-sm c-mute">With exact prices</p>
        <p className="hero-figure">{rupees(exact)}</p>
      </div>
      <div className="price-compare-delta">
        <StatusPill tone={tone} icon={tone === "error" ? "alert" : "check"}>
          {tone === "neutral" ? "Same as estimated" : `${rupees(Math.abs(diff))} ${diff < 0 ? "less" : "more"} than estimated`}
        </StatusPill>
        {stillEstimated.length > 0 && (
          <p className="t-caption-md c-mute">{new Intl.ListFormat("en", { type: "conjunction" }).format(stillEstimated)} are still estimates</p>
        )}
      </div>
    </div>
  );
}
