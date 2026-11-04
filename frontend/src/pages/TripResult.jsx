import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, SystemPage } from "@/components/ui";
import { TripPlanView, useTripSaver } from "@/features/trips";
import { recallPlan, useSession } from "@/state/session";

/**
 * The results page's next steps. Exact prices are the main one; saving comes second.
 * Logged out, the nav's red Sign up is the fold's one red CTA, so nothing here is red.
 * After a saved trip's Plan again (`forTrip`), saving adds a new version to that trip.
 */
function TripActions({ plan, query, forTrip }) {
  const { user, openAuth } = useSession();
  const { saved, busy, error, save } = useTripSaver(forTrip);
  // Signing up from "Sign up to save" saves the trip as soon as the account is ready.
  const [saveAfterSignIn, setSaveAfterSignIn] = useState(false);
  useEffect(() => {
    if (!saveAfterSignIn || !user) return;
    setSaveAfterSignIn(false);
    save(plan, query);
  }, [saveAfterSignIn, user, plan, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const exact = (
    <Button as={Link} to="/trip/prices" state={{ plan, query, forTrip }} variant={user ? "primary" : "secondary"} icon="wallet">
      Get exact prices
    </Button>
  );
  let action;
  if (!user) {
    action = (
      <Button icon="bookmark" onClick={() => openAuth("signup", { then: () => setSaveAfterSignIn(true) })}>
        Sign up to save
      </Button>
    );
  } else if (saved) {
    action = (
      <Button as={Link} to={`/trips/${saved.id}`} icon="check" className="swap-in">
        {forTrip ? "View updated trip" : "View saved trip"}
      </Button>
    );
  } else {
    action = (
      <Button icon="bookmark" disabled={busy} onClick={() => save(plan, query)}>
        {busy ? "Saving…" : forTrip ? `Save as a new version of ${forTrip.title}` : "Save trip"}
      </Button>
    );
  }
  return (
    <>
      {exact}
      {action}
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export default function TripResult() {
  const location = useLocation();
  const { plan, query, forTrip = null } = location.state ?? recallPlan() ?? {};

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
      <TripPlanView plan={plan} query={query} primaryAction={<TripActions plan={plan} query={query} forTrip={forTrip} />} />
    </div>
  );
}
