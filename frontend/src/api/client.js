const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status, unreachable = false } = {}) {
    super(message);
    this.status = status;
    this.unreachable = unreachable;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new ApiError("We can't reach the trip planner right now.", { unreachable: true });
  }
  if (!response.ok) {
    throw new ApiError("We couldn't plan this trip.", { status: response.status });
  }
  return response.json();
}

export async function checkHealth() {
  try {
    const data = await request("/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}

const postJSON = (path, body) =>
  request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Plans a trip. `dates` is { start, end } (ISO). Prices in the result are estimates. */
export function planTrip(query, dates) {
  return postJSON("/api/trips/plan", { query, start_date: dates?.start ?? null, end_date: dates?.end ?? null });
}

/**
 * Exact prices for a planned trip, from the backend's pricing provider.
 * Returns { status: "ok" | "unavailable", is_sample, transport[], stays[], message }.
 */
export function priceTrip({ destination, dates, travelers, origin }) {
  return postJSON("/api/trips/price", {
    destination,
    start_date: dates.start,
    end_date: dates.end,
    travelers,
    origin: origin?.trim() || null,
  });
}
