import { useState } from "react";
import { Link } from "react-router-dom";
import { checkHealth } from "@/api/client";
import { Button, SystemPage } from "@/components/ui";
import { DEMO_DELAYS, withDemoDelay } from "@/config/demo";

/** Shown when the planning API can't be reached. onRecovered runs once /health answers again. */
export default function UnavailablePanel({ onRecovered }) {
  const [checking, setChecking] = useState(false);
  const [stillDown, setStillDown] = useState(false);

  async function retry() {
    setChecking(true);
    const ok = await withDemoDelay(checkHealth(), DEMO_DELAYS.healthCheckMs);
    setChecking(false);
    setStillDown(!ok);
    if (ok) onRecovered?.();
  }

  return (
    <SystemPage
      icon="compass"
      title="We can't reach the trip planner"
      actions={
        <>
          <Button variant="primary" icon="refresh" onClick={retry} disabled={checking}>
            {checking ? "Checking…" : "Try again"}
          </Button>
          <Button as={Link} to="/">
            Go home
          </Button>
        </>
      }
    >
      <p className="t-body-md c-body">
        Your request is safe. Wait a minute, then select <strong>Try again</strong>.
      </p>
      {stillDown && (
        <p className="t-body-sm c-error swap-in" role="status">
          The planner still isn't available. Try again in a few minutes.
        </p>
      )}
    </SystemPage>
  );
}
