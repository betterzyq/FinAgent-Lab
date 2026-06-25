"""Agent profile API."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.agents import AgentsListResponse
from backend.services.agent_registry import AGENT_PROFILES

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=AgentsListResponse)
async def list_agents() -> AgentsListResponse:
    """Return static agent configuration for the visualization frontend."""
    return AgentsListResponse(agents=AGENT_PROFILES)
