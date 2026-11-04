import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/state/session";
import { getTrip } from "@/state/tripsApi";

/**
 * One saved trip, loaded from the API. `status` is "loading", "ready", "missing" (not
 * found, deleted or someone else's) or "error". `update(trip)` swaps in a changed trip
 * returned by the API and keeps the trips list in step.
 */
export function useTrip(id) {
  const { user, tripChanged } = useSession();
  const [state, setState] = useState({ trip: null, status: "loading", error: null });

  useEffect(() => {
    if (!user) return undefined;
    let live = true;
    setState({ trip: null, status: "loading", error: null });
    getTrip(id)
      .then((trip) => live && setState({ trip, status: "ready", error: null }))
      .catch((err) => live && setState({ trip: null, status: err.status === 404 ? "missing" : "error", error: err.message }));
    return () => {
      live = false;
    };
  }, [id, user]);

  const update = useCallback(
    (trip) => {
      setState({ trip, status: "ready", error: null });
      tripChanged(trip);
    },
    [tripChanged],
  );

  return { ...state, update };
}
