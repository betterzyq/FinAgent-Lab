/** Frontend-local mock events when backend is unavailable or local mock is enabled. */

import type { AgentRunEvent } from '../types/events'

let seq = 0
function ev(
  runId: string,
  event_type: AgentRunEvent['event_type'],
  partial: Partial<AgentRunEvent> = {},
): AgentRunEvent {
  seq += 1
  return {
    event_id: `local-mock-${seq}`,
    run_id: runId,
    timestamp: new Date().toISOString(),
    event_type,
    ...partial,
  }
}

export function buildLocalMockEvents(
  runId: string,
  symbol: string,
  companyName: string,
  tradeDate: string,
): AgentRunEvent[] {
  const base = { run_id: runId }
  return [
    ev(runId, 'run_started', {
      title: '分析任务启动',
      message: `${symbol} @ ${tradeDate}`,
      payload: { symbol, company_name: companyName, trade_date: tradeDate },
    }),
    ...(['market_analyst', 'fundamentals_analyst', 'sentiment_analyst', 'news_policy_analyst'] as const).flatMap((id) => [
      ev(runId, 'agent_started', { agent_id: id, payload: { stage: 'analyst' } }),
      ev(runId, 'tool_called', { agent_id: id, message: 'get_stock_data' }),
      ev(runId, 'report_ready', {
        agent_id: id,
        message: `【本地模拟】${id} 报告已生成`,
        payload: { report_key: id, content: `【本地模拟报告】${companyName} ${id}` },
      }),
      ev(runId, 'agent_finished', { agent_id: id }),
    ]),
    ev(runId, 'debate_message', {
      agent_id: 'bullish_researcher',
      message: '【模拟】看多：品牌护城河与消费复苏逻辑成立。',
      payload: { side: 'bull' },
    }),
    ev(runId, 'debate_message', {
      agent_id: 'bearish_researcher',
      message: '【模拟】看空：估值偏高，宏观节奏存在不确定性。',
      payload: { side: 'bear' },
    }),
    ev(runId, 'debate_finished', {
      agent_id: 'research_manager',
      message: '【模拟】投资计划：Overweight',
      payload: { investment_plan: '**Recommendation**: Overweight' },
    }),
    ev(runId, 'handoff', { from_agent: 'research_manager', to_agent: 'trader' }),
    ev(runId, 'trader_proposal_ready', {
      agent_id: 'trader',
      message: '【模拟】Action: Buy',
      payload: { trader_proposal: '**Action**: Buy' },
    }),
    ev(runId, 'risk_debate_message', { agent_id: 'aggressive_risk', payload: { side: 'aggressive' }, message: '【模拟】进攻型：机会大于风险。' }),
    ev(runId, 'risk_debate_message', { agent_id: 'neutral_risk', payload: { side: 'neutral' }, message: '【模拟】中性：平衡仓位。' }),
    ev(runId, 'risk_debate_message', { agent_id: 'conservative_risk', payload: { side: 'conservative' }, message: '【模拟】保守：注意回撤。' }),
    ev(runId, 'risk_debate_finished', { agent_id: 'portfolio_manager' }),
    ev(runId, 'pm_decision_ready', {
      agent_id: 'portfolio_manager',
      message: '**Rating**: Overweight',
      payload: {
        final_decision: '**Rating**: Overweight\n**Executive Summary**: 模拟决策',
      },
    }),
    ev(runId, 'run_finished', {
      message: '本地模拟完成',
      payload: {
        status: 'finished',
        decision: {
          rating: 'Overweight',
          action: 'Buy',
          confidence: 'medium',
          summary: '本地 mock 演示完成',
        },
      },
    }),
  ].map((e) => ({ ...base, ...e }))
}

export async function playLocalMockEvents(
  events: AgentRunEvent[],
  onEvent: (e: AgentRunEvent) => void,
  intervalMs = 500,
): Promise<void> {
  for (const event of events) {
    onEvent(event)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
