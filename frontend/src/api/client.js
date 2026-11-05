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
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? "We couldn't plan this trip. Try again.", { status: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError("The planner sent back something we couldn't read. Try again.", { status: response.status });
  }
}

export async function checkHealth() {
  try {
    // "degraded" (say, Ollama is off) still plans, with rules: only an unreachable API is "unavailable".
    const data = await request("/health");
    return data.status === "ok" || data.status === "degraded";
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
 * Plans a trip with live progress (POST /api/v1/plans/stream, Server-Sent Events).
 * onStep({ agent, phase: "start" | "done", ai, fell_back, models, summary }) fires as each planner
 * starts and finishes; resolves with the plan. Falls back to planTrip when streaming isn't available.
 */
export async function planTripStream(query, dates, onStep) {
  const body = { query, start_date: dates?.start ?? null, end_date: dates?.end ?? null };
  let response;
  try {
    response = await fetch(`${API_URL}/api/v1/plans/stream`, {
      method: "POST",
      credentials: "include", // a signed-in run is recorded against the account
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("We can't reach the trip planner right now.", { unreachable: true });
  }
  if (!response.ok || !response.body) return planTrip(query, dates);

  try {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const name = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!name || !data) continue;
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          continue; // a garbled event: skip it, the plan still arrives
        }
        if (name === "step") onStep?.(payload);
        else if (name === "result") return payload;
        else if (name === "error") throw new ApiError(payload.message, { status: 500 });
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err; // the planner said what went wrong
    // The connection dropped mid-way: ask once more, the plain way.
  }
  return planTrip(query, dates);
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
