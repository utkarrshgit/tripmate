import { useCallback, useState } from "react";
import { checkHealth, planTrip } from "@/api/client";
import { DEMO_DELAYS, withDemoDelay } from "@/config/demo";
import { rememberPlan } from "@/state/session";

/**
 * Runs a trip request against the API.
 * status: "idle" | "planning" | "done" | "error" | "unavailable"
 * onDone(plan, query) fires once the plan is ready.
 */
export function usePlanRequest(onDone) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const run = useCallback(
    async (query) => {
      setStatus("planning");
      setError("");
      try {
        const plan = await withDemoDelay(planTrip(query), DEMO_DELAYS.planningMs);
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
