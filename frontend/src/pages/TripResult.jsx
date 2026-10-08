import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, SystemPage } from "@/components/ui";
import { TripPlanView } from "@/features/trips";
import { recallPlan, useSession } from "@/state/session";

function SaveAction({ plan, query }) {
  const { user, openAuth, saveTrip } = useSession();
  const [saved, setSaved] = useState(null);

  // Logged out, the nav's red Sign up is this fold's one red CTA.
  if (!user) {
    return (
      <Button icon="bookmark" onClick={() => openAuth("signup")}>
        Sign up to save
      </Button>
    );
  }
  if (saved) {
    return (
      <Button as={Link} to={`/trips/${saved.id}`} icon="check" className="swap-in">
        Saved — view in My trips
      </Button>
    );
  }
  return (
    <Button variant="primary" icon="bookmark" onClick={() => setSaved(saveTrip(plan, query))}>
      Save trip
    </Button>
  );
}

export default function TripResult() {
  const location = useLocation();
  const { plan, query } = location.state ?? recallPlan() ?? {};

  if (!plan) {
    return (
      <SystemPage
        icon="map"
        title="No plan to show yet"
        actions={
          <Button as={Link} to="/plan" variant="primary">
            Plan a trip
          </Button>
        }
      >
        <p className="t-body-md c-body">Describe a trip and your plan will appear here.</p>
      </SystemPage>
    );
  }

  return (
    <div className="container section">
      <TripPlanView plan={plan} query={query} primaryAction={<SaveAction plan={plan} query={query} />} />
    </div>
  );
}
