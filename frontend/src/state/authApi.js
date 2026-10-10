/*
 * Accounts and email codes.
 *
 * TEMPORARY LOCAL STAND-IN for the planned /api/v1/auth endpoints (see the backend
 * blueprint). Each function has the shape of its endpoint and the same rules: codes
 * last 10 minutes, 5 wrong tries, a new code after 60 seconds and at most 5 an hour,
 * and unverified accounts are dropped after 24 hours. When the API exists, each
 * function becomes one fetch call and `devCode` disappears.
 *
 * There's no email yet, so a sent code comes back as `devCode` for the sign-up window
 * to show. Passwords are salted and hashed even here, but this is not real security:
 * everything lives in this browser's localStorage.
 */

const KEYS = { users: "tripmate:users", codes: "tripmate:codes", attempts: "tripmate:loginAttempts" };

export const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const UNVERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** An error the screens can show as it is. `field` names the input it belongs to, if any. */
export class AuthError extends Error {
  constructor(code, message, field = null, extra = {}) {
    super(message);
    this.code = code;
    this.field = field;
    Object.assign(this, extra);
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
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}

export const normaliseEmail = (email) => email.trim().toLowerCase();

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

/** Six random digits, evenly spread (no modulo bias). */
function newCode() {
  const max = 10 ** CODE_LENGTH;
  const limit = Math.floor(0xffffffff / max) * max;
  let n;
  do n = crypto.getRandomValues(new Uint32Array(1))[0];
  while (n >= limit);
  return String(n % max).padStart(CODE_LENGTH, "0");
}

/** Every account, minus ones left unverified for more than 24 hours. */
function users() {
  const all = read(KEYS.users, {});
  const now = Date.now();
  const kept = Object.fromEntries(
    Object.entries(all).filter(([, u]) => u.verifiedAt || !u.passwordHash || now - Date.parse(u.createdAt) < UNVERIFIED_TTL_MS),
  );
  if (Object.keys(kept).length !== Object.keys(all).length) write(KEYS.users, kept);
  return kept;
}

const saveUser = (user) => write(KEYS.users, { ...users(), [user.email]: user });

/** The account as the rest of the app sees it: no password fields. */
const publicUser = ({ name, email, createdAt, verifiedAt }) => ({ name, email, createdAt, verifiedAt });

const codeKey = (purpose, email) => `${purpose}:${email}`;

const secondsLeft = (until) => Math.max(1, Math.ceil((until - Date.now()) / 1000));

/** Sends (here: stores and returns) a new code, cancelling any earlier one for the same purpose. */
async function sendCode(email, purpose, extra = {}) {
  const codes = read(KEYS.codes, {});
  const key = codeKey(purpose, email);
  const prev = codes[key];
  const now = Date.now();
  const sent = (prev?.sent ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (prev && now - prev.sent.at(-1) < RESEND_AFTER_MS) {
    const s = secondsLeft(prev.sent.at(-1) + RESEND_AFTER_MS);
    throw new AuthError("resend_too_soon", `You can send a new code in ${s} seconds.`, null, {
      resendAt: prev.sent.at(-1) + RESEND_AFTER_MS,
      devCode: prev.used ? undefined : prev.devCode,
    });
  }
  if (sent.length >= MAX_CODES_PER_HOUR) {
    throw new AuthError("too_many_codes", "We've sent the most codes allowed for an hour. Try again later.");
  }
  const code = newCode();
  const salt = randomHex(16);
  // devCode is kept only by this stand-in, so the window can show it again; the API never stores it.
  codes[key] = { salt, hash: await sha256(salt + code), expiresAt: now + CODE_TTL_MS, tries: 0, sent: [...sent, now], devCode: code, ...extra };
  write(KEYS.codes, codes);
  // Stand-in for the email. The real API sends it and returns only { email, resendAt }.
  return { email, purpose, resendAt: now + RESEND_AFTER_MS, devCode: code };
}

/** Checks a code. `consume` marks it used; otherwise a correct code stays valid for the next step. */
async function checkCode(email, purpose, code, { consume = true } = {}) {
  const codes = read(KEYS.codes, {});
  const key = codeKey(purpose, email);
  const entry = codes[key];
  if (!entry || entry.used) throw new AuthError("code_missing", "Send a new code to try again.", "code");
  if (Date.now() > entry.expiresAt) throw new AuthError("code_expired", "This code has expired. Send a new code.", "code");
  if (entry.tries >= MAX_TRIES) throw new AuthError("code_locked", "Too many incorrect codes. Send a new code to try again.", "code");
  if ((await sha256(entry.salt + code)) !== entry.hash) {
    entry.tries += 1;
    write(KEYS.codes, codes);
    const left = MAX_TRIES - entry.tries;
    if (left <= 0) throw new AuthError("code_locked", "Too many incorrect codes. Send a new code to try again.", "code");
    throw new AuthError(
      "code_wrong",
      `That code doesn't match. Check the email and enter it again. You have ${left} ${left === 1 ? "try" : "tries"} left.`,
      "code",
    );
  }
  if (consume) {
    entry.used = true;
    write(KEYS.codes, codes);
  }
  return entry;
}

async function hashPassword(password, salt = randomHex(16)) {
  return { salt, passwordHash: await sha256(`${salt}:${password}`) };
}

function checkLoginLimit(email) {
  const attempts = read(KEYS.attempts, {});
  const recent = (attempts[email] ?? []).filter((t) => Date.now() - t < LOGIN_WINDOW_MS);
  if (recent.length >= LOGIN_LIMIT) {
    const minutes = Math.ceil((recent[0] + LOGIN_WINDOW_MS - Date.now()) / 60000);
    throw new AuthError("login_locked", `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or reset your password.`);
  }
  return { attempts, recent };
}

/* ---- Endpoints ---- */

/** POST /auth/signup → a code is sent; no session until it's entered. */
export async function signUp({ name, email, password }) {
  const key = normaliseEmail(email);
  const existing = users()[key];
  if (existing?.verifiedAt) throw new AuthError("email_taken", "An account with this email already exists. Log in instead.", "email");
  // A repeat sign-up for an unverified email starts over.
  saveUser({ name: name.trim(), email: key, createdAt: new Date().toISOString(), verifiedAt: null, ...(await hashPassword(password)) });
  const codes = read(KEYS.codes, {});
  delete codes[codeKey("verify_email", key)];
  write(KEYS.codes, codes);
  return sendCode(key, "verify_email");
}

/** POST /auth/login → { user } when signed in, or a code step when the email isn't verified yet. */
export async function logIn({ email, password }) {
  const key = normaliseEmail(email);
  const { attempts, recent } = checkLoginLimit(key);
  const account = users()[key];
  if (account && !account.passwordHash) {
    throw new AuthError("needs_password", "This account doesn't have a password yet. Select Forgot password to create one.");
  }
  const ok = account && (await hashPassword(password, account.salt)).passwordHash === account.passwordHash;
  if (!ok) {
    write(KEYS.attempts, { ...attempts, [key]: [...recent, Date.now()] });
    throw new AuthError("bad_credentials", "Email or password is incorrect.");
  }
  write(KEYS.attempts, { ...attempts, [key]: [] });
  if (!account.verifiedAt) {
    try {
      return { verify: await sendCode(key, "verify_email") };
    } catch (err) {
      // A code sent moments ago still works; go to the code step without a new one.
      if (err.code === "resend_too_soon") return { verify: { email: key, purpose: "verify_email", resendAt: err.resendAt, devCode: err.devCode } };
      throw err;
    }
  }
  return { user: publicUser(account) };
}

/** POST /auth/verify-email → { user }; signs in. */
export async function verifyEmail({ email, code }) {
  const key = normaliseEmail(email);
  await checkCode(key, "verify_email", code);
  const account = users()[key];
  if (!account) throw new AuthError("code_missing", "This sign-up has expired. Sign up again.", "code");
  const verified = { ...account, verifiedAt: new Date().toISOString() };
  saveUser(verified);
  return { user: publicUser(verified) };
}

/** POST /auth/resend-code */
export async function resendCode({ email, purpose }) {
  const key = normaliseEmail(email);
  if (purpose === "change_email") {
    const entry = read(KEYS.codes, {})[codeKey(purpose, key)];
    return sendCode(key, purpose, entry ? { from: entry.from } : {});
  }
  if (!users()[key]) return { email: key, purpose, resendAt: Date.now() + RESEND_AFTER_MS };
  return sendCode(key, purpose);
}

/** POST /auth/forgot-password → the same answer whether or not the account exists. */
export async function requestPasswordReset({ email }) {
  const key = normaliseEmail(email);
  if (!users()[key]) return { email: key, purpose: "reset_password", resendAt: Date.now() + RESEND_AFTER_MS };
  try {
    return await sendCode(key, "reset_password");
  } catch (err) {
    if (err.code === "resend_too_soon") return { email: key, purpose: "reset_password", resendAt: err.resendAt, devCode: err.devCode };
    throw err;
  }
}

/** Checks a reset code before asking for the new password (counts wrong tries, doesn't use it up). */
export async function checkResetCode({ email, code }) {
  await checkCode(normaliseEmail(email), "reset_password", code, { consume: false });
}

/** POST /auth/reset-password → { user }; signs in. Entering the code also proves the email. */
export async function resetPassword({ email, code, password }) {
  const key = normaliseEmail(email);
  await checkCode(key, "reset_password", code);
  const account = users()[key];
  if (!account) throw new AuthError("code_missing", "Send a new code to try again.", "code");
  const updated = { ...account, ...(await hashPassword(password)), verifiedAt: account.verifiedAt ?? new Date().toISOString() };
  saveUser(updated);
  return { user: publicUser(updated) };
}

/** POST /users/me/email → sends a code to the new address. */
export async function requestEmailChange({ currentEmail, newEmail }) {
  const from = normaliseEmail(currentEmail);
  const to = normaliseEmail(newEmail);
  if (to === from) throw new AuthError("same_email", "This is already your email.", "email");
  if (users()[to]?.verifiedAt) throw new AuthError("email_taken", "Another account uses this email. Enter a different one.", "email");
  return sendCode(to, "change_email", { from });
}

/** POST /users/me/email/verify → { user } with the new email. */
export async function confirmEmailChange({ newEmail, code }) {
  const to = normaliseEmail(newEmail);
  const { from } = await checkCode(to, "change_email", code);
  const all = users();
  const account = all[from];
  if (!account) throw new AuthError("code_missing", "Send a new code to try again.", "code");
  const { [from]: _old, ...rest } = all;
  const moved = { ...account, email: to, verifiedAt: new Date().toISOString() };
  write(KEYS.users, { ...rest, [to]: moved });
  return { user: publicUser(moved), previousEmail: from };
}

/** PATCH /users/me */
export async function updateName({ email, name }) {
  const key = normaliseEmail(email);
  const account = users()[key];
  const updated = { ...account, name: name.trim() };
  saveUser(updated);
  return { user: publicUser(updated) };
}

/** DELETE /users/me */
export async function deleteAccount({ email }) {
  const { [normaliseEmail(email)]: _gone, ...rest } = users();
  write(KEYS.users, rest);
}

/** The signed-in account for a stored session email, if it still exists and is verified (or predates verification). */
export function accountFor(email) {
  const account = email ? users()[email] : null;
  if (!account) return null;
  if (account.passwordHash && !account.verifiedAt) return null;
  return publicUser(account);
}
