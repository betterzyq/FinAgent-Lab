"""Analysis run lifecycle API (create, status, SSE events, timeline)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from backend.schemas.events import AgentRunEvent
from backend.schemas.run import RunCreateRequest, RunCreateResponse, RunStatusResponse
from backend.services.tradingagents_runner import TradingAgentsRunner
from backend.utils.json_utils import dumps_event

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _get_runner(request: Request) -> TradingAgentsRunner:
    return request.app.state.runner


@router.post("", response_model=RunCreateResponse)
async def create_run(
    body: RunCreateRequest,
    request: Request,
    mock: bool = Query(False, description="Push mock events without calling TradingAgents"),
) -> RunCreateResponse:
    """Create an analysis run and execute it in the background."""
    runner = _get_runner(request)
    run_id = await runner.start_run(body, mock=mock)
    return RunCreateResponse(
        run_id=run_id,
        status="running",
        message="Mock run started" if mock else "Analysis run started",
    )


@router.get("/{run_id}", response_model=RunStatusResponse)
async def get_run_status(run_id: str, request: Request) -> RunStatusResponse:
    """Return current status and final decision for a run."""
    run_store = request.app.state.run_store
    status = run_store.to_status_response(run_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return status


@router.get("/{run_id}/timeline")
async def get_run_timeline(run_id: str, request: Request) -> dict:
    """Return all persisted events for a run."""
    run_store = request.app.state.run_store
    if not run_store.get_run(run_id):
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    events = run_store.get_events(run_id)
    return {"run_id": run_id, "events": [e.model_dump() for e in events]}


@router.get("/{run_id}/events")
async def stream_run_events(run_id: str, request: Request) -> StreamingResponse:
    """Server-Sent Events stream of agent run events."""
    run_store = request.app.state.run_store
    event_bus = request.app.state.event_bus

    if not run_store.get_run(run_id):
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    async def event_generator():
        # Replay persisted events first (late subscribers / reconnect).
        for past in run_store.get_events(run_id):
            yield _sse_line(past)

        record = run_store.get_run(run_id)
        if record and record.status in ("finished", "failed", "cancelled"):
            return

        queue = await event_bus.subscribe(run_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
                    continue

                if event is None:
                    break

                yield _sse_line(event)
                if event.event_type in ("run_finished", "run_error"):
                    break
        finally:
            await event_bus.unsubscribe(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_line(event: AgentRunEvent) -> str:
    return f"data: {dumps_event(event.model_dump())}\n\n"
