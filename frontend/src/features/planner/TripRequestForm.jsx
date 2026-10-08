import { useEffect, useRef, useState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import DateRangeField from "./DateRangeField";
import { validateTripDates } from "./dateParsing";
import DetailChecklist from "./DetailChecklist";
import InterestPicker from "./InterestPicker";
import { MIN_REQUEST_LENGTH } from "./requestDetails";

/**
 * The request composer: request text, travel dates (required), interest chips,
 * the detection checklist and submit. Dates come from useTripDates in the page.
 * `askForDates` is set when the user arrived wanting to plan but without dates.
 */
export default function TripRequestForm({ query, onQueryChange, tripDates, onSubmit, error, askForDates = false }) {
  const [touched, setTouched] = useState({ query: false, dates: false });
  const queryRef = useRef(null);
  const datesRef = useRef(null);
  const tooShort = query.trim().length < MIN_REQUEST_LENGTH;
  const datesError = validateTripDates(tripDates.dates);

  useEffect(() => {
    if (askForDates) datesRef.current?.focus();
  }, [askForDates]);

  function submit() {
    setTouched({ query: true, dates: true });
    if (tooShort) return queryRef.current?.focus();
    if (datesError) return datesRef.current?.focus();
    onSubmit(query.trim(), tripDates.dates);
  }

  return (
    <form
      className="stack-xl trip-request-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {askForDates && (
        <Notice icon="calendar" className="swap-in">
          <p className="t-body-sm">Pick your dates to plan this trip.</p>
        </Notice>
      )}

      <TextField
        ref={queryRef}
        id="trip-request"
        label="Your trip"
        multiline
        rows={3}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, query: true }))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="5 days in Manali, 12–16 Dec, under ₹30000 for 3 people, nature and adventure"
        error={touched.query && tooShort ? `Tell us a little more — at least ${MIN_REQUEST_LENGTH} characters.` : null}
        help="Press Enter to plan. Shift + Enter adds a new line."
      />

      <DateRangeField
        ref={datesRef}
        dates={tripDates.dates}
        source={tripDates.source}
        error={touched.dates ? datesError : null}
        onChange={tripDates.pick}
      />

      <InterestPicker query={query} onChange={onQueryChange} />
      <DetailChecklist query={query} dates={tripDates.dates} />

      {error && (
        <Notice tone="error" icon="alert" title={error} role="alert" className="swap-in">
          <p className="t-body-sm">Your request is still here. Try again in a moment.</p>
        </Notice>
      )}

      <div className="row">
        <Button type="submit" variant="primary">
          {error ? "Try again" : "Plan my trip"}
        </Button>
        {(query || tripDates.dates.start) && (
          <Button
            variant="tertiary"
            onClick={() => {
              onQueryChange("");
              tripDates.clear();
              setTouched({ query: false, dates: false });
              queryRef.current?.focus();
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
