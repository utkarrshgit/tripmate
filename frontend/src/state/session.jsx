/*
 * The signed-in account, the sign-up window, and saved trips.
 *
 * Accounts go through ./authApi.js and the API; the session itself is an HttpOnly cookie.
 * Saved trips are still TEMPORARY LOCAL STAND-INS in localStorage, keyed by email, until the
 * trip endpoints exist (step 3). Components only use the context below.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authApi from "./authApi";

const KEYS = {
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
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
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
          setTrips(read(KEYS.trips(account.email), []));
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

  const signOutLocally = useCallback(() => {
    setUser(null);
    setTrips([]);
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
      write(KEYS.trips(account.email), read(KEYS.trips(previousEmail), []));
      write(KEYS.trips(previousEmail), undefined);
      setUser(account);
    },
    [user],
  );

  /** Signs out every other device; this one stays signed in. */
  const changePassword = useCallback(async (values) => authApi.changePassword(values), []);

  const deleteAccount = useCallback(
    async (password) => {
      await authApi.deleteAccount({ password });
      write(KEYS.trips(user.email), undefined);
      signOutLocally();
    },
    [user, signOutLocally],
  );

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

  // The API's export, plus the trips this browser still keeps until step 3 moves them to the API.
  const exportData = useCallback(async () => ({ ...(await authApi.exportAccount()), trips }), [trips]);

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
      saveTrip,
      updateTrip,
      deleteTrip,
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
