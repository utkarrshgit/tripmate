import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { NotFoundView } from "@/features/system";
import { ConfirmDeleteTrip, TripPlanView } from "@/features/trips";
import { useSession } from "@/state/session";
import { formatDate } from "@/utils/format";

export default function SavedTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, trips, deleteTrip } = useSession();
  const [confirming, setConfirming] = useState(false);

  if (!user) {
    return <SignedOutPrompt title="Log in to see this trip" body="Saved trips are only visible to the account that saved them." />;
  }

  const trip = trips.find((t) => t.id === id);
  if (!trip) return <NotFoundView />;

  return (
    <div className="container section">
      <Button as={Link} to="/trips" variant="tertiary" icon="arrowLeft" className="back-link no-print">
        My trips
      </Button>
      <TripPlanView
        plan={trip.plan}
        query={trip.query}
        eyebrow={`Saved on ${formatDate(trip.savedAt)}`}
        primaryAction={
          <Button variant="primary" icon="refresh" onClick={() => navigate("/plan", { state: { query: trip.query, run: true } })}>
            Plan again
          </Button>
        }
        extraActions={
          <Button variant="tertiary" icon="trash" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        }
      />
      {confirming && (
        <ConfirmDeleteTrip
          trip={trip}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            deleteTrip(trip.id);
            navigate("/trips", { replace: true });
          }}
        />
      )}
    </div>
  );
}
