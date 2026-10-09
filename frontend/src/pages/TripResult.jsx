import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, SystemPage } from "@/components/ui";
import { TripPlanView } from "@/features/trips";
import { recallPlan, useSession } from "@/state/session";

/**
 * The results page's next steps. Exact prices are the main one; saving comes second.
 * Logged out, the nav's red Sign up is the fold's one red CTA, so nothing here is red.
 */
function TripActions({ plan, query }) {
  const { user, openAuth, saveTrip } = useSession();
  const [saved, setSaved] = useState(null);

  const exact = (
    <Button as={Link} to="/trip/prices" state={{ plan, query }} variant={user ? "primary" : "secondary"} icon="wallet">
      Get exact prices
    </Button>
  );
  let save;
  if (!user) {
    save = (
      <Button icon="bookmark" onClick={() => openAuth("signup")}>
        Sign up to save
      </Button>
    );
  } else if (saved) {
    save = (
      <Button as={Link} to={`/trips/${saved.id}`} icon="check" className="swap-in">
        View saved trip
      </Button>
    );
  } else {
    save = (
      <Button icon="bookmark" onClick={() => setSaved(saveTrip(plan, query))}>
        Save trip
      </Button>
    );
  }
  return (
    <>
      {exact}
      {save}
    </>
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
      <TripPlanView plan={plan} query={query} primaryAction={<TripActions plan={plan} query={query} />} />
    </div>
  );
}
