/*
 * TEMPORARY demo delays — so the planning orbs and progress steps can be seen.
 *
 * The API answers in milliseconds, which makes the planning screen flash past.
 * These hold each loading state on screen for a minimum time.
 *
 * - Only active in development (`npm run dev`); production builds always use 0.
 * - Turn off in dev with VITE_DEMO_DELAYS=false in frontend/.env.local.
 * - To remove entirely: delete this file and the two `withDemoDelay` calls
 *   (features/planner/usePlanRequest.js, features/system/UnavailablePanel.jsx,
 *   features/pricing/usePriceRequest.js).
 */
const enabled = import.meta.env.DEV && import.meta.env.VITE_DEMO_DELAYS !== "false";

export const DEMO_DELAYS = {
  // Long enough for all nine planners to take their turn (9 × 450ms) before "ready".
  planningMs: enabled ? 4500 : 0,
  // Long enough to see the "retrying" orb while the service check runs.
  healthCheckMs: enabled ? 1800 : 0,
  // Long enough to see the "searching" orb while exact prices load.
  pricingMs: enabled ? 2500 : 0,
};

/** Resolves with `promise`'s value, but no sooner than `minMs`. Rejections still wait. */
export async function withDemoDelay(promise, minMs) {
  if (!minMs) return promise;
  const wait = new Promise((resolve) => setTimeout(resolve, minMs));
  try {
    const value = await promise;
    await wait;
    return value;
  } catch (err) {
    await wait;
    throw err;
  }
}
