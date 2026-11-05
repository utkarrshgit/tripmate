import { useState } from "react";
import { Link } from "react-router-dom";
import { GridSkeleton } from "@/app/PageSkeletons";
import { Button, FeatureRow, Masonry, Notice, SearchBar, Section } from "@/components/ui";
import { SignedOutPrompt } from "@/features/auth";
import { ConfirmDeleteTrip, TripCard, tripName } from "@/features/trips";
import { useSession } from "@/state/session";
import { deleteTripForever, listTrash, restoreTrip, searchTrips } from "@/state/tripsApi";
import { formatDate, plural } from "@/utils/format";

const RATIOS = ["3 / 4", "4 / 5", "2 / 3", "1 / 1"];

/** Trips deleted in the last 30 days: restore one, or delete it for good. Loads when opened. */
function RecentlyDeleted() {
  const { tripChanged } = useSession();
  const [trash, setTrash] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      setTrash((await listTrash()).trips);
    } catch (err) {
      setError(err.message);
    }
  }

  async function act(fn, id) {
    setError(null);
    try {
      const result = await fn(id);
      if (result?.id) tripChanged(result); // restored: back in the list
      setTrash((list) => list.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Section title="Recently deleted" as="h2" headingClass="t-heading-lg" intro="Deleted trips stay here for 30 days." className="no-print">
      {trash === null ? (
        <div>
          <Button icon="trash" onClick={load}>
            Show deleted trips
          </Button>
        </div>
      ) : trash.length === 0 ? (
        <p className="t-body-md c-mute">Nothing deleted in the last 30 days.</p>
      ) : (
        <ul className="divided account-rows">
          {trash.map((t) => (
            <li key={t.id} className="account-row">
              <div>
                <p className="t-body-strong c-ink">{t.title || tripName(t.plan)}</p>
                <p className="t-body-sm c-mute">Deleted {formatDate(t.deletedAt)}</p>
              </div>
              <span className="row">
                <Button icon="refresh" onClick={() => act(restoreTrip, t.id)}>
                  Restore
                </Button>
                <Button variant="tertiary" onClick={() => act(deleteTripForever, t.id)}>
                  Delete forever
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}

/** Search your trips by meaning ("quiet beach trip"), with the local embedding model. */
function TripSearch({ onResults }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(value) {
    const text = value.trim();
    if (!text) return onResults(null);
    setBusy(true);
    setError(null);
    try {
      onResults({ q: text, ...(await searchTrips(text)) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-sm trip-search no-print">
      <SearchBar
        label="Search your trips"
        placeholder="Search your trips, like “quiet beach trip”"
        value={q}
        onChange={(value) => {
          setQ(value);
          if (!value) onResults(null);
        }}
        onSubmit={submit}
        submitLabel={busy ? "Searching" : "Search"}
      />
      {error && (
        <p className="field-error swap-in" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function MyTrips() {
  const { user, trips, tripsLoaded, tripsError, refreshTrips, imported, dismissImported, deleteTrip } = useSession();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [search, setSearch] = useState(null); // { q, mode, results } while searching

  if (!user) {
    return <SignedOutPrompt title="Your trips" body="Log in to view your saved trips." />;
  }
  if (!tripsLoaded) return <GridSkeleton />;
  if (tripsError && !trips.length) {
    return (
      <div className="container section">
        <Notice tone="error" icon="alert" title="We couldn't load your trips">
          <p className="t-body-sm">{tripsError}</p>
          <div>
            <Button onClick={refreshTrips}>Try again</Button>
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <div className="container">
      {imported > 0 && (
        <Notice icon="check" tone="success" className="trips-imported">
          <p className="t-body-sm">
            We moved {plural(imported, "trip")} saved in this browser into your account, so you'll see {imported === 1 ? "it" : "them"} on any device.{" "}
            <button type="button" className="link-inline link-button" onClick={dismissImported}>
              OK
            </button>
          </p>
        </Notice>
      )}
      <Section
        title="Your trips"
        as="h1"
        intro={trips.length ? plural(trips.length, "saved trip") : "Nothing saved yet."}
        actions={
          trips.length > 0 && (
            <Button as={Link} to="/plan" icon="plus">
              Plan another trip
            </Button>
          )
        }
      >
        {trips.length === 0 ? (
          <FeatureRow
            soft
            headingLevel={2}
            title="Save the plans you like"
            body={<>When a plan looks right, select <strong>Save trip</strong>. You'll find it here whenever you come back.</>}
            action={
              <Button as={Link} to="/plan" variant="primary">
                Plan your first trip
              </Button>
            }
          />
        ) : (
          <div className="stack-lg">
            {trips.length > 1 && <TripSearch onResults={setSearch} />}
            {search && (
              <p className="t-body-sm c-mute" role="status">
                {search.results.length ? plural(search.results.length, "trip") : "No trips"} for “{search.q}”
                {search.mode === "meaning" ? ", best matches first. Searched by meaning with a local AI model." : ". Searched by words: the local AI model isn't running."}
              </p>
            )}
            <Masonry key={search?.q ?? "all"}>
              {(search ? search.results : trips).map((trip, i) => (
                <TripCard key={trip.id} trip={trip} ratio={RATIOS[i % RATIOS.length]} onDelete={setPendingDelete} />
              ))}
            </Masonry>
          </div>
        )}
      </Section>
      <RecentlyDeleted key={trips.length} />

      {pendingDelete && (
        <ConfirmDeleteTrip
          trip={pendingDelete}
          error={deleteError}
          onCancel={() => (setPendingDelete(null), setDeleteError(null))}
          onConfirm={async () => {
            try {
              await deleteTrip(pendingDelete.id);
              setPendingDelete(null);
            } catch (err) {
              setDeleteError(err.message);
            }
          }}
        />
      )}
    </div>
  );
}
