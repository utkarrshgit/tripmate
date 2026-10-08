import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FeatureRow, Masonry, Section } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { ConfirmDeleteTrip, TripCard } from "@/features/trips";
import { useSession } from "@/state/session";
import { plural } from "@/utils/format";

const RATIOS = ["3 / 4", "4 / 5", "2 / 3", "1 / 1"];

export default function MyTrips() {
  const { user, trips, deleteTrip } = useSession();
  const [pendingDelete, setPendingDelete] = useState(null);

  if (!user) {
    return <SignedOutPrompt title="Your trips live here" body="Log in to see the trip plans you've saved." />;
  }

  return (
    <div className="container">
      <Section
        title="Your trips"
        as="h1"
        intro={trips.length ? plural(trips.length, "saved plan") : "Nothing saved yet."}
        actions={
          trips.length > 0 && (
            <Button as={Link} to="/plan" icon="plus">
              Plan another trip
            </Button>
          )
        }
      >
        {trips.length === 0 ? (
          <FeatureRow
            soft
            headingLevel={2}
            title="Save the plans you like"
            body="When a plan looks right, tap “Save trip” on the results page. It'll be waiting here whenever you come back."
            action={
              <Button as={Link} to="/plan" variant="primary">
                Plan your first trip
              </Button>
            }
          />
        ) : (
          <Masonry>
            {trips.map((trip, i) => (
              <TripCard key={trip.id} trip={trip} ratio={RATIOS[i % RATIOS.length]} onDelete={setPendingDelete} />
            ))}
          </Masonry>
        )}
      </Section>

      {pendingDelete && (
        <ConfirmDeleteTrip
          trip={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteTrip(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
