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
