import { useRef, useState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import DetailChecklist from "./DetailChecklist";
import InterestPicker from "./InterestPicker";
import { MIN_REQUEST_LENGTH } from "./requestDetails";

/** The request composer: text box, interest chips, detection checklist, submit. */
export default function TripRequestForm({ query, onQueryChange, onSubmit, error }) {
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);
  const tooShort = query.trim().length < MIN_REQUEST_LENGTH;

  function submit() {
    if (tooShort) {
      setTouched(true);
      inputRef.current?.focus();
      return;
    }
    onSubmit(query.trim());
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
      <TextField
        ref={inputRef}
        id="trip-request"
        label="Your trip"
        multiline
        rows={3}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Plan a 5 day trip to Manali under ₹30000 for 3 people with nature and adventure"
        error={touched && tooShort ? `Tell us a little more about your trip — at least ${MIN_REQUEST_LENGTH} characters.` : null}
        help="Press Enter to plan. Shift + Enter adds a new line."
      />

      <InterestPicker query={query} onChange={onQueryChange} />
      <DetailChecklist query={query} />

      {error && (
        <Notice tone="error" icon="alert" title={error} role="alert" className="swap-in">
          <p className="t-body-sm">Your request is still here. Try again in a moment.</p>
        </Notice>
      )}

      <div className="row">
        <Button type="submit" variant="primary">
          {error ? "Try again" : "Plan my trip"}
        </Button>
        {query && (
          <Button
            variant="tertiary"
            onClick={() => {
              onQueryChange("");
              setTouched(false);
              inputRef.current?.focus();
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
