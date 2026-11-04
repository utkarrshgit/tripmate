import { Button, Reveal, ThoughtLine, Tile } from "@/components/ui";
import { plannerById } from "@/data/catalog";
import { useClipboard } from "@/hooks/useClipboard";
import { plural } from "@/utils/format";

/** "Planned with gemma4:e2b-mlx and tev1:0.8b", "Planned with rules: Ollama wasn't available", or nothing for older plans. */
function aiLine(ai) {
  if (!ai || ai.enabled === undefined) return null;
  if (ai.used) {
    const models = ai.models.join(" and ");
    const fell = ai.fell_back?.length ? ` Some steps used rules instead: ${ai.fell_back.join(", ")}.` : "";
    return `Planned with local AI models (${models}), running on this computer.${fell}`;
  }
  return ai.enabled ? "Planned with rules: the local AI models weren't available." : "Planned with rules: AI is turned off.";
}

/**
 * One quiet block at the end: a settled ThoughtLine ("Planned in 4.5s") that opens to
 * show what each planner did, the plain-text summary, and the estimates note.
 * Older saved plans have no timing, so they say "Planned by 9 planners" instead.
 */
export default function ProvenanceSection({ plan }) {
  const { copied, copy } = useClipboard();
  const planners = (plan.completed_agents ?? []).map(plannerById).filter(Boolean);
  const timed = typeof plan.planned_in === "number";

  return (
    <Reveal as="footer" className="section planned-by">
      <ThoughtLine
        working={false}
        elapsed={timed ? plan.planned_in : undefined}
        showTimer={timed}
        doneLabel={timed ? "Planned in" : `Planned by ${plural(planners.length, "planner")}`}
        steps={planners.map((p) => p.did)}
        color="var(--color-ink)"
      />
      {aiLine(plan.ai) && <p className="t-body-sm c-mute planned-ai">{aiLine(plan.ai)}</p>}
      {plan.final_response && (
        <Tile as="details" className="summary-details">
          <summary className="t-body-sm-strong c-ink">Text summary</summary>
          <pre className="t-body-sm c-body summary-text">{plan.final_response}</pre>
          <Button variant="tertiary" icon={copied ? "check" : "copy"} onClick={() => copy(plan.final_response)}>
            {copied ? "Copied" : "Copy summary"}
          </Button>
        </Tile>
      )}
      <p className="t-caption-sm c-mute">Prices are estimates. Check real fares and rates before you book.</p>
    </Reveal>
  );
}
