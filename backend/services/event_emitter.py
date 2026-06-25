"""Translate LangGraph stream chunks into AgentRunEvent instances."""

from __future__ import annotations

from typing import Any

from backend.schemas.events import AgentRunEvent
from backend.services.agent_registry import (
    NODE_AGENT_MAP,
    REPORT_FIELD_MAP,
    STAGE_BY_NODE,
    AgentMeta,
    is_agent_node,
    meta_for_node,
)
from backend.utils.json_utils import new_event_id, utc_now_iso


def _preview(text: str, max_len: int = 240) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3] + "..."


def _event(
    run_id: str,
    event_type: str,
    *,
    meta: AgentMeta | None = None,
    title: str | None = None,
    message: str | None = None,
    from_agent: str | None = None,
    to_agent: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AgentRunEvent:
    return AgentRunEvent(
        event_id=new_event_id(),
        run_id=run_id,
        timestamp=utc_now_iso(),
        event_type=event_type,  # type: ignore[arg-type]
        agent_id=meta.agent_id if meta else None,
        agent_name=meta.agent_name if meta else None,
        team=meta.team if meta else None,
        from_agent=from_agent,
        to_agent=to_agent,
        title=title,
        message=message,
        payload=payload,
    )


class StreamEventTranslator:
    """Stateful translator: LangGraph updates/values -> visualization events."""

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self._started_nodes: set[str] = set()
        self._finished_nodes: set[str] = set()
        self._seen_reports: set[str] = set()
        self._bull_hist_len = 0
        self._bear_hist_len = 0
        self._agg_hist_len = 0
        self._neu_hist_len = 0
        self._con_hist_len = 0
        self._investment_plan_sent = False
        self._trader_sent = False
        self._pm_sent = False
        self._processed_msg_ids: set[str] = set()
        self._last_active_analyst: str | None = None
        self.merged_state: dict[str, Any] = {}

    def process_updates(self, node_name: str, delta: dict[str, Any]) -> list[AgentRunEvent]:
        """Handle stream_mode='updates' chunks: {node_name: delta}."""
        events: list[AgentRunEvent] = []
        self.merged_state.update(delta)

        if node_name.startswith("tools_"):
            events.extend(self._tool_events(node_name, delta))
            return events

        if is_agent_node(node_name) and node_name not in self._started_nodes:
            meta = meta_for_node(node_name)
            if meta:
                events.append(
                    _event(
                        self.run_id,
                        "agent_started",
                        meta=meta,
                        title=f"{meta.agent_name} 开始工作",
                        message=node_name,
                        payload={"node": node_name, "stage": STAGE_BY_NODE.get(node_name)},
                    )
                )
                self._started_nodes.add(node_name)
                self._last_active_analyst = node_name

        events.extend(self._message_tool_events(delta))
        events.extend(self._report_events(delta))
        events.extend(self._debate_events(delta))
        events.extend(self._risk_events(delta))

        if is_agent_node(node_name) and node_name not in self._finished_nodes:
            events.append(
                _event(
                    self.run_id,
                    "agent_finished",
                    meta=meta_for_node(node_name),
                    title=f"{meta_for_node(node_name).agent_name if meta_for_node(node_name) else node_name} 完成",
                    payload={"node": node_name},
                )
            )
            self._finished_nodes.add(node_name)

        return events

    def process_values(self, state: dict[str, Any]) -> list[AgentRunEvent]:
        """Handle stream_mode='values' full/partial state snapshots."""
        self.merged_state.update(state)
        events: list[AgentRunEvent] = []
        events.extend(self._message_tool_events(state))
        events.extend(self._report_events(state))
        events.extend(self._debate_events(state))
        events.extend(self._risk_events(state))
        return events

    def _tool_events(self, node_name: str, delta: dict[str, Any]) -> list[AgentRunEvent]:
        events: list[AgentRunEvent] = []
        tool_key = node_name.removeprefix("tools_")
        analyst_node = {
            "market": "Market Analyst",
            "social": "Sentiment Analyst",
            "news": "News Analyst",
            "fundamentals": "Fundamentals Analyst",
        }.get(tool_key, self._last_active_analyst or node_name)
        meta = meta_for_node(analyst_node) if analyst_node in NODE_AGENT_MAP else None

        had_tool = False
        for message in delta.get("messages", []) or []:
            tool_calls = getattr(message, "tool_calls", None) or []
            for tool_call in tool_calls:
                had_tool = True
                if isinstance(tool_call, dict):
                    name = tool_call.get("name", "unknown_tool")
                    args = tool_call.get("args", {})
                else:
                    name = getattr(tool_call, "name", "unknown_tool")
                    args = getattr(tool_call, "args", {})
                events.append(
                    _event(
                        self.run_id,
                        "tool_called",
                        meta=meta,
                        title="工具调用",
                        message=name,
                        payload={"tool_name": name, "tool_args": args, "node": node_name},
                    )
                )
        if had_tool:
            events.append(
                _event(
                    self.run_id,
                    "tool_finished",
                    meta=meta,
                    title="工具完成",
                    message=node_name,
                    payload={"node": node_name},
                )
            )
        return events

    def _message_tool_events(self, chunk: dict[str, Any]) -> list[AgentRunEvent]:
        events: list[AgentRunEvent] = []
        for message in chunk.get("messages", []) or []:
            msg_id = getattr(message, "id", None)
            if msg_id is not None:
                if msg_id in self._processed_msg_ids:
                    continue
                self._processed_msg_ids.add(msg_id)

            tool_calls = getattr(message, "tool_calls", None) or []
            for tool_call in tool_calls:
                if isinstance(tool_call, dict):
                    name = tool_call.get("name", "unknown_tool")
                    args = tool_call.get("args", {})
                else:
                    name = getattr(tool_call, "name", "unknown_tool")
                    args = getattr(tool_call, "args", {})
                meta = (
                    meta_for_node(self._last_active_analyst)
                    if self._last_active_analyst
                    else None
                )
                events.append(
                    _event(
                        self.run_id,
                        "tool_called",
                        meta=meta,
                        title="工具调用",
                        message=name,
                        payload={"tool_name": name, "tool_args": args},
                    )
                )
        return events

    def _report_events(self, chunk: dict[str, Any]) -> list[AgentRunEvent]:
        events: list[AgentRunEvent] = []
        for field, (node_name, report_key) in REPORT_FIELD_MAP.items():
            content = chunk.get(field)
            if not content or not str(content).strip():
                continue
            if field in self._seen_reports:
                continue
            self._seen_reports.add(field)
            meta = meta_for_node(node_name)
            events.append(
                _event(
                    self.run_id,
                    "report_ready",
                    meta=meta,
                    title=f"{meta.agent_name if meta else node_name} 报告就绪",
                    message=_preview(str(content)),
                    payload={
                        "report_key": report_key,
                        "content": str(content),
                        "preview": _preview(str(content)),
                    },
                )
            )

            if field == "investment_plan" and not self._investment_plan_sent:
                self._investment_plan_sent = True
                events.append(
                    _event(
                        self.run_id,
                        "debate_finished",
                        meta=meta_for_node("Research Manager"),
                        title="研究经理形成投资计划",
                        message=_preview(str(content)),
                        payload={"investment_plan": str(content)},
                    )
                )
                events.append(
                    _event(
                        self.run_id,
                        "handoff",
                        meta=meta_for_node("Research Manager"),
                        from_agent="research_manager",
                        to_agent="trader",
                        title="投资计划交付交易员",
                        payload={"artifact": "investment_plan"},
                    )
                )

            if field == "trader_investment_plan" and not self._trader_sent:
                self._trader_sent = True
                events.append(
                    _event(
                        self.run_id,
                        "trader_proposal_ready",
                        meta=meta_for_node("Trader"),
                        title="交易员提案就绪",
                        message=_preview(str(content)),
                        payload={"trader_proposal": str(content)},
                    )
                )
                events.append(
                    _event(
                        self.run_id,
                        "handoff",
                        meta=meta_for_node("Trader"),
                        from_agent="trader",
                        to_agent="risk_room",
                        title="交易提案提交风控",
                        payload={"artifact": "trader_proposal"},
                    )
                )

            if field == "final_trade_decision" and not self._pm_sent:
                self._pm_sent = True
                events.append(
                    _event(
                        self.run_id,
                        "pm_decision_ready",
                        meta=meta_for_node("Portfolio Manager"),
                        title="组合经理最终决策",
                        message=_preview(str(content)),
                        payload={"final_decision": str(content)},
                    )
                )
        return events

    def _debate_events(self, chunk: dict[str, Any]) -> list[AgentRunEvent]:
        events: list[AgentRunEvent] = []
        debate = chunk.get("investment_debate_state")
        if not debate:
            return events

        bull = str(debate.get("bull_history", "") or "")
        bear = str(debate.get("bear_history", "") or "")

        if len(bull) > self._bull_hist_len:
            new_part = bull[self._bull_hist_len :].strip()
            self._bull_hist_len = len(bull)
            if new_part:
                events.append(
                    _event(
                        self.run_id,
                        "debate_message",
                        meta=meta_for_node("Bull Researcher"),
                        title="多头观点",
                        message=_preview(new_part),
                        payload={"side": "bull", "content": new_part},
                    )
                )

        if len(bear) > self._bear_hist_len:
            new_part = bear[self._bear_hist_len :].strip()
            self._bear_hist_len = len(bear)
            if new_part:
                events.append(
                    _event(
                        self.run_id,
                        "debate_message",
                        meta=meta_for_node("Bear Researcher"),
                        title="空头观点",
                        message=_preview(new_part),
                        payload={"side": "bear", "content": new_part},
                    )
                )
        return events

    def _risk_events(self, chunk: dict[str, Any]) -> list[AgentRunEvent]:
        events: list[AgentRunEvent] = []
        risk = chunk.get("risk_debate_state")
        if not risk:
            return events

        sides = [
            ("aggressive_history", "Aggressive Analyst", "aggressive", self._agg_hist_len),
            ("neutral_history", "Neutral Analyst", "neutral", self._neu_hist_len),
            ("conservative_history", "Conservative Analyst", "conservative", self._con_hist_len),
        ]

        for field, node, side, prev_len in sides:
            hist = str(risk.get(field, "") or "")
            if len(hist) > prev_len:
                new_part = hist[prev_len:].strip()
                if field == "aggressive_history":
                    self._agg_hist_len = len(hist)
                elif field == "neutral_history":
                    self._neu_hist_len = len(hist)
                else:
                    self._con_hist_len = len(hist)
                if new_part:
                    events.append(
                        _event(
                            self.run_id,
                            "risk_debate_message",
                            meta=meta_for_node(node),
                            title=f"风控观点 ({side})",
                            message=_preview(new_part),
                            payload={"side": side, "content": new_part},
                        )
                    )

        judge = str(risk.get("judge_decision", "") or "").strip()
        if judge and "risk_debate_finished" not in self._seen_reports:
            self._seen_reports.add("risk_debate_finished")
            events.append(
                _event(
                    self.run_id,
                    "risk_debate_finished",
                    meta=meta_for_node("Portfolio Manager"),
                    title="风控辩论结束",
                    message=_preview(judge),
                    payload={"judge_decision": judge},
                )
            )
        return events
