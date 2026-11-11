"""Small client for the Revenant HTTP API (routes listed in README.md).

Standard library only, so the MCP server and the monitor cron run on the
gateway's Python with nothing to install.

Configuration comes from two environment variables, filled from the Kiro Crew
secrets vault (see README.md, "Setup"):

    REVENANT_URL        base URL of the Revenant install, e.g. https://revenant.example.com
    REVENANT_API_TOKEN  API token issued in Revenant under Settings -> Kiro Crew
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

TIMEOUT_S = 15


class ApiError(Exception):
    """A request Revenant refused or could not answer. The message is safe to show."""


def _setting(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ApiError(f"{name} is not set. See the Revenant app README, section Setup.")
    if value.startswith("secret://"):
        # An app's MCP server gets the literal reference today (Kiro Crew #10641).
        raise ApiError(
            f"{name} reached this process as a vault reference, not a value. "
            "See the Revenant app README, section Setup."
        )
    return value


def call(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    """Send one request to Revenant and return the decoded JSON answer."""
    base = _setting("REVENANT_URL").rstrip("/")
    token = _setting("REVENANT_API_TOKEN")
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            raw = res.read()
    except urllib.error.HTTPError as err:
        raise ApiError(_error_text(err)) from None
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        raise ApiError(f"Revenant is not reachable: {getattr(err, 'reason', err)}") from None
    return json.loads(raw) if raw else None


def _error_text(err: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(err.read() or b"{}")
    except ValueError:
        payload = {}
    code = payload.get("code") or ""
    message = payload.get("error") or err.reason
    link = payload.get("url")
    text = f"Revenant answered {err.code}{' ' + code if code else ''}: {message}"
    return f"{text} ({link})" if link else text


def quote(segment: str) -> str:
    return urllib.parse.quote(segment, safe="")


# Routes. Keep in step with the "Revenant API" table in README.md.

def create_project(request: str) -> Any:
    return call("POST", "/api/crew/projects", {"request": request})


def list_projects() -> Any:
    return call("GET", "/api/crew/projects")


def get_project(project: str) -> Any:
    return call("GET", f"/api/crew/projects/{quote(project)}")


def build(project: str) -> Any:
    return call("POST", f"/api/crew/projects/{quote(project)}/build", {})


def publish(project: str) -> Any:
    return call("POST", f"/api/crew/projects/{quote(project)}/publish", {})


def events(since: str) -> Any:
    query = urllib.parse.urlencode({"since": since}) if since else ""
    return call("GET", "/api/crew/events" + (f"?{query}" if query else ""))
