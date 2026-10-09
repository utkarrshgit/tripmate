import { useCallback, useEffect, useState } from "react";
import { parseTripDates } from "./dateParsing";

const EMPTY = { start: null, end: null };

/**
 * Travel dates for the plan form, kept in step with the request text.
 * While dates come from the text ("prompt"), editing the text updates them.
 * Once the user picks dates by hand ("picker"), the picker wins.
 */
export function useTripDates(query, initial = null) {
  const [dates, setDates] = useState(initial ?? EMPTY);
  const [source, setSource] = useState(initial ? "picker" : null);

  useEffect(() => {
    if (source === "picker") return;
    const parsed = parseTripDates(query);
    if (parsed) {
      setDates(parsed);
      setSource("prompt");
    } else if (source === "prompt") {
      setDates(EMPTY);
      setSource(null);
    }
  }, [query, source]);

  const pick = useCallback((next) => {
    setDates(next);
    setSource("picker");
  }, []);

  return { dates, source, pick };
}
