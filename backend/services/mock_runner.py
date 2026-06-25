"""Mock event stream for frontend development without LLM/API keys."""

from __future__ import annotations

import asyncio
from typing import Any

from backend.schemas.events import AgentRunEvent
from backend.schemas.run import RunCreateRequest
from backend.services.agent_registry import meta_for_node
from backend.services.event_bus import EventBus
from backend.services.event_emitter import _event
from backend.services.run_store import RunStore
from backend.utils.logger import get_logger

logger = get_logger(__name__)

_MOCK_REPORTS: dict[str, str] = {
    "market_report": "【模拟】600519 日线呈多头排列，MACD 金叉，成交量温和放大。",
    "fundamentals_report": "【模拟】贵州茅台 ROE 稳定，现金流充沛，估值处于历史中位。",
    "sentiment_report": "【模拟】舆情偏正面，机构研报维持买入评级。",
    "news_report": "【模拟】消费复苏政策利好高端白酒，行业监管趋稳。",
    "investment_plan": "【模拟】**Recommendation**: Overweight\n\n**Rationale**: 多头逻辑占优。",
    "trader_proposal": "【模拟】**Action**: Buy\n\n**Reasoning**: 符合投资计划方向。",
    "final_decision": (
        "【模拟】**Rating**: Overweight\n\n"
        "**Executive Summary**: 建议适度增持，控制仓位，设置止损。\n\n"
        "**Investment Thesis**: 基本面与情绪面共振，风险可控。"
    ),
}


async def run_mock_pipeline(
    run_id: str,
    request: RunCreateRequest,
    run_store: RunStore,
    event_bus: EventBus,
    *,
    interval: float = 0.6,
) -> None:
    """Push a scripted sequence of visualization events."""
    run_store.update_status(run_id, "running", current_stage="coordinator")

    async def emit(event: AgentRunEvent) -> None:
        await event_bus.publish(run_id, event)
        stage = (event.payload or {}).get("stage")
        if stage:
            run_store.update_status(run_id, "running", current_stage=stage)
        elif event.event_type == "run_finished":
            run_store.update_status(run_id, "finished", current_stage="done")

    try:
        await emit(
            _event(
                run_id,
                "run_started",
                meta=None,
                title="分析任务启动",
                message=f"{request.symbol} @ {request.trade_date}",
                payload={
                    "symbol": request.symbol,
                    "company_name": request.company_name,
                    "trade_date": request.trade_date,
                    "market": request.market,
                    "mock": True,
                },
            )
        )
        await asyncio.sleep(interval)

        analyst_sequence = [
            ("Market Analyst", "market_report", "market_analyst"),
            ("Fundamentals Analyst", "fundamentals_report", "fundamentals_analyst"),
            ("Sentiment Analyst", "sentiment_report", "sentiment_analyst"),
            ("News Analyst", "news_report", "news_analyst"),
        ]

        for node, report_key, _ in analyst_sequence:
            meta = meta_for_node(node)
            await emit(
                _event(
                    run_id,
                    "agent_started",
                    meta=meta,
                    title=f"{meta.agent_name if meta else node} 开始工作",
                    payload={"node": node, "stage": "analyst"},
                )
            )
            await asyncio.sleep(interval * 0.5)
            await emit(
                _event(
                    run_id,
                    "tool_called",
                    meta=meta,
                    message="get_stock_data",
                    payload={"tool_name": "get_stock_data", "mock": True},
                )
            )
            await asyncio.sleep(interval * 0.5)
            content = _MOCK_REPORTS[report_key]
            await emit(
                _event(
                    run_id,
                    "report_ready",
                    meta=meta,
                    message=content[:120],
                    payload={"report_key": report_key, "content": content},
                )
            )
            await emit(
                _event(
                    run_id,
                    "agent_finished",
                    meta=meta,
                    payload={"node": node},
                )
            )
            await asyncio.sleep(interval)

        await emit(
            _event(
                run_id,
                "debate_message",
                meta=meta_for_node("Bull Researcher"),
                title="多头观点",
                message="【模拟】高端消费复苏，品牌护城河深，长期成长确定。",
                payload={"side": "bull"},
            )
        )
        await asyncio.sleep(interval)
        await emit(
            _event(
                run_id,
                "debate_message",
                meta=meta_for_node("Bear Researcher"),
                title="空头观点",
                message="【模拟】估值偏高，宏观消费复苏节奏存在不确定性。",
                payload={"side": "bear"},
            )
        )
        await asyncio.sleep(interval)

        rm_meta = meta_for_node("Research Manager")
        plan = _MOCK_REPORTS["investment_plan"]
        await emit(
            _event(
                run_id,
                "debate_finished",
                meta=rm_meta,
                message=plan,
                payload={"investment_plan": plan},
            )
        )
        await emit(
            _event(
                run_id,
                "handoff",
                meta=rm_meta,
                from_agent="research_manager",
                to_agent="trader",
                payload={"artifact": "investment_plan"},
            )
        )
        await asyncio.sleep(interval)

        trader_meta = meta_for_node("Trader")
        proposal = _MOCK_REPORTS["trader_proposal"]
        await emit(
            _event(
                run_id,
                "trader_proposal_ready",
                meta=trader_meta,
                message=proposal,
                payload={"trader_proposal": proposal},
            )
        )
        await asyncio.sleep(interval)

        for node, side in [
            ("Aggressive Analyst", "aggressive"),
            ("Neutral Analyst", "neutral"),
            ("Conservative Analyst", "conservative"),
        ]:
            await emit(
                _event(
                    run_id,
                    "risk_debate_message",
                    meta=meta_for_node(node),
                    message=f"【模拟】{side} 风控观点：请结合仓位与波动率评估。",
                    payload={"side": side},
                )
            )
            await asyncio.sleep(interval * 0.7)

        await emit(
            _event(
                run_id,
                "risk_debate_finished",
                meta=meta_for_node("Portfolio Manager"),
                message="【模拟】风控辩论结束",
            )
        )
        await asyncio.sleep(interval)

        pm_meta = meta_for_node("Portfolio Manager")
        decision_md = _MOCK_REPORTS["final_decision"]
        await emit(
            _event(
                run_id,
                "pm_decision_ready",
                meta=pm_meta,
                message=decision_md,
                payload={"final_decision": decision_md},
            )
        )

        final_decision: dict[str, Any] = {
            "rating": "Overweight",
            "action": "Buy",
            "confidence": "medium",
            "summary": "【模拟】建议适度增持，注意估值与宏观节奏。",
            "raw_markdown": decision_md,
            "mock": True,
        }
        run_store.set_final_result(run_id, final_decision)

        await emit(
            _event(
                run_id,
                "run_finished",
                title="分析完成",
                message="Mock run completed",
                payload={"status": "finished", "decision": final_decision},
            )
        )
        run_store.update_status(run_id, "finished", current_stage="done")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Mock run %s failed", run_id)
        run_store.update_status(run_id, "failed", error=str(exc))
        await event_bus.publish(
            run_id,
            _event(
                run_id,
                "run_error",
                title="Mock 运行失败",
                message=str(exc),
                payload={"error": str(exc)},
            ),
        )
    finally:
        await event_bus.close_run(run_id)
