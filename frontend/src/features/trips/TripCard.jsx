import { useNavigate } from "react-router-dom";
import { IconButton, OverlayPill, PinCard } from "@/components/ui";
import { imageForDestination } from "@/data/images";
import { formatDate, plural, rupees } from "@/utils/format";

/** A saved trip as a pin: date top-left, actions top-right, details bottom-left. */
export default function TripCard({ trip, ratio, onDelete }) {
  const navigate = useNavigate();
  const { plan } = trip;
  return (
    <PinCard
      src={imageForDestination(plan.destination)}
      alt={plan.destination}
      ratio={ratio}
      to={`/trips/${trip.id}`}
      label={`Open your ${plan.destination} trip`}
      topLeft={<OverlayPill>{formatDate(trip.savedAt)}</OverlayPill>}
      topRight={
        <span className="row pin-actions">
          <IconButton
            icon="refresh"
            size={18}
            label={`Plan ${plan.destination} again`}
            onClick={() =>
              navigate("/plan", {
                state: { query: trip.query, run: true, dates: plan.start_date ? { start: plan.start_date, end: plan.end_date } : null },
              })
            }
          />
          <IconButton icon="trash" size={18} label={`Delete ${plan.destination} trip`} onClick={() => onDelete(trip)} />
        </span>
      }
      bottomLeft={
        <span className="stack-xs pin-meta">
          <OverlayPill>{plan.destination}</OverlayPill>
          <OverlayPill>
            {plural(plan.days, "day")} · {plural(plan.travelers, "person", "people")}
          </OverlayPill>
          <OverlayPill>{rupees(plan.total_cost)}</OverlayPill>
        </span>
      }
    />
  );
}
