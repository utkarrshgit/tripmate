import { useEffect, useState } from "react";
import { GridSkeleton } from "@/app/PageSkeletons";
import { Chip, ChipStrip, Notice, Section, SystemPage } from "@/components/ui";
import { plannerLabel } from "@/data/catalog";
import { SignedOutPrompt } from "@/features/auth";
import { aiActivity } from "@/state/adminApi";
import { useSession } from "@/state/session";
import { formatDate } from "@/utils/format";

const RANGES = [1, 7, 30];
const seconds = (ms) => (ms == null ? "–" : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`);
const percent = (rate) => (rate == null ? "–" : `${Math.round(rate * 100)}%`);
const agentName = (agent) => ({ reviser: "Change it in words", search: "Search" })[agent] ?? plannerLabel(agent);

function Stat({ label, value, detail }) {
  return (
    <div className="ai-stat">
      <p className="t-body-sm c-mute">{label}</p>
      <p className="t-heading-lg c-ink">{value}</p>
      {detail && <p className="t-caption-sm c-mute">{detail}</p>}
    </div>
  );
}

/** For admins: how the local models performed, from every recorded planning run and model call. */
export default function AiActivity() {
  const { user, ready } = useSession();
  const [days, setDays] = useState(7);
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    if (user?.role !== "admin") return undefined;
    let live = true;
    setState({ data: null, error: null });
    aiActivity(days)
      .then((data) => live && setState({ data, error: null }))
      .catch((err) => live && setState({ data: null, error: err.message }));
    return () => {
      live = false;
    };
  }, [days, user]);

  if (!user) return <SignedOutPrompt title="AI activity" body="Log in with an admin account to see how the local AI models are doing." />;
  if (ready && user.role !== "admin") {
    return (
      <SystemPage icon="shield" title="Only admins can see this">
        <p className="t-body-md c-body">AI activity shows every planning run, so it's limited to admin accounts.</p>
      </SystemPage>
    );
  }
  const { data, error } = state;

  return (
    <div className="container section ai-activity">
      <Section
        title="AI activity"
        as="h1"
        intro="How the local models are doing: each planning run, every model call, and when the planners fell back to rules."
        actions={
          <ChipStrip aria-label="Time range">
            {RANGES.map((d) => (
              <Chip key={d} pressed={d === days} onClick={() => setDays(d)}>
                {d === 1 ? "Today" : `Last ${d} days`}
              </Chip>
            ))}
          </ChipStrip>
        }
      >
        {error && (
          <Notice tone="error" icon="alert">
            <p className="t-body-sm">{error}</p>
          </Notice>
        )}
        {!data && !error && <GridSkeleton />}
        {data && (
          <div className="stack-xl">
            <div className="ai-stats">
              <Stat label="Planning runs" value={data.totals.runs} detail={`${data.totals.runs_with_ai} used a model`} />
              <Stat label="Model calls" value={data.totals.calls} detail={`${percent(data.totals.ok_rate)} answered usefully`} />
              <Stat label="Typical run" value={seconds(data.totals.avg_run_ms)} detail={`Slowest 5%: ${seconds(data.totals.p95_run_ms)}`} />
            </div>

            <div className="stack-md">
              <h2 className="t-heading-md">By planner and model</h2>
              {data.by_agent.length === 0 ? (
                <p className="t-body-md c-mute">No model calls in this time range.</p>
              ) : (
                <div className="ai-table-wrap">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th scope="col">Planner</th>
                        <th scope="col">Model</th>
                        <th scope="col">Calls</th>
                        <th scope="col">Useful</th>
                        <th scope="col">Typical</th>
                        <th scope="col">Slowest 5%</th>
                        <th scope="col">Tokens in / out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_agent.map((r) => (
                        <tr key={`${r.agent}-${r.model}`}>
                          <th scope="row">{agentName(r.agent)}</th>
                          <td className="mono">{r.model}</td>
                          <td>{r.calls}</td>
                          <td>
                            <span className="ai-rate" style={{ "--rate": r.ok_rate }}>
                              {percent(r.ok_rate)}
                            </span>
                          </td>
                          <td>{seconds(r.avg_ms)}</td>
                          <td>{seconds(r.p95_ms)}</td>
                          <td>
                            {r.prompt_tokens.toLocaleString("en-IN")} / {r.output_tokens.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="stack-md">
              <h2 className="t-heading-md">Recent runs</h2>
              <ul className="divided account-rows">
                {data.recent.map((r) => (
                  <li key={r.id} className="account-row">
                    <div>
                      <p className="t-body-strong c-ink">“{r.request}”</p>
                      <p className="t-body-sm c-mute">
                        {formatDate(r.at)} · {seconds(r.duration_ms)} · {r.models.length ? r.models.join(", ") : "Rules only"}
                        {r.fell_back.length ? ` · Fell back: ${r.fell_back.map(agentName).join(", ")}` : ""}
                        {r.signed_in ? " · Signed in" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
