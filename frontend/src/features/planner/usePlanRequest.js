import { useCallback, useState } from "react";
import { checkHealth, planTripStream } from "@/api/client";
import { rememberPlan } from "@/state/session";

/**
 * Runs a trip request against the API, with live progress.
 * status: "idle" | "planning" | "done" | "error" | "unavailable"
 * steps: one entry per planner so far, { agent, phase, ai, fell_back, summary }, in order.
 * run(query, dates) — dates is { start, end } (ISO). onDone(plan, query) fires once the plan is ready.
 */
export function usePlanRequest(onDone) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState([]);

  const run = useCallback(
    async (query, dates) => {
      setStatus("planning");
      setError("");
      setSteps([]);
      const startedAt = performance.now();
      try {
        const response = await planTripStream(query, dates, (step) =>
          setSteps((list) => {
            const rest = list.filter((s) => s.agent !== step.agent);
            return [...rest, step];
          }),
        );
        // How long planning took, as the person experienced it ("Planned in 4.5s").
        const plan = { ...response, planned_in: (performance.now() - startedAt) / 1000 };
        rememberPlan(plan, query);
        setStatus("done");
        onDone(plan, query);
      } catch (err) {
        if (err.unreachable && !(await checkHealth())) {
          setStatus("unavailable");
        } else {
          setError(err.message);
          setStatus("error");
        }
      }
    },
    [onDone],
  );

  return { status, error, steps, run, reset: () => setStatus("idle") };
}
