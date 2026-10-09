import { Icon, Section, Tile, TileGrid } from "@/components/ui";
import { PLANNERS } from "@/data/catalog";

export default function PlannerTiles() {
  return (
    <Section id="planners" title="Meet the planners">
      <TileGrid ordered columns={4}>
        {PLANNERS.map((p, i) => (
          <Tile key={p.id} className="planner-tile">
            <span className="planner-tile-icon">
              <Icon name={p.icon} size={22} />
            </span>
            <p className="category-tile-title">
              <span className="c-mute">{i + 1}.</span> {p.label}
            </p>
            <p className="t-body-sm c-mute">{p.text}</p>
          </Tile>
        ))}
      </TileGrid>
      <p className="t-body-sm c-mute inline-icon home-estimate-note">
        <Icon name="info" size={16} /> Prices are estimates to help you plan, not live fares or bookings.
      </p>
    </Section>
  );
}
