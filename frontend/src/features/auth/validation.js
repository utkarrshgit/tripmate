const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns { field: message } for each invalid field; empty object when valid. */
export function validateAccount({ name, email }, { requireName = true } = {}) {
  const errors = {};
  if (requireName && !name?.trim()) errors.name = "Enter your name.";
  if (!EMAIL_RE.test(email?.trim() ?? "")) errors.email = "Enter a valid email address.";
  return errors;
}
