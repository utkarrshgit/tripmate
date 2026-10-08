import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { TRIP_SECTIONS, TripHero } from "./sections";

/**
 * A full trip plan: hero with actions, then every section in TRIP_SECTIONS.
 * `primaryAction` / `extraActions` let each page add its own buttons (save, delete…).
 */
export default function TripPlanView({ plan, query, eyebrow, primaryAction, extraActions }) {
  const navigate = useNavigate();
  const onEditRequest = () => navigate("/plan", { state: { query } });

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
