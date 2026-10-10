const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;

// A few of the most common passwords; the backend will check a longer list.
const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "11111111", "iloveyou", "tripmate", "letmein1"]);

export const validateName = (name) => (name?.trim() ? null : "Enter your name.");

export const validateEmail = (email) => (EMAIL_RE.test(email?.trim() ?? "") ? null : "Enter an email address, like name@example.com.");

/** A new password. `email` stops people using their own email as the password. */
export function validateNewPassword(password = "", email = "") {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (COMMON.has(password.toLowerCase())) return "This password is too common. Choose a different one.";
  if (email && password.toLowerCase() === email.trim().toLowerCase()) return "Don't use your email as your password.";
  return null;
}

/** Returns { field: message } for each invalid field; empty object when valid. */
export function validateAccount({ name, email, password }, { requireName = true, requirePassword = false, newPassword = false } = {}) {
  const errors = {};
  if (requireName && validateName(name)) errors.name = validateName(name);
  if (validateEmail(email)) errors.email = validateEmail(email);
  if (newPassword) {
    const message = validateNewPassword(password, email);
    if (message) errors.password = message;
  } else if (requirePassword && !password) {
    errors.password = "Enter your password.";
  }
  return errors;
}
