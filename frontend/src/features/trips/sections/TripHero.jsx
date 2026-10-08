import { Chip, ChipStrip, Icon, PinCard, StatusPill } from "@/components/ui";
import { imageForDestination } from "@/data/images";
import { formatDateRange, plural, rupees } from "@/utils/format";
import { titleCase } from "../tripMeta";

/** Plans only ever carry estimates; exact prices are a separate step. */
function EstimateTag() {
  return (
    <StatusPill icon="info" className="estimate-tag">
      Estimate
    </StatusPill>
  );
}

/** Total against budget as a meter: fill = spend, tick = budget (DESIGN.md: ink, error for over). */
function BudgetMeter({ total, budget }) {
  if (!budget) {
    return (
      <div className="budget-meter">
        <div className="budget-meter-head">
          <p className="hero-figure">{rupees(total)}</p>
          <EstimateTag />
        </div>
      </div>
    );
  }
  const over = total > budget;
  const scale = Math.max(total, budget);
  const fill = (total / scale) * 100;
  const tick = (budget / scale) * 100;

  return (
    <div className="budget-meter">
      <div className="budget-meter-head">
        <p className="hero-figure">{rupees(total)}</p>
        <p className="t-body-sm c-mute">of {rupees(budget)}</p>
        <EstimateTag />
      </div>
      <div
        className={`meter${over ? " is-over" : ""}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={total}
        aria-label="Estimated total against your budget"
      >
        <span className="meter-fill" style={{ width: `${fill}%` }} />
        <span className="meter-tick" style={{ left: `${tick}%` }} />
      </div>
      <p className={`t-body-sm-strong inline-icon ${over ? "c-error" : "c-success"}`}>
        <Icon name={over ? "alert" : "check"} size={16} />
        {over ? `${rupees(total - budget)} over budget` : `${rupees(budget - total)} to spare`}
      </p>
    </div>
  );
}

export default function TripHero({ plan, query, eyebrow, actions }) {
  const days = Math.max(plan.days, 1);
  const travelers = Math.max(plan.travelers, 1);
  // Issues the meter already shows (over budget) aren't repeated as text.
  const issues = (plan.issues ?? []).filter((i) => !/exceeds the .* budget/i.test(i));

  return (
    <header className="trip-hero">
      <div className="trip-hero-media">
        <PinCard src={imageForDestination(plan.destination)} alt={plan.destination} ratio="4 / 5" large />
      </div>

      <div className="trip-hero-body stack-xl">
        <div className="stack-md">
          {eyebrow && <p className="t-body-sm-strong c-mute">{eyebrow}</p>}
          <h1 className="t-display-lg">{plan.destination || "Your trip"}</h1>
          <ChipStrip>
            <Chip>
              <Icon name="calendar" size={16} />{" "}
              {plan.start_date ? `${formatDateRange(plan.start_date, plan.end_date)} · ` : ""}
              {plural(plan.days, "day")}
            </Chip>
            <Chip>
              <Icon name="user" size={16} /> {plural(plan.travelers, "traveler")}
            </Chip>
            {(plan.interests ?? []).map((i) => (
              <Chip key={i}>{titleCase(i)}</Chip>
            ))}
          </ChipStrip>
        </div>

        <div className="trip-numbers">
          <BudgetMeter total={plan.total_cost} budget={plan.budget} />
          <dl className="kpi-row">
            <div>
              <dt className="t-body-sm c-mute">per day</dt>
              <dd className="kpi-value">{rupees(plan.total_cost / days)}</dd>
            </div>
            <div>
              <dt className="t-body-sm c-mute">per person</dt>
              <dd className="kpi-value">{rupees(plan.total_cost / travelers)}</dd>
            </div>
          </dl>
        </div>

        {issues.length > 0 && (
          <ul className="trip-issues">
            {issues.map((issue) => (
              <li key={issue} className="t-body-sm c-error inline-icon">
                <Icon name="alert" size={16} /> {issue}
              </li>
            ))}
          </ul>
        )}

        <div className="row no-print">{actions}</div>
        {query && <p className="t-caption-sm c-mute trip-query">“{query}”</p>}
      </div>
    </header>
  );
}
