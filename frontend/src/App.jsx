import { useState } from "react";

const API_URL = "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState(
    "Plan a 5 day trip to Manali for 3 people under ₹30000 with nature and adventure"
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function planTrip(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/trips/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      setResult(await response.json());
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>✈️ TripMate</h1>
      <p className="subtitle">Multi-Agent AI Travel Planner</p>

      <form onSubmit={planTrip} className="planner">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={5}
          placeholder="Describe your trip..."
        />
        <button disabled={loading}>
          {loading ? "Agents are planning..." : "Plan My Trip"}
        </button>
      </form>

      {result?.error && <div className="error">{result.error}</div>}

      {result && !result.error && (
        <section className="result">
          <h2>{result.destination}</h2>

          <div className="stats">
            <div><b>{result.days}</b><span>Days</span></div>
            <div><b>{result.travelers}</b><span>Travelers</span></div>
            <div><b>₹{result.total_cost.toLocaleString()}</b><span>Estimated Cost</span></div>
          </div>

          <h3>Itinerary</h3>
          {result.itinerary.map((day) => (
            <article className="day" key={day.day}>
              <h4>Day {day.day}</h4>
              <p>🌅 {day.morning}</p>
              <p>🗺️ {day.afternoon}</p>
              <p>🌙 {day.evening}</p>
            </article>
          ))}

          <h3>Agents involved</h3>
          <div className="agents">
            {result.completed_agents.map((agent) => (
              <span key={agent}>{agent}</span>
            ))}
          </div>

          {result.issues.length > 0 && (
            <>
              <h3>Things to review</h3>
              <ul>
                {result.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
