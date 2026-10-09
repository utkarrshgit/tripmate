/*
 * Accounts and saved trips.
 *
 * TEMPORARY LOCAL STAND-IN: the backend has User/Trip models but no auth or
 * trip endpoints yet, so this keeps everything in the browser's localStorage.
 * There is no password — the User model has only name and email. Swap these
 * functions for API calls once the endpoints exist; the components only use
 * the context below.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const KEYS = {
  users: "tripmate:users",
  session: "tripmate:session",
  trips: (email) => `tripmate:trips:${email}`,
};

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

const normalise = (email) => email.trim().toLowerCase();

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(() => {
    const email = read(KEYS.session, null);
    return email ? read(KEYS.users, {})[email] ?? null : null;
  });
  const [trips, setTrips] = useState(() => (user ? read(KEYS.trips(user.email), []) : []));
  const [authModal, setAuthModal] = useState(null); // null | "signup" | "login"

  const startSession = useCallback((account) => {
    write(KEYS.session, account.email);
    setUser(account);
    setTrips(read(KEYS.trips(account.email), []));
    setAuthModal(null);
  }, []);

  const signUp = useCallback(
    ({ name, email }) => {
      const users = read(KEYS.users, {});
      const key = normalise(email);
      if (users[key]) throw new Error("An account with this email already exists. Log in instead.");
      const account = { name: name.trim(), email: key, createdAt: new Date().toISOString() };
      write(KEYS.users, { ...users, [key]: account });
      startSession(account);
    },
    [startSession],
  );

  const logIn = useCallback(
    ({ email }) => {
      const account = read(KEYS.users, {})[normalise(email)];
      if (!account) throw new Error("We couldn't find an account with that email. Check it, or sign up instead.");
      startSession(account);
    },
    [startSession],
  );

  const logOut = useCallback(() => {
    write(KEYS.session, undefined);
    setUser(null);
    setTrips([]);
  }, []);

  const updateProfile = useCallback(
    ({ name, email }) => {
      const users = read(KEYS.users, {});
      const nextEmail = normalise(email);
      if (nextEmail !== user.email && users[nextEmail]) {
        throw new Error("Another account uses this email. Enter a different one.");
      }
      const account = { ...user, name: name.trim(), email: nextEmail };
      const { [user.email]: _old, ...rest } = users;
      write(KEYS.users, { ...rest, [nextEmail]: account });
      if (nextEmail !== user.email) {
        write(KEYS.trips(nextEmail), read(KEYS.trips(user.email), []));
        write(KEYS.trips(user.email), undefined);
      }
      write(KEYS.session, nextEmail);
      setUser(account);
    },
    [user],
  );

  const deleteAccount = useCallback(() => {
    const { [user.email]: _gone, ...rest } = read(KEYS.users, {});
    write(KEYS.users, rest);
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
      openAuth: setAuthModal,
      closeAuth: () => setAuthModal(null),
      signUp,
      logIn,
      logOut,
      updateProfile,
      deleteAccount,
      saveTrip,
      updateTrip,
      deleteTrip,
      exportData,
    }),
    [user, trips, authModal, signUp, logIn, logOut, updateProfile, deleteAccount, saveTrip, updateTrip, deleteTrip, exportData],
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
