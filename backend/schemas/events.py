"""Unified agent run event schema for SSE streaming."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "run_started",
    "agent_started",
    "agent_finished",
    "tool_called",
    "tool_finished",
    "report_ready",
    "handoff",
    "debate_message",
    "debate_finished",
    "risk_debate_message",
    "risk_debate_finished",
    "trader_proposal_ready",
    "pm_decision_ready",
    "run_finished",
    "run_error",
]


class AgentRunEvent(BaseModel):
    """Single event pushed to frontend via SSE."""

    event_id: str
    run_id: str
    timestamp: str
    event_type: EventType
    agent_id: str | None = None
    agent_name: str | None = None
    team: str | None = None
    from_agent: str | None = None
    to_agent: str | None = None
    title: str | None = None
    message: str | None = None
    payload: dict[str, Any] | None = None
