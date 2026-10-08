import { Masonry, OverlayPill, PinCard, Section } from "@/components/ui";
import { DESTINATIONS } from "@/data/catalog";
import { destinationImages } from "@/data/images";

export default function DestinationGrid({ onPlan }) {
  return (
    <Section id="destinations" title="Pick a place">
      <Masonry>
        {DESTINATIONS.map((d) => (
          <PinCard
            key={d.key}
            src={destinationImages[d.key]}
            alt={d.name}
            ratio={d.ratio}
            label={`Plan a trip to ${d.name}`}
            onClick={() => onPlan(d.prompt)}
            topLeft={<OverlayPill>{d.tag}</OverlayPill>}
            bottomLeft={<OverlayPill>{d.name}</OverlayPill>}
          />
        ))}
      </Masonry>
    </Section>
  );
}
