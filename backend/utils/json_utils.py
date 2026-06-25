"""JSON helpers for SSE payloads."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import uuid4


def new_event_id() -> str:
    return str(uuid4())


def utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def dumps_event(data: dict[str, Any]) -> str:
    """Serialize event dict to a single-line JSON string for SSE."""
    return json.dumps(data, ensure_ascii=False, default=str)
