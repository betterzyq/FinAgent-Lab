"""In-memory run state and event timeline storage (MVP)."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from backend.schemas.events import AgentRunEvent
from backend.schemas.run import RunCreateRequest, RunStatusResponse
from backend.utils.json_utils import utc_now_iso


@dataclass
class RunRecord:
    run_id: str
    request: RunCreateRequest
    status: str = "created"
    symbol: str = ""
    company_name: str | None = None
    trade_date: str = ""
    started_at: str | None = None
    finished_at: str | None = None
    current_stage: str | None = None
    final_decision: dict[str, Any] | None = None
    final_state: dict[str, Any] | None = None
    error: str | None = None
    events: list[AgentRunEvent] = field(default_factory=list)
    is_mock: bool = False


class RunStore:
    """Thread-safe in-memory store for analysis runs."""

    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._lock = threading.Lock()

    def create_run(self, request: RunCreateRequest, *, is_mock: bool = False) -> str:
        run_id = f"run_{uuid4().hex[:12]}"
        record = RunRecord(
            run_id=run_id,
            request=request,
            symbol=request.symbol,
            company_name=request.company_name,
            trade_date=request.trade_date,
            is_mock=is_mock,
        )
        with self._lock:
            self._runs[run_id] = record
        return run_id

    def update_status(
        self,
        run_id: str,
        status: str,
        *,
        current_stage: str | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if not record:
                return
            record.status = status
            if current_stage is not None:
                record.current_stage = current_stage
            if error is not None:
                record.error = error
            if status == "running" and record.started_at is None:
                record.started_at = utc_now_iso()
            if status in ("finished", "failed", "cancelled"):
                record.finished_at = utc_now_iso()

    def append_event(self, run_id: str, event: AgentRunEvent) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record:
                record.events.append(event)

    def set_final_result(
        self,
        run_id: str,
        result: dict[str, Any],
        *,
        final_state: dict[str, Any] | None = None,
    ) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record:
                record.final_decision = result
                if final_state is not None:
                    record.final_state = final_state

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def get_events(self, run_id: str) -> list[AgentRunEvent]:
        with self._lock:
            record = self._runs.get(run_id)
            return list(record.events) if record else []

    def to_status_response(self, run_id: str) -> RunStatusResponse | None:
        record = self.get_run(run_id)
        if not record:
            return None
        return RunStatusResponse(
            run_id=record.run_id,
            status=record.status,  # type: ignore[arg-type]
            symbol=record.symbol,
            company_name=record.company_name,
            trade_date=record.trade_date,
            started_at=record.started_at,
            finished_at=record.finished_at,
            current_stage=record.current_stage,
            final_decision=record.final_decision,
            error=record.error,
        )
