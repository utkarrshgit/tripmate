import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button, SystemPage } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { ExactPricesView } from "@/features/pricing";
import { NotFoundView } from "@/features/system";
import { recallPlan, useSession } from "@/state/session";

/** Save buttons for a fresh plan (/trip/prices). */
function SaveNewTrip({ plan, query, pricing }) {
  const { user, openAuth, saveTrip } = useSession();
  const [saved, setSaved] = useState(null);
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
        Saved — view trip
      </Button>
    );
  }
  return (
    <Button variant="primary" icon="bookmark" disabled={!pricing} onClick={() => setSaved(saveTrip(plan, query, pricing))}>
      Save trip with these prices
    </Button>
  );
}

/** Save button for a trip that's already saved (/trips/:id/prices). */
function UpdateSavedTrip({ trip, pricing }) {
  const { updateTrip } = useSession();
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Button as={Link} to={`/trips/${trip.id}`} icon="check" className="swap-in">
        Saved — back to trip
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      icon="bookmark"
      disabled={!pricing}
      onClick={() => {
        updateTrip(trip.id, { pricing });
        setDone(true);
      }}
    >
      Save these prices to the trip
    </Button>
  );
}

function SavedTripPrices({ id }) {
  const { user, trips } = useSession();
  if (!user) return <SignedOutPrompt title="Log in to price this trip" body="Saved trips are only visible to the account that saved them." />;
  const trip = trips.find((t) => t.id === id);
  if (!trip) return <NotFoundView />;
  return (
    <div className="container section">
      <ExactPricesView
        plan={trip.plan}
        query={trip.query}
        saved={trip.pricing}
        backTo={{ to: `/trips/${trip.id}`, label: "Back to trip" }}
        renderActions={(pricing) => <UpdateSavedTrip trip={trip} pricing={pricing} />}
      />
    </div>
  );
}

function NewTripPrices() {
  const location = useLocation();
  const { plan, query } = location.state ?? recallPlan() ?? {};
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
        <p className="t-body-md c-body">Exact prices are checked for a planned trip.</p>
      </SystemPage>
    );
  }
  return (
    <div className="container section">
      <ExactPricesView
        plan={plan}
        query={query}
        backTo={{ to: "/trip", state: { plan, query }, label: "Back to trip" }}
        renderActions={(pricing) => <SaveNewTrip plan={plan} query={query} pricing={pricing} />}
      />
    </div>
  );
}

/** /trip/prices (a fresh plan) and /trips/:id/prices (a saved trip). */
export default function ExactPrices() {
  const { id } = useParams();
  return id ? <SavedTripPrices id={id} /> : <NewTripPrices />;
}
