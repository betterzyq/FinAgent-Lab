"""Static agent profiles exposed to the frontend."""

from __future__ import annotations

from pydantic import BaseModel


class AgentProfile(BaseModel):
    id: str
    name: str
    team: str
    title: str
    description: str
    skills: list[str]
    color: str
    default_status: str = "idle"


class AgentsListResponse(BaseModel):
    agents: list[AgentProfile]
