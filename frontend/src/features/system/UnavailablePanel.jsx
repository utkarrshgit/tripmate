import { useState } from "react";
import { Link } from "react-router-dom";
import { checkHealth } from "@/api/client";
import { AgentOrb, Button, SystemPage } from "@/components/ui";
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
      // Waiting for the service; switches to "retrying" while a check is in flight.
      media={
        <AgentOrb
          key={checking ? "retrying" : "waiting"}
          state={checking ? "retrying" : "waiting"}
          size={32}
          label={checking ? "Checking the planner" : "Waiting for the planner"}
        />
      }
      title="The planner is taking a break"
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
        We can't reach TripMate's planning service right now. Nothing you typed has been lost — try again in a minute.
      </p>
      {stillDown && (
        <p className="t-body-sm c-error swap-in" role="status">
          Still unavailable. Please try again shortly.
        </p>
      )}
    </SystemPage>
  );
}
