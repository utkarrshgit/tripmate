import { ThoughtLine } from "@/components/ui";
import { plannerById } from "@/data/catalog";

/**
 * The planning screen's status: one ThoughtLine whose trace grows as the API reports each
 * planner (streamed), then settles into "Planned in 12.4s". A finished step shows what it
 * found ("Read your request · Goa · 4 days · 2 people") and whether a local model helped.
 */
export default function PlanningProgress({ done, steps = [] }) {
  const lines = steps.map((step) => {
    const planner = plannerById(step.agent);
    if (!planner) return step.agent;
    if (step.phase === "start") return planner.doing;
    const extra = [step.summary, step.ai ? "with AI" : step.fell_back ? "with rules" : null].filter(Boolean).join(" · ");
    return extra ? `${planner.did} · ${extra}` : planner.did;
  });
  const usingModel = steps.some((s) => s.phase === "start" && ["planner", "activity", "itinerary"].includes(s.agent));

  return (
    <div className="feature-card feature-card-soft planning">
      <ThoughtLine
        working={!done}
        label={usingModel ? "Planning your trip with a local AI model…" : "Planning your trip…"}
        doneLabel="Planned in"
        steps={lines.length ? lines : ["Starting the planners"]}
        collapseOnSettle={false}
        fontSize={20}
        color="var(--color-ink)"
        glyphColor={done ? "var(--color-ink)" : "var(--color-accent-purple)"}
      />
    </div>
  );
}
