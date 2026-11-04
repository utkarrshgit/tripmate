import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Skeleton } from "@/components/ui";
import { endSession, listSessions } from "@/state/authApi";
import { useSession } from "@/state/session";
import { formatDate } from "@/utils/format";

/** "Chrome on macOS" from a user-agent string; "A browser" when it can't tell. */
function describeDevice(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "A browser";
}

/** Where you're signed in, with Sign out for each other device and Sign out everywhere. */
export default function SessionsList() {
  const { logOutEverywhere } = useSession();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function signOut(id) {
    setError(null);
    try {
      await endSession(id);
      setSessions((list) => list.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  if (!sessions && !error) return <Skeleton height={120} />;

  return (
    <div className="stack-lg">
      {sessions && (
        <ul className="divided account-rows">
          {sessions.map((s) => (
            <li key={s.id} className="account-row">
              <div>
                <p className="t-body-strong c-ink">{describeDevice(s.userAgent)}</p>
                <p className="t-body-sm c-mute">
                  {s.current ? "This device" : `Last active ${formatDate(s.lastSeenAt)}`} · Signed in {formatDate(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button icon="logout" onClick={() => signOut(s.id)}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
      <div>
        <Button
          variant="tertiary"
          icon="logout"
          onClick={async () => {
            await logOutEverywhere();
            navigate("/");
          }}
        >
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
