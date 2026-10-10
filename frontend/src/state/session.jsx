/*
 * The signed-in account, the sign-up window, and saved trips.
 *
 * Accounts and email codes go through ./authApi.js (a local stand-in for the planned
 * auth endpoints). Saved trips are still TEMPORARY LOCAL STAND-INS in localStorage until
 * the trip endpoints exist. Components only use the context below.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import * as authApi from "./authApi";

const KEYS = {
  session: "tripmate:session",
  trips: (email) => `tripmate:trips:${email}`,
};
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
  const [user, setUser] = useState(() => authApi.accountFor(read(KEYS.session, null)));
  const [trips, setTrips] = useState(() => (user ? read(KEYS.trips(user.email), []) : []));
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
    write(KEYS.session, account.email);
    setUser(account);
    setTrips(read(KEYS.trips(account.email), []));
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

  const logOut = useCallback(() => {
    write(KEYS.session, undefined);
    setUser(null);
    setTrips([]);
  }, []);

  const updateName = useCallback(
    async (name) => {
      const { user: account } = await authApi.updateName({ email: user.email, name });
      setUser(account);
    },
    [user],
  );

  /** Step 2 of an email change: the code sent to the new address. Moves saved trips across. */
  const confirmEmailChange = useCallback(async (values) => {
    const { user: account, previousEmail } = await authApi.confirmEmailChange(values);
    write(KEYS.trips(account.email), read(KEYS.trips(previousEmail), []));
    write(KEYS.trips(previousEmail), undefined);
    write(KEYS.session, account.email);
    setUser(account);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount({ email: user.email });
    write(KEYS.trips(user.email), undefined);
    logOut();
  }, [user, logOut]);

  const persistTrips = useCallback(
    (next) => {
      write(KEYS.trips(user.email), next);
      setTrips(next);
    },
    [user],
  );

  // `pricing` (optional) is an exact-price check: { origin, response, selection, checkedAt }.
  const saveTrip = useCallback(
    (plan, query, pricing = null) => {
      const trip = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        query,
        plan,
        pricing,
        savedAt: new Date().toISOString(),
      };
      persistTrips([trip, ...trips]);
      return trip;
    },
    [trips, persistTrips],
  );

  const updateTrip = useCallback(
    (id, patch) => persistTrips(trips.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [trips, persistTrips],
  );

  const deleteTrip = useCallback((id) => persistTrips(trips.filter((t) => t.id !== id)), [trips, persistTrips]);

  const exportData = useCallback(() => ({ account: user, trips, exportedAt: new Date().toISOString() }), [user, trips]);

  const value = useMemo(
    () => ({
      user,
      trips,
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
      updateName,
      confirmEmailChange,
      deleteAccount,
      saveTrip,
      updateTrip,
      deleteTrip,
      exportData,
    }),
    [
      user,
      trips,
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
      updateName,
      confirmEmailChange,
      deleteAccount,
      saveTrip,
      updateTrip,
      deleteTrip,
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
