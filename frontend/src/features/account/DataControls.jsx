import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Modal } from "@/components/ui";
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

/** Download / log out / delete account rows, plus the delete confirmation. */
export default function DataControls() {
  const { trips, exportData, deleteAccount, logOut } = useSession();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="stack-sm account-section-head">
        <p className="t-body-md c-body">
          Download a copy of everything TripMate holds about you, or delete your account. See our{" "}
          <Link to="/privacy" className="link-inline">
            Privacy Policy
          </Link>{" "}
          for how your data is used.
        </p>
      </div>
      <ul className="divided account-rows">
        <DataRow
          title="Download my data"
          body="Your profile and saved trips as a JSON file."
          action={
            <Button icon="download" onClick={() => downloadJson(exportData(), "tripmate-data.json")}>
              Download
            </Button>
          }
        />
        <DataRow
          title="Log out"
          body="You can log back in with your email."
          action={
            <Button
              icon="logout"
              onClick={() => {
                logOut();
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
          body="Permanently removes your account and every saved trip."
          action={
            <Button variant="tertiary" icon="trash" className="is-danger" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          }
        />
      </ul>

      {confirming && (
        <Modal title="Delete your account?" onClose={() => setConfirming(false)}>
          {({ close }) => (
            <div className="stack-xl modal-body">
              <p className="t-body-md c-error">
                This permanently deletes your account and {plural(trips.length, "saved trip")}. It can't be undone.
              </p>
              <div className="row modal-actions">
                <Button onClick={close}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    deleteAccount();
                    navigate("/", { replace: true });
                  }}
                >
                  Delete account
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
