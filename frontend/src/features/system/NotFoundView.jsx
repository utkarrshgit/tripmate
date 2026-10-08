import { Link, useNavigate } from "react-router-dom";
import PlannerSearch from "@/components/layout/PlannerSearch";
import { Button, Chip, ChipStrip, Icon, OverlayPill, PinCard, StatusPill } from "@/components/ui";
import { DESTINATIONS } from "@/data/catalog";
import { destinationImages } from "@/data/images";

// Pins scattered around the "404" card. Each floats on its own slow rhythm.
const COLLAGE = [
  { key: "ladakh", pill: "Off the map", ratio: "3 / 4", area: "a" },
  { key: "goa", pill: "Wrong turn", ratio: "1 / 1", area: "b" },
  { key: "hampi", pill: "Detour", ratio: "4 / 5", area: "d" },
  { key: "kerala", pill: "Uncharted", ratio: "3 / 4", area: "e" },
];

const JUMP_TO = DESTINATIONS.slice(0, 4);

export default function NotFoundView() {
  const navigate = useNavigate();
  const planFrom = (query) => navigate("/plan", { state: { query, run: true } });

  return (
    <div className="container section not-found">
      <div className="not-found-copy stack-xl">
        <div className="stack-md">
          <StatusPill icon="compass">Error 404</StatusPill>
          <h1 className="t-display-xl">This page took a wrong turn</h1>
          <p className="t-body-md c-body not-found-body">
            The page you're looking for doesn't exist, or it has moved. Every good trip has a detour or two — let's get you
            back on the road.
          </p>
        </div>

        <div className="stack-sm">
          <p className="t-body-sm-strong c-ink">Plan a trip from here</p>
          <PlannerSearch />
        </div>

        <div className="stack-sm">
          <p className="t-body-sm-strong c-ink">Or jump straight to</p>
          <ChipStrip>
            {JUMP_TO.map((d) => (
              <Chip key={d.key} onClick={() => planFrom(d.prompt)}>
                {d.name}
              </Chip>
            ))}
          </ChipStrip>
        </div>

        <div className="row">
          <Button as={Link} to="/" icon="arrowLeft">
            Back to home
          </Button>
          <Button as={Link} to="/#destinations" variant="tertiary">
            Browse destinations
          </Button>
        </div>
      </div>

      <div className="not-found-collage" aria-hidden="true">
        {COLLAGE.map((p, i) => (
          <div key={p.key} className="not-found-pin" style={{ gridArea: p.area, "--i": i }}>
            <PinCard src={destinationImages[p.key]} ratio={p.ratio} bottomLeft={<OverlayPill>{p.pill}</OverlayPill>} />
          </div>
        ))}
        <div className="not-found-pin not-found-center" style={{ gridArea: "c", "--i": 4 }}>
          <div className="pin-card pin-card-large not-found-card">
            <span className="not-found-compass">
              <Icon name="compass" size={28} />
            </span>
            <span className="not-found-code">404</span>
            <span className="pin-overlay-pill">You are here</span>
          </div>
        </div>
      </div>
    </div>
  );
}
