/*
 * Saved trips, through the API's /api/v1/trips (signed in) and /api/v1/shared (open).
 * Errors are AuthErrors with messages that can be shown as they are.
 *
 * A trip as the website uses it:
 *   { id, title, status, query, plan, savedAt, updatedAt, hasPricing }      (in lists; `plan` has card fields only)
 *   + { version, items, pricing, versions }                                (one trip; `plan` is the full plan)
 */
import { call } from "./authApi";

const trip = (t) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  query: t.query,
  plan: t.plan,
  hasPricing: t.has_pricing,
  savedAt: t.saved_at,
  updatedAt: t.updated_at,
  deletedAt: t.deleted_at ?? null,
  ...(t.version && {
    version: version(t.version),
    items: t.items.map((i) => ({ id: i.id, dayNo: i.day_no, slot: i.slot, position: i.position, title: i.title, note: i.note, estCost: i.est_cost })),
    pricing: t.pricing,
    versions: t.versions.map(version),
  }),
});

const version = (v) => ({ no: v.no, source: v.source, query: v.query, totalCost: v.total_cost, createdAt: v.created_at, current: v.current });

const page = (p) => ({ trips: p.trips.map(trip), total: p.total, page: p.page, perPage: p.per_page });

const one = async (promise) => trip((await promise).data);

export const listTrips = async ({ q, status } = {}) => {
  const params = new URLSearchParams(Object.entries({ q, status }).filter(([, v]) => v));
  return page((await call("GET", `/trips${params.size ? `?${params}` : ""}`)).data);
};
export const listTrash = async () => page((await call("GET", "/trips/trash")).data);
export const getTrip = (id) => one(call("GET", `/trips/${id}`));

/** Saves a planned trip, with its exact prices if they were checked. */
export const createTrip = ({ query, plan, pricing = null }) => one(call("POST", "/trips", { query, plan, pricing }));
/** Moves trips kept in this browser (before accounts existed) into the account. */
export const importTrips = async (trips) =>
  (await call("POST", "/trips/import", { trips: trips.map(({ query, plan, pricing }) => ({ query, plan, pricing: pricing ?? null })) })).data;

export const renameTrip = (id, title) => one(call("PATCH", `/trips/${id}`, { title }));
export const trashTrip = (id) => call("DELETE", `/trips/${id}`);
export const restoreTrip = (id) => one(call("POST", `/trips/${id}/restore`));
export const deleteTripForever = (id) => call("DELETE", `/trips/${id}?forever=true`);

/** Saves a new plan for the trip as its next version. */
export const addVersion = (id, { query, plan }) => one(call("POST", `/trips/${id}/versions`, { query, plan }));
export const restoreVersion = (id, no) => one(call("POST", `/trips/${id}/versions/${no}/restore`));

const toItem = ({ dayNo, slot, title, note, estCost }) =>
  Object.fromEntries(Object.entries({ day_no: dayNo, slot, title, note, est_cost: estCost }).filter(([, v]) => v !== undefined));
export const addItem = (id, item) => one(call("POST", `/trips/${id}/items`, toItem(item)));
export const updateItem = (id, itemId, changes) => one(call("PATCH", `/trips/${id}/items/${itemId}`, toItem(changes)));
export const deleteItem = (id, itemId) => one(call("DELETE", `/trips/${id}/items/${itemId}`));

export const savePricing = (id, pricing) => one(call("POST", `/trips/${id}/prices`, pricing));

/** A read-only link. The token comes back only now, so the link is built from it here. */
export async function createShare(id) {
  const { data } = await call("POST", `/trips/${id}/shares`);
  return { id: data.id, createdAt: data.created_at, views: 0, url: `${window.location.origin}/shared/${data.token}` };
}
export const listShares = async (id) =>
  (await call("GET", `/trips/${id}/shares`)).data.map((s) => ({ id: s.id, createdAt: s.created_at, views: s.view_count }));
export const revokeShare = (shareId) => call("DELETE", `/shares/${shareId}`);

/** The trip behind a share link, for anyone with the link. */
export async function openShared(token) {
  const { data } = await call("GET", `/shared/${encodeURIComponent(token)}`);
  return { title: data.title, query: data.query, plan: data.plan, sharedBy: data.shared_by, savedAt: data.saved_at };
}
