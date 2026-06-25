"""Bridge frontend requests to TradingAgentsGraph stream execution."""

from __future__ import annotations

import asyncio
import traceback
from typing import Any

from backend import bootstrap  # noqa: F401 — ensure TradingAgents on sys.path
from backend.schemas.events import AgentRunEvent
from backend.schemas.run import RunCreateRequest
from backend.services.agent_registry import STAGE_BY_NODE
from backend.services.event_bus import EventBus
from backend.services.event_emitter import StreamEventTranslator, _event
from backend.services.llm_config import resolve_llm_config
from backend.services.mock_runner import run_mock_pipeline
from backend.services.run_store import RunStore
from backend.utils.logger import get_logger

logger = get_logger(__name__)


def _normalize_symbol(symbol: str) -> str:
    """Normalize bare 6-digit codes to exchange suffix form when possible."""
    from tradingagents.dataflows.akshare_common import parse_ashare_symbol

    try:
        info = parse_ashare_symbol(symbol)
        suffix = "SS" if info.market == "sh" else "SZ"
        return f"{info.code}.{suffix}"
    except Exception:  # noqa: BLE001
        return symbol.strip()


def _resolve_company_name(symbol: str, company_name: str | None) -> str | None:
    if company_name:
        return company_name
    try:
        from tradingagents.agents.utils.agent_utils import resolve_instrument_identity

        identity = resolve_instrument_identity(symbol)
        return identity.get("company_name") or identity.get("name")
    except Exception as exc:  # noqa: BLE001
        logger.debug("Could not resolve company name for %s: %s", symbol, exc)
        return None


def _build_config(request: RunCreateRequest) -> dict[str, Any]:
    """Merge RunCreateRequest into TradingAgents config with LLM auto-detection."""
    config = resolve_llm_config(
        llm_provider=request.llm_provider,
        quick_model=request.quick_model,
        deep_model=request.deep_model,
    )
    depth = request.analysis_depth.lower()
    debate = request.debate_rounds
    risk = request.risk_rounds
    if depth == "quick":
        debate = min(debate, 1)
        risk = min(risk, 1)
    elif depth == "deep":
        debate = max(debate, 3)
        risk = max(risk, 3)

    config["max_debate_rounds"] = debate
    config["max_risk_discuss_rounds"] = risk

    return config


def _parse_final_decision(final_trade_decision: str, decision_string: str | None) -> dict[str, Any]:
    from tradingagents.agents.utils.rating import parse_rating

    rating = parse_rating(final_trade_decision or "")
    return {
        "rating": rating,
        "decision_string": decision_string or rating,
        "raw_markdown": final_trade_decision,
        "summary": _extract_field(final_trade_decision, "Executive Summary"),
        "investment_thesis": _extract_field(final_trade_decision, "Investment Thesis"),
    }


def _extract_field(text: str, label: str) -> str | None:
    prefix = f"**{label}**:"
    for line in (text or "").splitlines():
        if line.strip().startswith(prefix):
            return line.split(":", 1)[-1].strip().strip("*")
    return None


def _finalize_stream_state(
    init_state: dict[str, Any],
    *updates: dict[str, Any],
) -> dict[str, Any]:
    """Merge initial graph state with stream deltas.

    ``stream_mode='updates'`` only emits fields changed by each node, so keys
    like ``company_of_interest`` / ``trade_date`` from ``init_state`` must be
    layered back in before ``_log_state`` (same as ``propagate()`` with invoke).
    """
    final: dict[str, Any] = dict(init_state)
    for patch in updates:
        final.update(patch)
    return final


