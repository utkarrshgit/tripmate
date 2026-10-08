import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Icon, Notice } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { NotFoundView } from "@/features/system";
import { ConfirmDeleteTrip, TripPlanView } from "@/features/trips";
import { useSession } from "@/state/session";
import { formatDate, rupees } from "@/utils/format";

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
      {trip.pricing && (
        <Notice icon="check" tone="success" className="saved-pricing">
          <p className="t-body-sm">
            Exact prices checked on {formatDate(trip.pricing.checkedAt)}: <strong>{rupees(trip.pricing.total)}</strong>
            {trip.pricing.response?.is_sample ? " (sample prices)" : ""}.{" "}
            <Link to={`/trips/${trip.id}/prices`} className="link-inline">
              See details <Icon name="arrowRight" size={14} />
            </Link>
          </p>
        </Notice>
      )}
      <TripPlanView
        plan={trip.plan}
        query={trip.query}
        eyebrow={`Saved on ${formatDate(trip.savedAt)}`}
        primaryAction={
          <>
            <Button as={Link} to={`/trips/${trip.id}/prices`} variant="primary" icon="wallet">
              {trip.pricing ? "View exact prices" : "Get exact prices"}
            </Button>
            <Button
              icon="refresh"
              onClick={() =>
                navigate("/plan", {
                  state: {
                    query: trip.query,
                    run: true,
                    dates: trip.plan.start_date ? { start: trip.plan.start_date, end: trip.plan.end_date } : null,
                  },
                })
              }
            >
              Plan again
            </Button>
          </>
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
