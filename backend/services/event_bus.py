"""Async pub/sub for run-scoped SSE event delivery."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from backend.schemas.events import AgentRunEvent
from backend.services.run_store import RunStore
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class EventBus:
    """Each run_id owns a set of subscriber queues; publish is non-blocking for producers."""

    def __init__(self, run_store: RunStore) -> None:
        self._run_store = run_store
        self._subscribers: dict[str, set[asyncio.Queue[AgentRunEvent | None]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[AgentRunEvent | None]:
        """Register a new SSE consumer queue for a run."""
        queue: asyncio.Queue[AgentRunEvent | None] = asyncio.Queue(maxsize=512)
        async with self._lock:
            self._subscribers[run_id].add(queue)
        return queue

    async def unsubscribe(self, run_id: str, queue: asyncio.Queue[AgentRunEvent | None]) -> None:
        async with self._lock:
            subs = self._subscribers.get(run_id)
            if subs and queue in subs:
                subs.discard(queue)

    async def publish(self, run_id: str, event: AgentRunEvent) -> None:
        """Append to run_store and fan-out to live subscribers."""
        self._run_store.append_event(run_id, event)
        await self._fan_out(run_id, event)

    def publish_sync(self, run_id: str, event: AgentRunEvent, loop: asyncio.AbstractEventLoop) -> None:
        """Thread-safe publish from TradingAgents sync stream loop."""
        self._run_store.append_event(run_id, event)
        loop.call_soon_threadsafe(asyncio.create_task, self._fan_out(run_id, event))

    async def _fan_out(self, run_id: str, event: AgentRunEvent) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(run_id, set()))
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("SSE queue full for run %s; dropping event %s", run_id, event.event_type)

    async def close_run(self, run_id: str) -> None:
        """Signal all subscribers that the stream ended (sentinel None)."""
        async with self._lock:
            queues = list(self._subscribers.get(run_id, set()))
        for queue in queues:
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass
