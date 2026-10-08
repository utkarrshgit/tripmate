import { Icon, PlannerOrb, Section, Tile, TileGrid } from "@/components/ui";
import { PLANNERS } from "@/data/catalog";
import { useInView } from "@/hooks/useInView";
import { useRelay } from "@/hooks/useRelay";
import { cx } from "@/utils/cx";

/**
 * The nine planners, each with its orb. Once the grid is on screen, a relay
 * wakes one orb at a time in pipeline order, the way the backend hands off.
 */
export default function PlannerTiles() {
  const [ref, inView] = useInView();
  const active = useRelay(PLANNERS.length, { active: inView });

  return (
    <Section id="planners" title="Meet the planners">
      <div ref={ref}>
        <TileGrid ordered columns={4}>
          {PLANNERS.map((p, i) => (
            <Tile key={p.id} className={cx("planner-tile", i === active && "is-active")}>
              <span className="planner-tile-orb">
                <PlannerOrb planner={p} size={24} paused={i !== active} />
              </span>
              <p className="category-tile-title">
                <span className="c-mute">{i + 1}.</span> {p.label}
              </p>
              <p className="t-body-sm c-mute">{p.text}</p>
            </Tile>
          ))}
        </TileGrid>
      </div>
      <p className="t-body-sm c-mute inline-icon home-estimate-note">
        <Icon name="info" size={16} /> Prices are estimates to help you plan, not live fares or bookings.
      </p>
    </Section>
  );
}
