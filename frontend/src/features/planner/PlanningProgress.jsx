import { useEffect, useState } from "react";
import { ThoughtLine } from "@/components/ui";
import { PLANNERS } from "@/data/catalog";

const STEP_MS = 450;

/**
 * The planning screen's status: one ThoughtLine whose trace grows planner by planner,
 * in the order the backend runs them, then settles into "Planned in 4.5s".
 * The API answers in one response, so the steps are a guide to what's happening
 * rather than live progress; `done` settles the line.
 */
export default function PlanningProgress({ done }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, PLANNERS.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [done]);

  const shown = done ? PLANNERS.length : step + 1;
  return (
    <div className="feature-card feature-card-soft planning">
      <ThoughtLine
        working={!done}
        label="Planning your trip…"
        doneLabel="Planned in"
        steps={PLANNERS.slice(0, shown).map((p) => p.doing)}
        collapseOnSettle={false}
        fontSize={20}
        color="var(--color-ink)"
        glyphColor={done ? "var(--color-ink)" : "var(--color-accent-purple)"}
      />
    </div>
  );
}
