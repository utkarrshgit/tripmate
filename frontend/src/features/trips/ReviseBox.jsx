import { useState } from "react";
import { Button, Chip, ChipStrip, Notice, TextField, ThoughtLine } from "@/components/ui";
import { reviseTrip, restoreVersion } from "@/state/tripsApi";

const EXAMPLES = ["Make day 2 more relaxed", "Drop the first activity", "Swap the market for something outdoors"];

/**
 * "Change it in words": a sentence becomes a new version of the trip, made by the local AI
 * model (or straight away for exact commands like "drop the fort"). Shows what changed,
 * with Undo, which restores the version before.
 */
export default function ReviseBox({ trip, onChange }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { changes, previousNo }

  async function submit(e) {
    e?.preventDefault();
    if (!instruction.trim()) return setError("Say what to change, like “make day 2 more relaxed”.");
    setBusy(true);
    setError(null);
    setResult(null);
    const previousNo = trip.version.no;
    try {
      const updated = await reviseTrip(trip.id, instruction.trim());
      setResult({ changes: updated.changes, previousNo });
      setInstruction("");
      onChange(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      onChange(await restoreVersion(trip.id, result.previousNo));
      setResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feature-card feature-card-soft revise-box no-print" aria-labelledby="revise-title">
      <div className="stack-lg">
        <div className="stack-xs">
          <h2 id="revise-title" className="t-heading-md">
            Change it in words
          </h2>
          <p className="t-body-sm c-mute">Say what you'd like different. We'll save it as a new version, so you can always go back.</p>
        </div>
        {busy && !result ? (
          <ThoughtLine working label="Changing your plan with a local AI model…" steps={[`“${instruction}”`]} collapseOnSettle={false} glyphColor="var(--color-accent-purple)" />
        ) : (
          <form className="stack-md" onSubmit={submit} noValidate>
            <TextField
              label="What should change?"
              value={instruction}
              onChange={(e) => (setInstruction(e.target.value), setError(null))}
              placeholder="Make day 2 more relaxed"
              maxLength={500}
              error={error}
            />
            <ChipStrip aria-label="Examples">
              {EXAMPLES.map((ex) => (
                <Chip key={ex} onClick={() => setInstruction(ex)}>
                  {ex}
                </Chip>
              ))}
            </ChipStrip>
            <div>
              <Button type="submit" variant="primary" icon="sparkle" disabled={busy}>
                Change plan
              </Button>
            </div>
          </form>
        )}
        {result && (
          <Notice icon="check" tone="success" className="swap-in">
            <div className="stack-sm">
              <p className="t-body-strong">Saved as version {trip.version.no}</p>
              <ul className="revise-changes t-body-sm">
                {result.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div>
                <Button variant="tertiary" icon="refresh" onClick={undo} disabled={busy}>
                  Undo
                </Button>
              </div>
            </div>
          </Notice>
        )}
      </div>
    </section>
  );
}
