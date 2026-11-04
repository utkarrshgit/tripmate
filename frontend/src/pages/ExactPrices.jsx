import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FormSkeleton } from "@/app/PageSkeletons";
import { Button, Notice, SystemPage } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { ExactPricesView } from "@/features/pricing";
import { NotFoundView } from "@/features/system";
import { useTrip, useTripSaver } from "@/features/trips";
import { recallPlan, useSession } from "@/state/session";
import { savePricing } from "@/state/tripsApi";

/** Save buttons for a fresh plan (/trip/prices). */
function SaveNewTrip({ plan, query, pricing, forTrip }) {
  const { user, openAuth } = useSession();
  const { saved, busy, error, save } = useTripSaver(forTrip);
  // Signing up from "Sign up to save" saves the trip as soon as the account is ready.
  const [saveAfterSignIn, setSaveAfterSignIn] = useState(false);
  useEffect(() => {
    // Waits for the prices too, since this button saves the trip with them.
    if (!saveAfterSignIn || !user || !pricing) return;
    setSaveAfterSignIn(false);
    save(plan, query, pricing);
  }, [saveAfterSignIn, user, plan, query, pricing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) {
    return (
      <Button icon="bookmark" onClick={() => openAuth("signup", { then: () => setSaveAfterSignIn(true) })}>
        Sign up to save
      </Button>
    );
  }
  if (saved) {
    return (
      <Button as={Link} to={`/trips/${saved.id}`} icon="check" className="swap-in">
        {forTrip ? "View updated trip" : "View saved trip"}
      </Button>
    );
  }
  return (
    <>
      <Button variant="primary" icon="bookmark" disabled={!pricing || busy} onClick={() => save(plan, query, pricing)}>
        {busy ? "Saving…" : forTrip ? `Save as a new version of ${forTrip.title}` : "Save trip with these prices"}
      </Button>
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Save button for a trip that's already saved (/trips/:id/prices). */
function UpdateSavedTrip({ trip, pricing, onSaved }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  if (done) {
    return (
      <Button as={Link} to={`/trips/${trip.id}`} icon="check" className="swap-in">
        View saved trip
      </Button>
    );
  }
  return (
    <>
      <Button
        variant="primary"
        icon="bookmark"
        disabled={!pricing}
        onClick={async () => {
          setError(null);
          try {
            onSaved(await savePricing(trip.id, pricing));
            setDone(true);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        Save these prices to the trip
      </Button>
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function SavedTripPrices({ id }) {
  const { user } = useSession();
  const { trip, status, error, update } = useTrip(id);
  if (!user) return <SignedOutPrompt title="Log in to price this trip" body="Saved trips are only visible to the account that saved them." />;
  if (status === "loading") return <FormSkeleton />;
  if (status === "missing") return <NotFoundView />;
  if (status === "error") {
    return (
      <div className="container section">
        <Notice tone="error" icon="alert">
          <p className="t-body-sm">{error}</p>
        </Notice>
      </div>
    );
  }
  return (
    <div className="container section">
      <ExactPricesView
        plan={trip.plan}
        query={trip.query}
        saved={trip.pricing}
        backTo={{ to: `/trips/${trip.id}`, label: "Back to trip" }}
        renderActions={(pricing) => <UpdateSavedTrip trip={trip} pricing={pricing} onSaved={update} />}
      />
    </div>
  );
}

function NewTripPrices() {
  const location = useLocation();
  const { plan, query, forTrip = null } = location.state ?? recallPlan() ?? {};
  if (!plan) {
    return (
      <SystemPage
        icon="wallet"
        title="Plan a trip first"
        actions={
          <Button as={Link} to="/plan" variant="primary">
            Plan a trip
          </Button>
        }
      >
        <p className="t-body-md c-body">Plan a trip, then check its exact prices.</p>
      </SystemPage>
    );
  }
  return (
    <div className="container section">
      <ExactPricesView
        plan={plan}
        query={query}
        backTo={{ to: "/trip", state: { plan, query, forTrip }, label: "Back to trip" }}
        renderActions={(pricing) => <SaveNewTrip plan={plan} query={query} pricing={pricing} forTrip={forTrip} />}
      />
    </div>
  );
}

/** /trip/prices (a fresh plan) and /trips/:id/prices (a saved trip). */
export default function ExactPrices() {
  const { id } = useParams();
  return id ? <SavedTripPrices id={id} /> : <NewTripPrices />;
}
