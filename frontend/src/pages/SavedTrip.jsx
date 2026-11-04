import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TripSkeleton } from "@/app/PageSkeletons";
import { Button, Icon, Notice } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { NotFoundView } from "@/features/system";
import { ConfirmDeleteTrip, ItineraryEditor, RenameTripModal, ReviseBox, ShareTripModal, SimilarPlaces, TripPlanView, VersionHistory, useTrip } from "@/features/trips";
import { useSession } from "@/state/session";
import { formatDate, rupees } from "@/utils/format";

export default function SavedTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, deleteTrip } = useSession();
  const { trip, status, error, update } = useTrip(id);
  const [open, setOpen] = useState(null); // null | "delete" | "rename" | "share" | "edit"
  const [deleteError, setDeleteError] = useState(null);

  if (!user) {
    return <SignedOutPrompt title="Log in to see this trip" body="Saved trips are only visible to the account that saved them." />;
  }
  if (status === "loading") return <TripSkeleton />;
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

  const planAgain = () =>
    navigate("/plan", {
      state: {
        query: trip.query,
        run: true,
        dates: trip.plan.start_date ? { start: trip.plan.start_date, end: trip.plan.end_date } : null,
        forTrip: { id: trip.id, title: trip.title },
      },
    });

  const version = trip.versions.length > 1 ? ` · Version ${trip.version.no}` : "";

  return (
    <div className="container section">
      <Button as={Link} to="/trips" variant="tertiary" icon="arrowLeft" className="back-link no-print">
        Your trips
      </Button>
      {trip.pricing && (
        <Notice icon="check" tone="success" className="saved-pricing">
          <p className="t-body-sm">
            Exact prices checked {formatDate(trip.pricing.checkedAt)}: <strong>{rupees(trip.pricing.total)}</strong> total
            {trip.pricing.response?.is_sample ? " (sample prices)" : ""}.{" "}
            <Link to={`/trips/${trip.id}/prices`} className="link-inline">
              View details <Icon name="arrowRight" size={14} />
            </Link>
          </p>
        </Notice>
      )}
      <TripPlanView
        plan={trip.plan}
        query={trip.query}
        eyebrow={`${trip.title} · Saved on ${formatDate(trip.savedAt)}${version}`}
        primaryAction={
          <>
            <Button as={Link} to={`/trips/${trip.id}/prices`} variant="primary" icon="wallet">
              {trip.pricing ? "View exact prices" : "Get exact prices"}
            </Button>
            <Button icon="refresh" onClick={planAgain}>
              Plan again
            </Button>
            <Button icon="edit" onClick={() => setOpen("edit")}>
              Edit days
            </Button>
            <Button icon="copy" onClick={() => setOpen("share")}>
              Share
            </Button>
          </>
        }
        extraActions={
          <>
            <Button variant="tertiary" icon="edit" onClick={() => setOpen("rename")}>
              Rename
            </Button>
            <Button variant="tertiary" icon="trash" onClick={() => setOpen("delete")}>
              Delete trip
            </Button>
          </>
        }
      />
      <ReviseBox trip={trip} onChange={update} />
      <VersionHistory trip={trip} onRestored={update} />
      <SimilarPlaces destination={trip.plan.destination} />

      {open === "edit" && <ItineraryEditor trip={trip} onChange={update} onClose={() => setOpen(null)} />}
      {open === "share" && <ShareTripModal trip={trip} onClose={() => setOpen(null)} />}
      {open === "rename" && <RenameTripModal trip={trip} onRenamed={update} onClose={() => setOpen(null)} />}
      {open === "delete" && (
        <ConfirmDeleteTrip
          trip={trip}
          error={deleteError}
          onCancel={() => setOpen(null)}
          onConfirm={async () => {
            try {
              await deleteTrip(trip.id);
              navigate("/trips", { replace: true });
            } catch (err) {
              setDeleteError(err.message);
            }
          }}
        />
      )}
    </div>
  );
}
