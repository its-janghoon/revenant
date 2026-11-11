"""Revenant MCP server for Kiro Crew (stdio, newline-delimited JSON-RPC 2.0).

Tools: create_project, build, publish, status. Each one is a single call to the
Revenant HTTP API through ../revenant_api.py. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import revenant_api as api  # noqa: E402

PROTOCOL = "2025-06-18"
PROJECT = {
    "type": "object",
    "properties": {
        "project": {
            "type": "string",
            "maxLength": 200,
            "description": "Project id or name, as returned by create_project or status.",
        }
    },
    "required": ["project"],
    "additionalProperties": False,
}

TOOLS: list[dict[str, Any]] = [
    {
        "name": "create_project",
        "description": (
            "Start a new Revenant app from a plain request such as 'build me a contract "
            "signing site'. Revenant creates the project and a Kiro agent writes the spec "
            "(requirements, design, tasks). Returns the project id, its status and specUrl. "
            "Give the user the specUrl. Does not build anything yet."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "request": {
                    "type": "string",
                    "maxLength": 4000,
                    "description": "What the user wants built, in their own words.",
                }
            },
            "required": ["request"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    {
        "name": "build",
        "description": (
            "Build the project from its current spec into a preview on the user's AWS "
            "account. Starts a build run and returns at once with the run id and the "
            "preview link when known. The Revenant monitor reports when it finishes."
        ),
        "inputSchema": PROJECT,
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    {
        "name": "publish",
        "description": (
            "Publish the project's tested preview to production. Revenant snapshots the "
            "production data first. If the change needs approval (a destructive "
            "migration or resource change), Revenant refuses with approval_required and "
            "a link; pass that link to the user instead of retrying."
        ),
        "inputSchema": PROJECT,
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    {
        "name": "status",
        "description": (
            "Read one project's state: status, task progress, the last build, deploy and "
            "repair, links (spec, preview, production) and cost. Read only."
        ),
        "inputSchema": PROJECT,
        "annotations": {"readOnlyHint": True},
    },
]

HANDLERS: dict[str, Callable[[dict[str, Any]], Any]] = {
    "create_project": lambda a: api.create_project(_text(a, "request")),
    "build": lambda a: api.build(_text(a, "project")),
    "publish": lambda a: api.publish(_text(a, "project")),
    "status": lambda a: api.get_project(_text(a, "project")),
}


def _text(args: dict[str, Any], key: str) -> str:
    value = args.get(key)
    if not isinstance(value, str) or not value.strip():
        raise api.ApiError(f"'{key}' is required.")
    return value.strip()


def _call_tool(params: dict[str, Any]) -> dict[str, Any]:
    name = params.get("name")
    handler = HANDLERS.get(name) if isinstance(name, str) else None
    if handler is None:
        return _tool_error(f"Unknown tool: {name}")
    args = params.get("arguments") or {}
    if not isinstance(args, dict):
        return _tool_error("arguments must be an object.")
    try:
        result = handler(args)
    except api.ApiError as err:
        return _tool_error(str(err))
    text = json.dumps(result, indent=2, ensure_ascii=False)
    out: dict[str, Any] = {"content": [{"type": "text", "text": text}]}
    if isinstance(result, dict):
        out["structuredContent"] = result
    return out


def _tool_error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "isError": True}


def handle(msg: dict[str, Any]) -> dict[str, Any] | None:
    method = msg.get("method")
    params = msg.get("params") or {}
    if method == "initialize":
        result: Any = {
            "protocolVersion": params.get("protocolVersion") or PROTOCOL,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "revenant", "version": "0.1.0"},
        }
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        result = _call_tool(params)
    elif method == "ping":
        result = {}
    elif "id" not in msg:
        return None  # notification (initialized, cancelled): nothing to answer
    else:
        return {
            "jsonrpc": "2.0",
            "id": msg["id"],
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }
    if "id" not in msg:
        return None
    return {"jsonrpc": "2.0", "id": msg["id"], "result": result}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            reply: dict[str, Any] | None = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error"},
            }
        else:
            reply = handle(msg) if isinstance(msg, dict) else None
        if reply is not None:
            sys.stdout.write(json.dumps(reply) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
