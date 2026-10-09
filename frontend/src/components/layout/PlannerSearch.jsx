import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBar } from "@/components/ui";
import { MIN_REQUEST_LENGTH } from "@/features/planner/requestDetails";

/** The nav's search-bar. On TripMate, "search" means a one-line trip request. */
export default function PlannerSearch({ autoFocus = false, onSubmitted, className }) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function submit() {
    const query = value.trim();
    navigate("/plan", { state: { query, run: query.length >= MIN_REQUEST_LENGTH } });
    setValue("");
    onSubmitted?.();
  }

  return (
    <SearchBar
      label="Describe a trip"
      submitLabel="Plan this trip"
      placeholder="Describe a trip, like 4 days in Goa under ₹25,000"
      value={value}
      onChange={setValue}
      onSubmit={submit}
      autoFocus={autoFocus}
      className={className}
    />
  );
}
