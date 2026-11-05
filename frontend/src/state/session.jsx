/*
 * The signed-in account, the sign-up window, and saved trips.
 *
 * Accounts go through ./authApi.js and trips through ./tripsApi.js; the session itself is
 * an HttpOnly cookie. `trips` is the signed-in account's list (card fields only); a page
 * that shows one trip loads it with getTrip. Components only use the context below.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authApi from "./authApi";
import * as tripsApi from "./tripsApi";

// Where trips lived before accounts moved to the API. Moved into the account once, then cleared.
const LEGACY_TRIPS_KEY = (email) => `tripmate:trips:${email}`;
// The email waiting for a code, kept for this tab so a refresh reopens the code step.
const PENDING_KEY = "tripmate:pendingCode";

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY)) ?? null;
  } catch {
    return null;
  }
}

function writePending(value) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Non-critical: a refresh then starts the window over.
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the app still works for this visit.
  }
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  // How many browser-saved trips were just moved into the account, for a one-time notice.
  const [imported, setImported] = useState(0);

  /** Loads the account's trips, first moving in any this browser saved before accounts used the API. */
  const loadTrips = useCallback(async (account) => {
    const legacy = read(LEGACY_TRIPS_KEY(account.email), []);
    if (legacy.length) {
      try {
        const { imported: count } = await tripsApi.importTrips(legacy);
        write(LEGACY_TRIPS_KEY(account.email), undefined);
        setImported(count);
      } catch {
        // Keep them in the browser and try again next time.
      }
    }
    try {
      setTrips((await tripsApi.listTrips()).trips);
      setTripsError(null);
    } catch (err) {
      setTrips([]);
      setTripsError(err.message); // say so, rather than show "Nothing saved yet"
    }
    setTripsLoaded(true);
  }, []);
  // False until the API has said who's signed in, so pages don't flash "Log in" on a refresh.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    authApi
      .fetchMe()
      .catch(() => null) // API unreachable: treat as signed out; the planner still works
      .then((account) => {
        if (!live) return;
        if (account) {
          setUser(account);
          loadTrips(account);
        }
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  // The sign-up window: null when closed, else { step, ...details }. Steps: signup, login,
  // forgot, code ({ email, purpose, resendAt, devCode }), newPassword ({ email, code }).
  const [authModal, setAuthModal] = useState(() => {
    const pending = readPending();
    return pending ? { step: "code", ...pending } : null;
  });
  // What to do once signed in, like saving the trip that prompted the sign-up.
  const afterAuth = useRef(null);

  const openAuth = useCallback((step, { then } = {}) => {
    afterAuth.current = then ?? null;
    setAuthModal({ step });
  }, []);

  /** Moves the open window to another step. A code step is remembered for this tab. */
  const goToStep = useCallback((step, details = {}) => {
    writePending(step === "code" ? { email: details.email, purpose: details.purpose, resendAt: details.resendAt, devCode: details.devCode } : null);
    setAuthModal({ step, ...details });
  }, []);

  const closeAuth = useCallback(() => {
    writePending(null);
    afterAuth.current = null;
    setAuthModal(null);
  }, []);

  /** Signs in. The window stays open so it can show success; it calls finishAuth to close. */
  const startSession = useCallback((account) => {
    setUser(account);
    loadTrips(account);
    writePending(null);
  }, []);

  const finishAuth = useCallback(() => {
    const then = afterAuth.current;
    afterAuth.current = null;
    setAuthModal(null);
    then?.();
  }, []);

  const signUp = useCallback(async (values) => authApi.signUp(values), []);

  /** Resolves to { verify } when the email still needs a code, or {} once signed in. */
  const logIn = useCallback(
    async (values) => {
      const result = await authApi.logIn(values);
      if (result.user) startSession(result.user);
      return result;
    },
    [startSession],
  );

  const verifyEmail = useCallback(
    async (values) => {
      const { user: account } = await authApi.verifyEmail(values);
      startSession(account);
    },
    [startSession],
  );

  const resetPassword = useCallback(
    async (values) => {
      const { user: account } = await authApi.resetPassword(values);
      startSession(account);
    },
    [startSession],
  );

  const signOutLocally = useCallback(() => {
    setUser(null);
    setTrips([]);
    setTripsLoaded(false);
  }, []);

  const logOut = useCallback(async () => {
    try {
      await authApi.logOut();
    } finally {
      signOutLocally(); // even if the API is unreachable, this browser stops showing the account
    }
  }, [signOutLocally]);

  const logOutEverywhere = useCallback(async () => {
    await authApi.logOutEverywhere();
    signOutLocally();
  }, [signOutLocally]);

  const updateName = useCallback(async (name) => {
    const { user: account } = await authApi.updateName({ name });
    setUser(account);
  }, []);

  /** Step 2 of an email change: the code sent to the new address. Moves saved trips across. */
  const confirmEmailChange = useCallback(
    async (values) => {
      const previousEmail = user.email;
      const { user: account } = await authApi.confirmEmailChange(values);
      void previousEmail; // trips belong to the account on the server, so nothing moves
      setUser(account);
    },
    [user],
  );

  /** Signs out every other device; this one stays signed in. */
  const changePassword = useCallback(async (values) => authApi.changePassword(values), []);

  const deleteAccount = useCallback(
    async (password) => {
      await authApi.deleteAccount({ password });
      signOutLocally();
    },
    [user, signOutLocally],
  );

  /** Saves a planned trip to the account and returns it. `pricing` is an exact-price check, if one was made. */
  const saveTrip = useCallback(async (plan, query, pricing = null) => {
    const trip = await tripsApi.createTrip({ query, plan, pricing });
    setTrips((list) => [trip, ...list]);
    return trip;
  }, []);

  /** Keeps the list in step after a page changes one trip (rename, new version, prices…). */
  const tripChanged = useCallback((trip) => {
    setTrips((list) => {
      const rest = list.filter((t) => t.id !== trip.id);
      return trip.deletedAt ? rest : [trip, ...rest];
    });
  }, []);

  /** Moves a trip to the trash (kept 30 days). */
  const deleteTrip = useCallback(async (id) => {
    await tripsApi.trashTrip(id);
    setTrips((list) => list.filter((t) => t.id !== id));
  }, []);

  const refreshTrips = useCallback(async () => {
    try {
      setTrips((await tripsApi.listTrips()).trips);
      setTripsError(null);
    } catch (err) {
      setTripsError(err.message);
    }
  }, []);

  const exportData = useCallback(() => authApi.exportAccount(), []);

  const value = useMemo(
    () => ({
      user,
      trips,
      ready,
      authModal,
      openAuth,
      goToStep,
      closeAuth,
      finishAuth,
      signUp,
      logIn,
      verifyEmail,
      resetPassword,
      logOut,
      logOutEverywhere,
      updateName,
      confirmEmailChange,
      changePassword,
      deleteAccount,
      tripsLoaded,
      tripsError,
      imported,
      dismissImported: () => setImported(0),
      saveTrip,
      tripChanged,
      deleteTrip,
      refreshTrips,
      exportData,
    }),
    [
      user,
      trips,
      ready,
      authModal,
      openAuth,
      goToStep,
      closeAuth,
      finishAuth,
      signUp,
      logIn,
      verifyEmail,
      resetPassword,
      logOut,
      logOutEverywhere,
      updateName,
      confirmEmailChange,
      changePassword,
      deleteAccount,
      tripsLoaded,
      tripsError,
      imported,
      saveTrip,
      tripChanged,
      deleteTrip,
      refreshTrips,
      exportData,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

// The most recent plan survives a refresh of the results page.
const LAST_PLAN_KEY = "tripmate:lastPlan";

export function rememberPlan(plan, query) {
  try {
    sessionStorage.setItem(LAST_PLAN_KEY, JSON.stringify({ plan, query }));
  } catch {
    // Non-critical.
  }
}

export function recallPlan() {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_PLAN_KEY)) ?? null;
  } catch {
    return null;
  }
}

// Where the viewer usually travels from — a per-browser convenience for the exact-prices form.
const ORIGIN_KEY = "tripmate:origin";

export function rememberOrigin(origin) {
  try {
    localStorage.setItem(ORIGIN_KEY, origin);
  } catch {
    // Non-critical.
  }
}

export function recallOrigin() {
  try {
    return localStorage.getItem(ORIGIN_KEY) ?? "";
  } catch {
    return "";
  }
}
