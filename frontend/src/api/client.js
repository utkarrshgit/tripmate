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
    throw new ApiError("The planner can't be reached right now.", { unreachable: true });
  }
  if (!response.ok) {
    throw new ApiError("The planner couldn't finish this request.", { status: response.status });
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

export function planTrip(query) {
  return request("/api/trips/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}
