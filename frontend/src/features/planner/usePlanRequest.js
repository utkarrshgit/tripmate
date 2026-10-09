import { useCallback, useState } from "react";
import { checkHealth, planTrip } from "@/api/client";
import { DEMO_DELAYS, withDemoDelay } from "@/config/demo";
import { rememberPlan } from "@/state/session";

/**
 * Runs a trip request against the API.
 * status: "idle" | "planning" | "done" | "error" | "unavailable"
 * run(query, dates) — dates is { start, end } (ISO). onDone(plan, query) fires once the plan is ready.
 */
export function usePlanRequest(onDone) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const run = useCallback(
    async (query, dates) => {
      setStatus("planning");
      setError("");
      const startedAt = performance.now();
      try {
        const response = await withDemoDelay(planTrip(query, dates), DEMO_DELAYS.planningMs);
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

  return { status, error, run, reset: () => setStatus("idle") };
}
