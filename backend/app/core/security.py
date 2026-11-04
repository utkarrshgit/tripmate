"""Passwords, session tokens and 6-digit email codes. Only hashes are ever stored."""

import hashlib
import hmac
import secrets

from pwdlib import PasswordHash

from app.core.config import settings

_passwords = PasswordHash.recommended()  # Argon2id
# A real hash to check against when an email has no account, so log-in takes the same time either way.
_DUMMY_HASH = _passwords.hash("not-a-real-password")

CODE_LENGTH = 6
PASSWORD_MIN = 8
# A few of the most common passwords; the same list as the website.
_COMMON = {"password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "11111111", "iloveyou", "tripmate", "letmein1"}


def hash_password(password: str) -> str:
    return _passwords.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        _passwords.verify(password, _DUMMY_HASH)
        return False
    return _passwords.verify(password, password_hash)


def password_problem(password: str, email: str = "") -> str | None:
    """The website's wording for a password that can't be used, or None if it's fine."""
    if len(password) < PASSWORD_MIN:
        return f"Use at least {PASSWORD_MIN} characters."
    if password.lower() in _COMMON:
        return "This password is too common. Choose a different one."
    if email and password.lower() == email.strip().lower():
        return "Don't use your email as your password."
    return None


def new_token() -> str:
    """A random 256-bit token for a session cookie or share link."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"


def hash_code(code: str, purpose: str, sent_to: str) -> str:
    """HMAC with OTP_SECRET: a plain hash of six digits could be reversed by trying all million."""
    message = f"{purpose}:{sent_to.lower()}:{code}".encode()
    return hmac.new(settings.otp_secret.encode(), message, hashlib.sha256).hexdigest()


def same(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
