"""Pydantic schemas for analysis run lifecycle."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class RunCreateRequest(BaseModel):
    """Request body for POST /api/runs."""

    symbol: str = Field(..., description="A-share ticker, e.g. 600519 or 600519.SS")
    company_name: str | None = Field(None, description="Optional display name")
    market: str = Field("A股", description="Market label for UI")
    trade_date: str = Field(..., description="Analysis date YYYY-MM-DD")
    analysis_depth: str = Field(
        "standard",
        description="quick | standard | deep — maps to debate/risk rounds and models",
    )
    debate_rounds: int = Field(2, ge=1, le=5)
    risk_rounds: int = Field(2, ge=1, le=5)
    llm_provider: str | None = None
    quick_model: str | None = None
    deep_model: str | None = None


class RunCreateResponse(BaseModel):
    """Immediate response after creating a run."""

    run_id: str
    status: Literal["created", "running", "failed"]
    message: str


class RunStatusResponse(BaseModel):
    """Full run status for GET /api/runs/{run_id}."""

    run_id: str
    status: Literal["created", "running", "finished", "failed", "cancelled"]
    symbol: str
    company_name: str | None
    trade_date: str
    started_at: str | None
    finished_at: str | None
    current_stage: str | None
    final_decision: dict[str, Any] | None
    error: str | None
