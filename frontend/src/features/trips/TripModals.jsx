import { useEffect, useState } from "react";
import { Button, Modal, TextField } from "@/components/ui";
import { createShare, listShares, renameTrip, revokeShare } from "@/state/tripsApi";
import { formatDate, plural } from "@/utils/format";

/** Rename a saved trip. */
export function RenameTripModal({ trip, onClose, onRenamed }) {
  const [title, setTitle] = useState(trip.title);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e, close) {
    e.preventDefault();
    if (!title.trim()) return setError("Enter a name for the trip.");
    setBusy(true);
    try {
      onRenamed(await renameTrip(trip.id, title));
      close();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Rename trip" onClose={onClose}>
      {({ close }) => (
        <form className="stack-xl modal-body" onSubmit={(e) => submit(e, close)} noValidate>
          <TextField label="Trip name" value={title} onChange={(e) => (setTitle(e.target.value), setError(null))} error={error} maxLength={150} autoFocus />
          <div className="row modal-actions">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Read-only share links: make one, copy it, see its views, turn it off. */
export function ShareTripModal({ trip, onClose }) {
  const [links, setLinks] = useState(null);
  const [fresh, setFresh] = useState(null); // the link just made: its address is shown only now
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listShares(trip.id)
      .then(setLinks)
      .catch((err) => setError(err.message));
  }, [trip.id]);

  async function make() {
    setError(null);
    try {
      const link = await createShare(trip.id);
      setFresh(link);
      setLinks((list) => [link, ...(list ?? [])]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
    } catch {
      document.getElementById("share-url")?.select();
    }
  }

  async function turnOff(id) {
    try {
      await revokeShare(id);
      setLinks((list) => list.filter((l) => l.id !== id));
      if (fresh?.id === id) setFresh(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Share this trip" onClose={onClose}>
      {({ close }) => (
        <div className="stack-xl modal-body">
          <p className="t-body-md c-body">Anyone with a link can view this trip, but not change it. They won't see your email. Turn a link off at any time.</p>
          {fresh ? (
            <div className="stack-sm">
              <TextField id="share-url" label="Link to share" value={fresh.url} readOnly onFocus={(e) => e.target.select()} help="Copy it now: for your privacy, we can't show this address again." />
              <div>
                <Button icon={copied ? "check" : "copy"} onClick={copy}>
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="primary" icon="plus" onClick={make}>
                Create a link
              </Button>
            </div>
          )}
          {links?.length > 0 && (
            <ul className="divided account-rows">
              {links.map((l) => (
                <li key={l.id} className="account-row">
                  <div>
                    <p className="t-body-strong c-ink">Link made {formatDate(l.createdAt)}</p>
                    <p className="t-body-sm c-mute">{plural(l.views, "view")}</p>
                  </div>
                  <Button variant="tertiary" onClick={() => turnOff(l.id)}>
                    Turn off
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p className="field-error swap-in" role="alert">
              {error}
            </p>
          )}
          <div className="row modal-actions">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
