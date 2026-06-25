"""FastAPI entrypoint for FinAgent-Lab visualization backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import bootstrap  # noqa: F401 — loads .env + TradingAgents sys.path first

from backend.api.agents import router as agents_router
from backend.api.runs import router as runs_router
from backend.api.symbols import router as symbols_router
from backend.services.event_bus import EventBus
from backend.services.run_store import RunStore
from backend.services.tradingagents_runner import TradingAgentsRunner
from backend.services.llm_config import get_resolved_llm_summary
from backend.utils.logger import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    run_store = RunStore()
    event_bus = EventBus(run_store)
    runner = TradingAgentsRunner(run_store, event_bus)
    app.state.run_store = run_store
    app.state.event_bus = event_bus
    app.state.runner = runner
    yield


app = FastAPI(
    title="FinAgent-Lab API",
    description="SSE event stream and run status for the A-share multi-agent trading floor.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8090",
        "http://127.0.0.1:8090",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs_router)
app.include_router(agents_router)
app.include_router(symbols_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    summary = get_resolved_llm_summary()
    return {"status": "ok", "api_version": "0.1.1", **summary}


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "FinAgent-Lab API",
        "docs": "/docs",
        "health": "/api/health",
    }
