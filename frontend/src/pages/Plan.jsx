import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ExamplePrompts,
  PlanningProgress,
  TripRequestForm,
  parseTripDates,
  usableDates,
  usePlanRequest,
  useTripDates,
} from "@/features/planner";
import { UnavailablePanel } from "@/features/system";
import { TripPlanSkeleton } from "@/features/trips";

/*
 * Arriving state (from the nav search, destination pins, examples, 404, "Plan again"):
 *   { query, run?: boolean, dates?: { start, end } }
 * With `run`, the request goes straight to the planners — but only when there
 * are usable dates (passed in, or written in the text). Otherwise the form
 * opens pre-filled and asks for dates.
 */
export default function Plan() {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = useRef(location.state ?? {});
  const [query, setQuery] = useState(incoming.current.query ?? "");
  const tripDates = useTripDates(query, usableDates(incoming.current.dates));
  const [askForDates, setAskForDates] = useState(false);

  const openPlan = useCallback(
    (plan, text) => setTimeout(() => navigate("/trip", { state: { plan, query: text } }), 400),
    [navigate],
  );
  const { status, error, run, reset } = usePlanRequest(openPlan);

  useEffect(() => {
    const { query: q, run: shouldRun, dates } = incoming.current;
    if (shouldRun && q) {
      const ready = usableDates(dates) ?? usableDates(parseTripDates(q));
      if (ready) run(q.trim(), ready);
      else setAskForDates(true);
    }
    // Drop navigation state so a refresh doesn't re-run the request.
    if (q) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring the progress card into view when planning starts.
  useEffect(() => {
    if (status === "planning") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [status]);

  if (status === "unavailable") {
    return <UnavailablePanel onRecovered={reset} />;
  }

  if (status === "planning" || status === "done") {
    return (
      <div className="container section">
        <div className="container-narrow planner-progress-wrap">
          <p className="t-body-sm c-mute planner-echo">“{query.trim()}”</p>
          <PlanningProgress done={status === "done"} />
        </div>
        {/* A preview of the shape of what's coming, so the results don't arrive as a surprise */}
        <div className="planning-preview" aria-hidden="true">
          <TripPlanSkeleton label="Preparing your plan" />
        </div>
      </div>
    );
  }

  return (
    <div className="container container-narrow section">
      <div className="stack-sm page-intro">
        <h1 className="t-heading-xl">Where do you want to go?</h1>
        <p className="t-body-md c-body">One sentence and your dates. Prices come back as estimates.</p>
      </div>
      <TripRequestForm
        query={query}
        onQueryChange={setQuery}
        tripDates={tripDates}
        onSubmit={run}
        error={status === "error" ? error : null}
        askForDates={askForDates}
      />
      <ExamplePrompts title="Need a starting point?" onPick={setQuery} className="planner-examples" />
    </div>
  );
}
