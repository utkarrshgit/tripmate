import { Button, Icon, PlannerOrb, Reveal, Tile } from "@/components/ui";
import { useClipboard } from "@/hooks/useClipboard";
import { plannerById, plannerLabel } from "@/data/catalog";
import { plural } from "@/utils/format";

/** One quiet line at the end: who planned it, the raw summary on demand, and the estimates note. */
export default function ProvenanceSection({ plan }) {
  const { copied, copy } = useClipboard();
  const planners = (plan.completed_agents ?? []).map(plannerById).filter(Boolean);

  return (
    <Reveal as="footer" className="section planned-by">
      <Tile as="details" className="summary-details">
        <summary>
          <span className="planned-by-orbs" aria-hidden="true">
            {planners.map((p) => (
              <span key={p.id} className="planned-by-orb" title={plannerLabel(p.id)}>
                <PlannerOrb planner={p} size={18} paused />
              </span>
            ))}
          </span>
          <span className="t-body-sm-strong c-ink">Planned by {plural(planners.length, "planner")}</span>
          <span className="t-body-sm c-mute planned-by-toggle">
            Text summary <Icon name="chevronDown" size={16} />
          </span>
        </summary>
        {plan.final_response && (
          <>
            <pre className="t-body-sm c-body summary-text">{plan.final_response}</pre>
            <Button variant="tertiary" icon={copied ? "check" : "copy"} onClick={() => copy(plan.final_response)}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </>
        )}
      </Tile>
      <p className="t-caption-sm c-mute">Prices are estimates. Check real fares and rates before you book.</p>
    </Reveal>
  );
}
