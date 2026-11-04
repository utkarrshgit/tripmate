/*
 * Accounts and email codes, through the API's /api/v1/auth and /api/v1/users/me.
 *
 * The session is an HttpOnly cookie the browser sends with every request
 * (credentials: "include"); the website never sees the token. Errors arrive as
 * { error: { code, message, field, ... } } and become an AuthError whose message
 * can be shown as it is.
 *
 * While email isn't connected (the API's DEV_SHOW_CODES), a sent code also comes
 * back as `devCode` for the sign-up window to show.
 */

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const CODE_LENGTH = 6;

/** An error the screens can show as it is. `field` names the input it belongs to, if any. */
export class AuthError extends Error {
  constructor(code, message, field = null, extra = {}) {
    super(message);
    this.code = code;
    this.field = field;
    Object.assign(this, extra);
  }
}

const toMs = (iso) => (iso ? Date.parse(iso) : undefined);

/** A sent code, in the shape the code step uses. */
const sent = (body) => ({ email: body.email, purpose: body.purpose, resendAt: toMs(body.resend_at), devCode: body.dev_code ?? undefined });

/** The account as the rest of the app sees it. */
const user = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at, verifiedAt: u.email_verified_at });

/** One request to /api/v1 with the session cookie. Throws AuthError with the API's message. Shared by tripsApi.js. */
export async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AuthError("unreachable", "We can't reach TripMate right now. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error ?? {};
    throw new AuthError(e.code ?? "error", e.message ?? "Something went wrong. Try again.", e.field ?? null, {
      status: res.status,
      triesLeft: e.tries_left,
      resendAt: toMs(e.resend_at),
      devCode: e.dev_code ?? undefined,
    });
  }
  return { status: res.status, data };
}

/* ---- Sign-up, log-in and codes ---- */

/** A code is sent; no session until it's entered. */
export async function signUp({ name, email, password }) {
  return sent((await call("POST", "/auth/signup", { name, email, password })).data);
}

/** { user } when signed in, or { verify } (a code step) when the email isn't verified yet. */
export async function logIn({ email, password }) {
  const { status, data } = await call("POST", "/auth/login", { email, password });
  return status === 202 ? { verify: sent(data.verify) } : { user: user(data.user) };
}

/** Signs in. */
export async function verifyEmail({ email, code }) {
  return { user: user((await call("POST", "/auth/verify-email", { email, code })).data) };
}

export async function resendCode({ email, purpose }) {
  return sent((await call("POST", "/auth/resend-code", { email, purpose })).data);
}

export async function logOut() {
  await call("POST", "/auth/logout");
}

export async function logOutEverywhere() {
  await call("POST", "/auth/logout-all");
}

/* ---- Password reset ---- */

/** The same answer whether or not the account exists. */
export async function requestPasswordReset({ email }) {
  return sent((await call("POST", "/auth/forgot-password", { email })).data);
}

/** Checks a reset code before asking for the new password (counts wrong tries, doesn't use it up). */
export async function checkResetCode({ email, code }) {
  await call("POST", "/auth/reset-password/check", { email, code });
}

/** Signs in and signs out every other device. */
export async function resetPassword({ email, code, password }) {
  return { user: user((await call("POST", "/auth/reset-password", { email, code, password })).data) };
}

/* ---- Your account ---- */

/** The signed-in account, or null when signed out. */
export async function fetchMe() {
  try {
    return user((await call("GET", "/users/me")).data);
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

export async function updateName({ name }) {
  return { user: user((await call("PATCH", "/users/me", { name })).data) };
}

/** Checks the password, then sends a code to the new address. */
export async function requestEmailChange({ newEmail, password }) {
  return sent((await call("POST", "/users/me/email", { new_email: newEmail, password })).data);
}

export async function confirmEmailChange({ newEmail, code }) {
  return { user: user((await call("POST", "/users/me/email/verify", { new_email: newEmail, code })).data) };
}

/** Signs out every other device. */
export async function changePassword({ currentPassword, newPassword }) {
  await call("POST", "/users/me/password", { current_password: currentPassword, new_password: newPassword });
}

export async function listSessions() {
  return (await call("GET", "/users/me/sessions")).data.map((s) => ({
    id: s.id,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
    current: s.current,
  }));
}

export async function endSession(id) {
  await call("DELETE", `/users/me/sessions/${id}`);
}

export async function exportAccount() {
  return (await call("GET", "/users/me/export")).data;
}

/** Deletes the account and everything it owns, after checking the password. */
export async function deleteAccount({ password }) {
  await call("DELETE", "/users/me", { password });
}
