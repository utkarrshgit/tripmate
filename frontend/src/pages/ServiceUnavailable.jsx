import { useLocation, useNavigate } from "react-router-dom";
import { UnavailablePanel } from "@/features/system";

/**
 * Reached when a page finds the API down. Arriving state: { from: { pathname, state } }.
 * Once the service answers again, "Try again" returns there (or to the planner).
 */
export default function ServiceUnavailable() {
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  return <UnavailablePanel onRecovered={() => navigate(from?.pathname ?? "/plan", { state: from?.state, replace: true })} />;
}
