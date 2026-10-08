import { useCallback, useState } from "react";
import { checkHealth, priceTrip } from "@/api/client";
import { DEMO_DELAYS, withDemoDelay } from "@/config/demo";

/**
 * Fetches exact prices. status: "idle" | "loading" | "ok" | "unavailable" | "error" | "offline".
 * "unavailable" = the API answered but has no pricing provider; "offline" = the API itself is down.
 * Pass `initial` (a saved response) to show a previous check without refetching.
 */
export function usePriceRequest(initial = null) {
  const [status, setStatus] = useState(initial ? initial.status : "idle");
  const [response, setResponse] = useState(initial);
  const [error, setError] = useState("");

  const run = useCallback(async (request) => {
    setStatus("loading");
    setError("");
    try {
      const res = await withDemoDelay(priceTrip(request), DEMO_DELAYS.pricingMs);
      setResponse(res);
      setStatus(res.status);
      return res;
    } catch (err) {
      setError(err.message);
      setStatus(err.unreachable && !(await checkHealth()) ? "offline" : "error");
      return null;
    }
  }, []);

  return { status, response, error, run };
}
