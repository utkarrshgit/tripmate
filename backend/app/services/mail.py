"""Sends TripMate's emails. MAIL_MODE=console prints them in the API log; smtp sends them (Mailpit for demos).

Every message is also kept in `outbox` (the last 50), which the tests read codes from.
"""

import asyncio
import smtplib
from collections import deque
from email.message import EmailMessage

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("mail")
outbox: deque[dict] = deque(maxlen=50)

_CODE_COPY = {
    "verify_email": ("finish signing up", "If you didn't sign up for TripMate, you can ignore this email."),
    "reset_password": ("reset your password", "If you didn't ask to reset your password, you can ignore this email. Your password hasn't changed."),
    "change_email": ("use this email for your TripMate account", "If you didn't ask to change your email, you can ignore this email."),
}


def _send_smtp(msg: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.send_message(msg)


async def send(to: str, subject: str, body: str) -> None:
    outbox.append({"to": to, "subject": subject, "body": body})
    if settings.mail_mode != "smtp":
        logger.info("Email to %s — %s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.mail_from, to, subject
    msg.set_content(body)
    try:
        await asyncio.to_thread(_send_smtp, msg)
    except OSError as exc:
        # Don't block sign-up when the mail server is down; the code is in the log.
        logger.warning("Couldn't send email to %s (%s). Subject: %s\n%s", to, exc, subject, body)


async def send_code(to: str, code: str, purpose: str) -> None:
    action, ignore = _CODE_COPY[purpose]
    await send(to, f"{code} is your TripMate code", f"Enter this code to {action}: {code}\n\nIt expires in 10 minutes. {ignore}\n")


async def send_email_changed_notice(old_email: str, new_email: str) -> None:
    await send(
        old_email,
        "Your TripMate email was changed",
        f"Your TripMate account now uses {new_email}. If you didn't make this change, reset your password straight away.\n",
    )
