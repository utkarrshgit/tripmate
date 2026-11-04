import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Masonry, OverlayPill, PinCard, Section } from "@/components/ui";
import { DESTINATIONS } from "@/data/catalog";
import { imageForDestination } from "@/data/images";
import { similarDestinations } from "@/state/tripsApi";

const RATIOS = ["4 / 5", "1 / 1", "3 / 4"];

/** Three destinations like this one, found by meaning with the local embedding model. Hidden when there's nothing to show. */
export default function SimilarPlaces({ destination }) {
  const [places, setPlaces] = useState([]);
  const slug = (destination || "").trim().toLowerCase().replace(/\s+/g, "-");

  useEffect(() => {
    if (!slug) return undefined;
    let live = true;
    similarDestinations(slug)
      .then((data) => live && setPlaces(data.results))
      .catch(() => live && setPlaces([]));
    return () => {
      live = false;
    };
  }, [slug]);

  if (!places.length) return null;
  return (
    <Section id="similar" title={`If you like ${destination}`} intro="Places with a similar feel, from TripMate's guide." className="no-print">
      <Masonry>
        {places.map((p, i) => {
          const prompt = DESTINATIONS.find((d) => d.key === p.slug)?.prompt ?? `3 days in ${p.name}`;
          return (
            <Link key={p.slug} to="/plan" state={{ query: prompt }} className="similar-place" aria-label={`Plan a trip to ${p.name}`}>
              <PinCard src={imageForDestination(p.name)} ratio={RATIOS[i % RATIOS.length]} bottomLeft={<OverlayPill>{p.name}</OverlayPill>} topLeft={<OverlayPill>{p.state}</OverlayPill>} />
            </Link>
          );
        })}
      </Masonry>
    </Section>
  );
}
