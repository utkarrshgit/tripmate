import { useState } from "react";
import { useSession } from "@/state/session";
import { addVersion, savePricing } from "@/state/tripsApi";

/**
 * Saving a plan: as a new trip, or, when `forTrip` ({ id, title }) is given, as that saved
 * trip's next version. Returns { saved, busy, error, save(plan, query, pricing) }.
 */
export function useTripSaver(forTrip = null) {
  const { saveTrip, tripChanged } = useSession();
  const [state, setState] = useState({ saved: null, busy: false, error: null });

  async function save(plan, query, pricing = null) {
    setState({ saved: null, busy: true, error: null });
    try {
      let trip;
      if (forTrip) {
        trip = await addVersion(forTrip.id, { query, plan });
        if (pricing) trip = await savePricing(forTrip.id, pricing);
        tripChanged(trip);
      } else {
        trip = await saveTrip(plan, query, pricing);
      }
      setState({ saved: trip, busy: false, error: null });
      return trip;
    } catch (err) {
      setState({ saved: null, busy: false, error: err.message });
      return null;
    }
  }

  return { ...state, save };
}
