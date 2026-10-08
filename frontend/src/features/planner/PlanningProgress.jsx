import { useEffect, useState } from "react";
import { Icon, PlannerOrb } from "@/components/ui";
import { PLANNERS } from "@/data/catalog";

const STEP_MS = 450;

/**
 * Walks through the planners in the order the backend runs them while the
 * request is in flight. The API answers in one response, so the steps are a
 * guide to what's happening rather than live progress; `done` completes them all.
 * Each planner shows its own orb state (reasoning, searching, working…).
 */
export default function PlanningProgress({ done }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, PLANNERS.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [done]);

  const current = done ? PLANNERS.length : step;
  const active = PLANNERS[Math.min(current, PLANNERS.length - 1)];

  return (
    <div className="feature-card feature-card-soft planning" role="status" aria-live="polite">
      <div className="planning-head">
        <span className="planning-head-orb" key={done ? "done" : active.id}>
          {done ? <Icon name="check" size={28} /> : <PlannerOrb planner={active} size={40} />}
        </span>
        <div className="stack-xs">
          <h2 className="t-heading-lg">{done ? "Your plan is ready" : "Planning your trip…"}</h2>
          <p className="t-body-md c-body planning-caption" key={done ? "done" : active.id}>
            {done ? "Opening it now." : `${active.label} — ${active.text.toLowerCase()}`}
          </p>
        </div>
      </div>
      <ol className="planning-steps">
        {PLANNERS.map((p, i) => {
          const state = i < current ? "done" : i === current ? "active" : "waiting";
          return (
            <li key={p.id} className={`planning-step is-${state}`}>
              <span className="planning-step-icon" key={state}>
                {state === "active" ? (
                  <PlannerOrb planner={p} size={20} />
                ) : (
                  <Icon name={state === "done" ? "check" : p.icon} size={18} />
                )}
              </span>
              <span className="t-body-sm-strong">{p.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
