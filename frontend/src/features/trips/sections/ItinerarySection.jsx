import { Icon, Reveal, Section, Tile, TileGrid } from "@/components/ui";
import { DAY_PARTS } from "../tripMeta";

/** Parts of the day that are identical on every day get shown once, not repeated per card. */
function splitRoutine(itinerary) {
  const same = (key) => itinerary.every((d) => d[key] === itinerary[0][key]);
  const routine = itinerary.length > 1 ? DAY_PARTS.filter((p) => same(p.key)) : [];
  const varying = DAY_PARTS.filter((p) => !routine.includes(p));
  return { routine, varying };
}

export default function ItinerarySection({ plan }) {
  const days = plan.itinerary ?? [];
  if (!days.length) return null;
  const { routine, varying } = splitRoutine(days);

  return (
    <Section id="itinerary" title="Your days">
      {routine.length > 0 && (
        <Reveal className="day-routine">
          <span className="t-body-sm-strong c-ink">Every day</span>
          {routine.map((part) => (
            <span key={part.key} className="day-routine-item t-body-sm c-body">
              <Icon name={part.icon} size={16} title={part.label} /> {days[0][part.key]}
            </span>
          ))}
        </Reveal>
      )}
      <TileGrid ordered columns={4}>
        {days.map((day) => (
          <Tile key={day.day} className="day-card">
            <span className="day-number" aria-label={`Day ${day.day}`}>
              {String(day.day).padStart(2, "0")}
            </span>
            <ul className="stack-sm">
              {varying.map((part) => (
                <li key={part.key} className="day-part">
                  <Icon name={part.icon} size={18} className="c-mute" title={part.label} />
                  <span className="t-body-md c-ink">{day[part.key]}</span>
                </li>
              ))}
            </ul>
          </Tile>
        ))}
      </TileGrid>
    </Section>
  );
}
