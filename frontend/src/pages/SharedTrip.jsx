import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TripSkeleton } from "@/app/PageSkeletons";
import { Button, SystemPage } from "@/components/ui";
import { TripHero, TRIP_SECTIONS } from "@/features/trips/sections";
import { openShared } from "@/state/tripsApi";
import { formatDate } from "@/utils/format";

/** A trip someone shared: read-only, no account needed. */
export default function SharedTrip() {
  const { token } = useParams();
  const [state, setState] = useState({ trip: null, status: "loading" });

  useEffect(() => {
    let live = true;
    openShared(token)
      .then((trip) => live && setState({ trip, status: "ready" }))
      .catch((err) => live && setState({ trip: null, status: err.status === 404 ? "missing" : "error", message: err.message }));
    return () => {
      live = false;
    };
  }, [token]);

  if (state.status === "loading") return <TripSkeleton />;
  if (state.status !== "ready") {
    return (
      <SystemPage
        icon="map"
        title={state.status === "missing" ? "This link doesn't work any more" : "We couldn't open this trip"}
        actions={
          <Button as={Link} to="/plan" variant="primary">
            Plan your own trip
          </Button>
        }
      >
        <p className="t-body-md c-body">
          {state.status === "missing" ? "The person who shared it may have turned the link off or deleted the trip." : state.message}
        </p>
      </SystemPage>
    );
  }

  const { trip } = state;
  return (
    <div className="container section">
      <article className="trip-plan">
        <TripHero
          plan={trip.plan}
          query={trip.query}
          eyebrow={`Shared by ${trip.sharedBy} · ${trip.title} · Saved on ${formatDate(trip.savedAt)}`}
          actions={
            <Button as={Link} to="/plan" state={{ query: trip.query }} variant="primary" icon="compass">
              Plan a trip like this
            </Button>
          }
        />
        {TRIP_SECTIONS.map((SectionComponent, i) => (
          <SectionComponent key={i} plan={trip.plan} query={trip.query} />
        ))}
      </article>
    </div>
  );
}
