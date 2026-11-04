import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Modal } from "@/components/ui";
import { PasswordField } from "@/features/auth";
import { useSession } from "@/state/session";
import { plural } from "@/utils/format";

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DataRow({ title, body, danger = false, action }) {
  return (
    <li className="account-row">
      <div>
        <p className={`t-body-strong ${danger ? "c-error" : "c-ink"}`}>{title}</p>
        <p className="t-body-sm c-mute">{body}</p>
      </div>
      {action}
    </li>
  );
}

/** Confirms account deletion with the password. */
function DeleteAccountModal({ tripCount, onClose }) {
  const { deleteAccount } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      await deleteAccount(password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete your account?" onClose={onClose}>
      {({ close }) => (
        <form className="stack-xl modal-body" onSubmit={submit} noValidate>
          <p className="t-body-md c-error">
            This permanently deletes your account and {plural(tripCount, "saved trip")}. You can't undo this.
          </p>
          <PasswordField
            label="Enter your password to confirm"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            error={error}
            autoFocus
          />
          <div className="row modal-actions">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Download / log out / delete account rows, plus the delete confirmation. */
export default function DataControls() {
  const { trips, exportData, logOut } = useSession();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  return (
    <>
      <div className="stack-sm account-section-head">
        <p className="t-body-md c-body">
          Download a copy of everything TripMate holds about you, or delete your account. Read our{" "}
          <Link to="/privacy" className="link-inline">
            Privacy Policy
          </Link>{" "}
          to learn how we use your data.
        </p>
      </div>
      <ul className="divided account-rows">
        <DataRow
          title="Download your data"
          body="Your profile and saved trips as a JSON file."
          action={
            <Button
              icon="download"
              onClick={async () => {
                setDownloadError(null);
                try {
                  downloadJson(await exportData(), "tripmate-data.json");
                } catch (err) {
                  setDownloadError(err.message);
                }
              }}
            >
              Download
            </Button>
          }
        />
        <DataRow
          title="Log out"
          body="You can log back in with your email and password."
          action={
            <Button
              icon="logout"
              onClick={async () => {
                await logOut();
                navigate("/");
              }}
            >
              Log out
            </Button>
          }
        />
        <DataRow
          danger
          title="Delete account"
          body="Permanently deletes your account and every saved trip."
          action={
            <Button variant="tertiary" icon="trash" className="is-danger" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          }
        />
      </ul>
      {downloadError && (
        <p className="field-error swap-in" role="alert">
          {downloadError}
        </p>
      )}

      {confirming && <DeleteAccountModal tripCount={trips.length} onClose={() => setConfirming(false)} />}
    </>
  );
}
