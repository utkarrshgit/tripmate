import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { TRIP_SECTIONS, TripHero } from "./sections";

/**
 * A full trip plan: hero with actions, then every section in TRIP_SECTIONS.
 * `primaryAction` / `extraActions` let each page add its own buttons (save, delete…).
 */
export default function TripPlanView({ plan, query, eyebrow, primaryAction, extraActions }) {
  const navigate = useNavigate();
  // Back to the form with the request and the trip's dates, so nothing has to be re-entered.
  const onEditRequest = () =>
    navigate("/plan", {
      state: { query, dates: plan.start_date ? { start: plan.start_date, end: plan.end_date } : null },
    });

  const actions = (
    <>
      {primaryAction}
      <Button icon="edit" onClick={onEditRequest}>
        Edit request
      </Button>
      <Button variant="tertiary" icon="print" onClick={() => window.print()}>
        Print
      </Button>
      {extraActions}
    </>
  );

  return (
    <article className="trip-plan">
      <TripHero plan={plan} query={query} eyebrow={eyebrow} actions={actions} />
      {TRIP_SECTIONS.map((SectionComponent, i) => (
        <SectionComponent key={i} plan={plan} query={query} onEditRequest={onEditRequest} />
      ))}
    </article>
  );
}