class TradingAgentsRunner:
    """Orchestrates background TradingAgents runs and publishes visualization events."""

    def __init__(self, run_store: RunStore, event_bus: EventBus) -> None:
        self.run_store = run_store
        self.event_bus = event_bus
        self._tasks: dict[str, asyncio.Task[Any]] = {}

    async def start_run(self, request: RunCreateRequest, *, mock: bool = False) -> str:
        """Create run record and launch background task; returns run_id."""
        run_id = self.run_store.create_run(request, is_mock=mock)
        symbol = _normalize_symbol(request.symbol)
        company = _resolve_company_name(symbol, request.company_name)

        record = self.run_store.get_run(run_id)
        if record:
            record.symbol = symbol
            record.company_name = company

        self.run_store.update_status(run_id, "running", current_stage="coordinator")

        if mock:
            task = asyncio.create_task(
                run_mock_pipeline(run_id, request, self.run_store, self.event_bus),
                name=f"mock-run-{run_id}",
            )
        else:
            task = asyncio.create_task(
                self._run_tradingagents(run_id, request, symbol, company),
                name=f"ta-run-{run_id}",
            )
        self._tasks[run_id] = task
        task.add_done_callback(lambda t: self._tasks.pop(run_id, None))
        return run_id

    async def _run_tradingagents(
        self,
        run_id: str,
        request: RunCreateRequest,
        symbol: str,
        company_name: str | None,
    ) -> None:
        loop = asyncio.get_running_loop()
        try:
            await self.event_bus.publish(
                run_id,
                _event(
                    run_id,
                    "run_started",
                    title="分析任务启动",
                    message=f"{symbol} @ {request.trade_date}",
                    payload={
                        "symbol": symbol,
                        "company_name": company_name,
                        "trade_date": request.trade_date,
                        "market": request.market,
                        "analysis_depth": request.analysis_depth,
                    },
                ),
            )

            final_state, decision_string = await asyncio.to_thread(
                self._execute_graph_stream,
                run_id,
                request,
                symbol,
                loop,
            )

            final_md = str(final_state.get("final_trade_decision", "") or "")
            final_decision = _parse_final_decision(final_md, decision_string)
            self.run_store.set_final_result(run_id, final_decision, final_state=final_state)

            await self.event_bus.publish(
                run_id,
                _event(
                    run_id,
                    "run_finished",
                    title="分析完成",
                    message=decision_string or final_decision.get("rating", ""),
                    payload={
                        "status": "finished",
                        "decision": final_decision,
                        "decision_string": decision_string,
                    },
                ),
            )
            self.run_store.update_status(run_id, "finished", current_stage="done")
        except Exception as exc:  # noqa: BLE001
            logger.exception("Run %s failed", run_id)
            tb = traceback.format_exc()
            self.run_store.update_status(run_id, "failed", error=str(exc))
            await self.event_bus.publish(
                run_id,
                _event(
                    run_id,
                    "run_error",
                    title="分析失败",
                    message=str(exc),
                    payload={"error": str(exc), "traceback": tb},
                ),
            )
        finally:
            await self.event_bus.close_run(run_id)

    def _execute_graph_stream(
        self,
        run_id: str,
        request: RunCreateRequest,
        symbol: str,
        loop: asyncio.AbstractEventLoop,
    ) -> tuple[dict[str, Any], str]:
        """Sync graph.stream loop — runs inside asyncio.to_thread worker."""
        from tradingagents.graph.trading_graph import TradingAgentsGraph

        config = _build_config(request)
        logger.info(
            "Starting run %s with llm_provider=%s quick=%s deep=%s",
            run_id,
            config.get("llm_provider"),
            config.get("quick_think_llm"),
            config.get("deep_think_llm"),
        )
        graph_wrapper = TradingAgentsGraph(
            selected_analysts=["market", "social", "news", "fundamentals"],
            debug=False,
            config=config,
        )

        past_context = graph_wrapper.memory_log.get_past_context(symbol)
        instrument_context = graph_wrapper.resolve_instrument_context(symbol, asset_type="stock")
        init_state = graph_wrapper.propagator.create_initial_state(
            symbol,
            request.trade_date,
            asset_type="stock",
            past_context=past_context,
            instrument_context=instrument_context,
        )
        args = graph_wrapper.propagator.get_graph_args()
        args["stream_mode"] = ["updates"]

        translator = StreamEventTranslator(run_id)
        merged_state: dict[str, Any] = {}

        for chunk in graph_wrapper.graph.stream(init_state, **args):
            # stream_mode=list yields (mode, data) tuples in LangGraph >=0.2
            if isinstance(chunk, tuple) and len(chunk) == 2:
                mode, data = chunk
                if mode == "updates" and isinstance(data, dict):
                    for node_name, delta in data.items():
                        stage = STAGE_BY_NODE.get(node_name)
                        if stage:
                            self.run_store.update_status(run_id, "running", current_stage=stage)
                        events = translator.process_updates(node_name, delta)
                        for event in events:
                            self._publish_sync(run_id, event, loop)
                        merged_state.update(delta)
                elif mode == "values" and isinstance(data, dict):
                    events = translator.process_values(data)
                    for event in events:
                        self._publish_sync(run_id, event, loop)
                    merged_state.update(data)
            elif isinstance(chunk, dict):
                # Fallback: values-only stream returns partial state dicts
                events = translator.process_values(chunk)
                for event in events:
                    self._publish_sync(run_id, event, loop)
                merged_state.update(chunk)

        merged_state.update(translator.merged_state)
        complete_state = _finalize_stream_state(init_state, merged_state)

        # Persist logs same as propagate() without invoking propagate()
        graph_wrapper.curr_state = complete_state
        graph_wrapper.ticker = symbol
        graph_wrapper._log_state(request.trade_date, complete_state)
        graph_wrapper.memory_log.store_decision(
            ticker=symbol,
            trade_date=request.trade_date,
            final_trade_decision=complete_state.get("final_trade_decision", ""),
        )

        decision_string = graph_wrapper.process_signal(
            complete_state.get("final_trade_decision", "")
        )
        return complete_state, decision_string

    def _publish_sync(
        self,
        run_id: str,
        event: AgentRunEvent,
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self.run_store.append_event(run_id, event)

        def _schedule() -> None:
            asyncio.ensure_future(self.event_bus._fan_out(run_id, event))

        loop.call_soon_threadsafe(_schedule)
