"""Revenant monitor: a no-model Kiro Crew script cron.

Every run it
1. asks Revenant for builds, deploys and repairs that finished since the last
   run (GET /api/crew/events) and sends one Kiro Crew notification per event;
2. stores the project list (GET /api/crew/projects) in the app's config.json,
   which the dashboard page reads through GET /api/apps/revenant/config.

REVENANT_URL and REVENANT_API_TOKEN come from the job's vault secret grant
(README.md, "Setup"). The cursor lives in the app data directory.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import revenant_api as api  # noqa: E402
from kiro_crew.cron_script import Skip  # noqa: E402

APP = "revenant"
WORDS = {
    ("build", "succeeded"): "build finished",
    ("build", "failed"): "build failed",
    ("deploy", "succeeded"): "is live",
    ("deploy", "failed"): "deploy failed",
    ("repair", "recovered"): "was repaired and is back",
    ("repair", "gave_up"): "could not be repaired after 3 tries",
}


def _data_dir() -> Path:
    home = Path(os.environ.get("KIROCREW_HOME") or "~/.kiro/crew").expanduser()
    path = home / "apps" / APP / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def _write(path: Path, value: dict[str, Any]) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _line(event: dict[str, Any]) -> str:
    name = event.get("projectName") or event.get("projectId") or "A project"
    kind = event.get("kind", "")
    outcome = event.get("outcome", "")
    words = WORDS.get((kind, outcome), f"{kind} {outcome}".strip())
    text = f"Revenant: {name} {words}."
    if event.get("detail"):
        text += f" {event['detail']}"
    if event.get("url"):
        text += f" {event['url']}"
    return text


def run(ctx: Any) -> None:
    data = _data_dir()
    state_path = data / "monitor.json"
    config_path = data / "config.json"
    state = _read(state_path)
    now = datetime.now(timezone.utc).isoformat()

    try:
        answer = api.events(state.get("cursor", ""))
        projects = api.list_projects()
    except api.ApiError as err:
        config = _read(config_path)
        config["error"] = str(err)
        config["checkedAt"] = now
        _write(config_path, config)
        raise Skip() from None

    first_run = "cursor" not in state
    for event in (answer or {}).get("events", []):
        if not first_run:  # the first run only sets the cursor, so old news is not replayed
            ctx.notify(_line(event))
    state["cursor"] = (answer or {}).get("cursor") or now
    _write(state_path, state)

    config = _read(config_path)
    config.pop("error", None)
    config["projects"] = (projects or {}).get("projects", [])
    config["checkedAt"] = now
    _write(config_path, config)
    raise Skip()
