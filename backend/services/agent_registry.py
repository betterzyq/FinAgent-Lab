"""LangGraph node names mapped to frontend agent metadata."""

from __future__ import annotations

from dataclasses import dataclass

from backend.schemas.agents import AgentProfile


@dataclass(frozen=True)
class AgentMeta:
    agent_id: str
    agent_name: str
    team: str


# LangGraph node name -> visualization metadata
NODE_AGENT_MAP: dict[str, AgentMeta] = {
    "Market Analyst": AgentMeta("market_analyst", "行情技术分析师", "analyst"),
    "Fundamentals Analyst": AgentMeta("fundamentals_analyst", "基本面分析师", "analyst"),
    "Sentiment Analyst": AgentMeta("sentiment_analyst", "舆情情绪分析师", "analyst"),
    "News Analyst": AgentMeta("news_analyst", "新闻政策分析师", "analyst"),
    "Bull Researcher": AgentMeta("bullish_researcher", "多头研究员", "researcher"),
    "Bear Researcher": AgentMeta("bearish_researcher", "空头研究员", "researcher"),
    "Research Manager": AgentMeta("research_manager", "研究经理", "researcher"),
    "Trader": AgentMeta("trader", "交易员", "trader"),
    "Aggressive Analyst": AgentMeta("aggressive_risk", "进攻型风控", "risk"),
    "Neutral Analyst": AgentMeta("neutral_risk", "中性风控", "risk"),
    "Conservative Analyst": AgentMeta("conservative_risk", "保守型风控", "risk"),
    "Portfolio Manager": AgentMeta("portfolio_manager", "组合经理", "pm"),
}

# Report field -> (agent node name, report label)
REPORT_FIELD_MAP: dict[str, tuple[str, str]] = {
    "market_report": ("Market Analyst", "market_report"),
    "fundamentals_report": ("Fundamentals Analyst", "fundamentals_report"),
    "sentiment_report": ("Sentiment Analyst", "sentiment_report"),
    "news_report": ("News Analyst", "news_report"),
    "investment_plan": ("Research Manager", "investment_plan"),
    "trader_investment_plan": ("Trader", "trader_investment_plan"),
    "final_trade_decision": ("Portfolio Manager", "final_trade_decision"),
}

TOOL_NODE_PREFIX = "tools_"
MSG_CLEAR_PREFIX = "Msg Clear"

# Stage labels for RunStore.current_stage
STAGE_BY_NODE: dict[str, str] = {
    "Market Analyst": "analyst",
    "Fundamentals Analyst": "analyst",
    "Sentiment Analyst": "analyst",
    "News Analyst": "analyst",
    "Bull Researcher": "research_debate",
    "Bear Researcher": "research_debate",
    "Research Manager": "research_summary",
    "Trader": "trader",
    "Aggressive Analyst": "risk_debate",
    "Neutral Analyst": "risk_debate",
    "Conservative Analyst": "risk_debate",
    "Portfolio Manager": "pm_decision",
}

COORDINATOR_PROFILE = AgentProfile(
    id="coordinator",
    name="任务协调官",
    team="coordinator",
    title="Chief Agent",
    description="接收用户任务，协调各 Agent 执行",
    skills=["任务分发", "流程编排", "进度监控"],
    color="#9B59B6",
    default_status="idle",
)

AGENT_PROFILES: list[AgentProfile] = [
    COORDINATOR_PROFILE,
    AgentProfile(
        id="market_analyst",
        name="行情技术分析师",
        team="analyst",
        title="Market Analyst",
        description="读取 A 股行情、K 线、成交量、技术指标",
        skills=["行情数据", "技术指标", "趋势分析"],
        color="#3498DB",
    ),
    AgentProfile(
        id="fundamentals_analyst",
        name="基本面分析师",
        team="analyst",
        title="Fundamentals Analyst",
        description="读取财务数据、估值、盈利能力、资产负债、现金流",
        skills=["财报分析", "估值", "现金流"],
        color="#2ECC71",
    ),
    AgentProfile(
        id="sentiment_analyst",
        name="舆情情绪分析师",
        team="analyst",
        title="Sentiment Analyst",
        description="读取新闻、社媒、股吧、情绪热度",
        skills=["舆情监控", "情绪评分", "社媒分析"],
        color="#E67E22",
    ),
    AgentProfile(
        id="news_analyst",
        name="新闻政策分析师",
        team="analyst",
        title="News / Policy Analyst",
        description="读取宏观政策、行业新闻、公告事件",
        skills=["宏观政策", "行业新闻", "公告解读"],
        color="#1ABC9C",
    ),
    AgentProfile(
        id="bullish_researcher",
        name="多头研究员",
        team="researcher",
        title="Bullish Researcher",
        description="提出买入逻辑、增长机会和正面因素",
        skills=["多头论证", "增长逻辑", "机会挖掘"],
        color="#E74C3C",
    ),
    AgentProfile(
        id="bearish_researcher",
        name="空头研究员",
        team="researcher",
        title="Bearish Researcher",
        description="提出下行风险、估值压力和负面因素",
        skills=["风险识别", "估值压力", "空头论证"],
        color="#27AE60",
    ),
    AgentProfile(
        id="research_manager",
        name="研究经理",
        team="researcher",
        title="Research Manager",
        description="总结多空辩论并形成投资计划",
        skills=["辩论总结", "投资计划", "研究协调"],
        color="#1A5276",
    ),
    AgentProfile(
        id="trader",
        name="交易员",
        team="trader",
        title="Trader",
        description="根据投资计划生成交易提案",
        skills=["交易提案", "仓位建议", "执行策略"],
        color="#F1C40F",
    ),
    AgentProfile(
        id="aggressive_risk",
        name="进攻型风控",
        team="risk",
        title="Aggressive Risk",
        description="从机会收益角度评估风险",
        skills=["进攻配置", "机会评估", "收益导向"],
        color="#E55039",
    ),
    AgentProfile(
        id="neutral_risk",
        name="中性风控",
        team="risk",
        title="Neutral Risk",
        description="平衡风险与收益",
        skills=["风险平衡", "中性评估", "组合约束"],
        color="#8395A7",
    ),
    AgentProfile(
        id="conservative_risk",
        name="保守型风控",
        team="risk",
        title="Conservative Risk",
        description="强调回撤、黑天鹅、政策和流动性风险",
        skills=["回撤控制", "黑天鹅", "合规审查"],
        color="#186A3B",
    ),
    AgentProfile(
        id="portfolio_manager",
        name="组合经理",
        team="pm",
        title="Portfolio Manager",
        description="审批交易提案并输出最终决策",
        skills=["最终决策", "仓位审批", "组合管理"],
        color="#8E44AD",
    ),
]


def is_agent_node(node_name: str) -> bool:
    """Return True if node_name is a primary agent (not tools/msg-clear)."""
    if node_name.startswith(TOOL_NODE_PREFIX) or node_name.startswith(MSG_CLEAR_PREFIX):
        return False
    return node_name in NODE_AGENT_MAP


def meta_for_node(node_name: str) -> AgentMeta | None:
    return NODE_AGENT_MAP.get(node_name)
