"""One error shape for every endpoint: {"error": {"code", "message", "field", ...}}.

Messages are written to be shown on the website as they are.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, field: str | None = None, **extra):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.field = field
        self.extra = extra

    def body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message, "field": self.field, **self.extra}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(exc.body(), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, exc: RequestValidationError):
        fields = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            fields[".".join(loc) or "request"] = err.get("msg", "Invalid value.")
        first = next(iter(fields), None)
        return JSONResponse(
            {"error": {"code": "invalid", "message": "Check the highlighted fields.", "field": first, "fields": fields}},
            status_code=422,
        )


# ---- The last line of defence ----------------------------------------------------

def _is_database_down(exc: BaseException) -> bool:
    """Connection problems with PostgreSQL (not mistakes in a query)."""
    from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
    from sqlalchemy.exc import TimeoutError as PoolTimeout

    import socket

    # ConnectionError covers a refused or dropped connection; gaierror a database host that doesn't resolve.
    if isinstance(exc, (OperationalError, InterfaceError, PoolTimeout, ConnectionError, socket.gaierror)):
        return True
    if isinstance(exc, DBAPIError) and exc.connection_invalidated:
        return True
    name = type(exc).__name__
    return name in {"CannotConnectNowError", "ConnectionDoesNotExistError", "InvalidCatalogNameError", "TooManyConnectionsError"}


def error_for(exc: BaseException) -> tuple[int, dict]:
    if _is_database_down(exc):
        return 503, {
            "error": {
                "code": "database_unavailable",
                "message": "Accounts and saved trips aren't available right now. You can still plan trips. Try again in a minute.",
                "field": None,
            }
        }
    return 500, {"error": {"code": "server_error", "message": "Something went wrong on our side. Try again.", "field": None}}


class CatchAllMiddleware:
    """Turns any unhandled error into the usual JSON error, so the website always gets a message it can show.

    It sits inside the CORS middleware, so even these responses carry CORS headers (the browser
    would otherwise report a network error and hide the message). Errors after a response has
    started (a stream already sending) can't be changed; they're logged.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001 - this is the catch-all
            from app.core.logger import get_logger

            get_logger("errors").exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if started:
                return
            status, body = error_for(exc)
            await JSONResponse(body, status_code=status)(scope, receive, send)
