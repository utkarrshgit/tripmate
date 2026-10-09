import { useNavigate } from "react-router-dom";
import { IconButton, OverlayPill, PinCard } from "@/components/ui";
import { imageForDestination } from "@/data/images";
import { formatDate, plural, rupees } from "@/utils/format";
import { tripName, tripPhrase } from "./tripMeta";

/** A saved trip as a pin: date top-left, actions top-right, details bottom-left. */
export default function TripCard({ trip, ratio, onDelete }) {
  const navigate = useNavigate();
  const { plan } = trip;
  return (
    <PinCard
      src={imageForDestination(plan.destination)}
      alt={tripName(plan)}
      ratio={ratio}
      to={`/trips/${trip.id}`}
      label={`Open ${tripPhrase(plan)}`}
      topLeft={<OverlayPill>{formatDate(trip.savedAt)}</OverlayPill>}
      topRight={
        <span className="row pin-actions">
          <IconButton
            icon="refresh"
            size={18}
            label={`Plan ${tripPhrase(plan)} again`}
            onClick={() =>
              navigate("/plan", {
                state: { query: trip.query, run: true, dates: plan.start_date ? { start: plan.start_date, end: plan.end_date } : null },
              })
            }
          />
          <IconButton icon="trash" size={18} label={`Delete ${tripPhrase(plan)}`} onClick={() => onDelete(trip)} />
        </span>
      }
      bottomLeft={
        <span className="stack-xs pin-meta">
          <OverlayPill>{tripName(plan)}</OverlayPill>
          <OverlayPill>
            {plural(plan.days, "day")} · {plural(plan.travelers, "person", "people")}
          </OverlayPill>
          <OverlayPill>{rupees(plan.total_cost)}</OverlayPill>
        </span>
      }
    />
  );
}
