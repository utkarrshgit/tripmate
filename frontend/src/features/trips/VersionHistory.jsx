import { useState } from "react";
import { Button, Section } from "@/components/ui";
import { restoreVersion } from "@/state/tripsApi";
import { formatDate, rupees } from "@/utils/format";

const SOURCE = { plan: "Planned", revise: "Changed in words", restore: "Restored" };

/** Every version of a saved trip, newest first. Restoring copies an older one into a new version, so nothing is lost. */
export default function VersionHistory({ trip, onRestored }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  if (trip.versions.length < 2) return null;

  async function restore(no) {
    setBusy(no);
    setError(null);
    try {
      onRestored(await restoreVersion(trip.id, no));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section id="versions" title="Versions" intro="Each time you plan this trip again, the earlier plan is kept here." className="no-print">
      <ul className="divided account-rows">
        {trip.versions.map((v) => (
          <li key={v.no} className="account-row">
            <div>
              <p className="t-body-strong c-ink">
                Version {v.no}
                {v.current ? " · showing now" : ""}
              </p>
              <p className="t-body-sm c-mute">
                {SOURCE[v.source] ?? "Planned"} {formatDate(v.createdAt)} · {rupees(v.totalCost)} · “{v.query}”
              </p>
            </div>
            {!v.current && (
              <Button icon="refresh" onClick={() => restore(v.no)} disabled={busy !== null}>
                {busy === v.no ? "Restoring…" : "Restore"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
