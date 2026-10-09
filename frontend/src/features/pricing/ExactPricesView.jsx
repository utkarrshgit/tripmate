import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AgentOrb, Button, Chip, ChipStrip, Icon, Notice, Skeleton, SkeletonScreen } from "@/components/ui";
import { DateRangeField, usableDates, validateTripDates } from "@/features/planner";
import { tripName } from "@/features/trips";
import { recallOrigin, rememberOrigin } from "@/state/session";
import { formatDateRange, plural, rupees } from "@/utils/format";
import OriginForm from "./OriginForm";
import PriceComparison from "./PriceComparison";
import { cheapestIndex, exactTotal } from "./pricingMath";
import QuoteGroup from "./QuoteGroup";
import { usePriceRequest } from "./usePriceRequest";

function LoadingQuotes() {
  return (
    <SkeletonScreen label="Checking exact prices">
      <div className="pricing-loading">
        <span className="pricing-loading-orb">
          <AgentOrb state="searching" variant="lighthouse" size={36} />
        </span>
        <div className="stack-xs">
          <p className="t-heading-md">Checking fares and rooms…</p>
          <p className="t-body-sm c-mute">Comparing options for your dates</p>
        </div>
      </div>
      <div className="quote-groups">
        <Skeleton height={220} />
        <Skeleton height={220} />
      </div>
    </SkeletonScreen>
  );
}

/**
 * The exact-prices step for a planned trip.
 *   plan, query     — the trip being priced
 *   saved           — a previous price check to show first: { origin, dates, response, selection }
 *   backTo          — { to, state, label } for returning to the trip
 *   renderActions   — (pricing) => buttons for saving, supplied by the page
 */
export default function ExactPricesView({ plan, query, saved = null, backTo, renderActions }) {
  const planDates = usableDates(plan.start_date ? { start: plan.start_date, end: plan.end_date } : null);
  const [dates, setDates] = useState(saved?.dates ?? planDates ?? { start: null, end: null });
  const [origin, setOrigin] = useState(saved?.origin ?? recallOrigin());
  const [datesTouched, setDatesTouched] = useState(false);
  const { status, response, error, run } = usePriceRequest(saved?.response ?? null);
  const [selection, setSelection] = useState(saved?.selection ?? { transport: 0, stay: 0 });
  const needsDates = !planDates;
  const navigate = useNavigate();
  const location = useLocation();

  // The whole service is down: hand over to the service-unavailable page, which returns here once it's back.
  useEffect(() => {
    if (status === "offline") {
      navigate("/unavailable", { state: { from: { pathname: location.pathname, state: location.state } } });
    }
  }, [status, navigate, location]);
  const datesError = validateTripDates(dates);

  // New results → preselect the cheapest of each.
  useEffect(() => {
    if (response && response !== saved?.response) {
      setSelection({ transport: cheapestIndex(response.transport), stay: cheapestIndex(response.stays) });
    }
  }, [response, saved]);

  const totals = useMemo(() => exactTotal(plan, response, selection), [plan, response, selection]);
  const pricing = response?.status === "ok" ? { origin, dates, response, selection, total: totals.total, checkedAt: response.fetched_at } : null;

  function check(nextOrigin) {
    setDatesTouched(true);
    if (datesError) return;
    setOrigin(nextOrigin);
    if (nextOrigin) rememberOrigin(nextOrigin);
    run({ destination: plan.destination, dates, travelers: plan.travelers, origin: nextOrigin });
  }

  return (
    <div className="exact-prices">
      <Button as={Link} to={backTo.to} state={backTo.state} variant="tertiary" icon="arrowLeft" className="back-link">
        {backTo.label}
      </Button>

      <header className="stack-md page-intro">
        <h1 className="t-display-lg">Exact prices · {tripName(plan)}</h1>
        <ChipStrip>
          {!needsDates && (
            <Chip>
              <Icon name="calendar" size={16} /> {formatDateRange(dates.start, dates.end)}
            </Chip>
          )}
          <Chip>
            <Icon name="user" size={16} /> {plural(plan.travelers, "traveler")}
          </Chip>
          <Chip>
            <Icon name="wallet" size={16} /> Estimated {rupees(plan.total_cost)}
          </Chip>
        </ChipStrip>
      </header>

      {!plan.destination ? (
        <Notice icon="pin" title="Add a destination to check exact prices">
          <p className="t-body-sm">
            Select <strong>Back to trip</strong>, then <strong>Edit request</strong> and add a place, like “in Goa”.
          </p>
        </Notice>
      ) : (
      <div className="pricing-form">
        {needsDates && (
          <DateRangeField dates={dates} source="picker" error={datesTouched ? datesError : null} onChange={setDates} />
        )}
        <OriginForm initialOrigin={origin} hasResult={Boolean(response)} loading={status === "loading"} onSubmit={check} />
      </div>
      )}

      {status === "loading" && <LoadingQuotes />}

      {status === "error" && (
        <Notice tone="error" icon="alert" title={error} className="swap-in">
          <p className="t-body-sm">Your trip hasn't changed. Wait a moment, then try again.</p>
        </Notice>
      )}

      {status === "unavailable" && response && (
        <Notice icon="info" title="Exact prices aren't available right now" className="swap-in">
          <p className="t-body-sm">{response.message}</p>
        </Notice>
      )}

      {status === "ok" && response && (
        <div className="stack-xl pricing-results">
          {response.is_sample && (
            <Notice icon="info" title="Sample prices">
              <p className="t-body-sm">
                These are made-up prices for testing, because real fares aren't connected yet. Don't use them to book.
              </p>
            </Notice>
          )}

          <PriceComparison estimate={plan.total_cost} exact={totals.total} parts={totals.parts} />

          {/* Skip the API's origin hint when the empty transport list already asks for it */}
          {response.message && response.transport.length > 0 && (
            <p className="t-body-sm c-mute inline-icon">
              <Icon name="info" size={16} /> {response.message}
            </p>
          )}

          <div className="quote-groups">
            <QuoteGroup
              icon="train"
              title="Getting there"
              quotes={response.transport}
              selected={selection.transport}
              onSelect={(i) => setSelection((s) => ({ ...s, transport: i }))}
              empty="Add your starting city to view fares."
            />
            <QuoteGroup
              icon="bed"
              title="Stays"
              quotes={response.stays}
              selected={selection.stay}
              onSelect={(i) => setSelection((s) => ({ ...s, stay: i }))}
              empty="No rooms found for these dates."
            />
          </div>

          <div className="row">{renderActions?.(pricing)}</div>
          {query && <p className="t-caption-sm c-mute">“{query}”</p>}
        </div>
      )}
    </div>
  );
}
