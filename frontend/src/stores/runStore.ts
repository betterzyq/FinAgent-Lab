import { defineStore } from 'pinia'
import {
  buildLocalMockEvents,
  playLocalMockEvents,
} from '../api/localMock'
import {
  checkHealth,
  createRun,
  getRun,
  subscribeRunEvents,
} from '../api/tradingApi'
import { TRADING_ROLES, normalizeAgentId } from '../assets/agent/tradingRoles'
import type { AgentRuntimeState, TradingAgentId } from '../types/agent'
import type { AgentRunEvent, DebateMessage, TimelineEntry } from '../types/events'
import type {
  AnalysisDepth,
  ConnectionStatus,
  FinalDecision,
  RunCreatePayload,
  RunStatus,
  RunTaskInfo,
} from '../types/run'

function createInitialAgents(): Record<TradingAgentId, AgentRuntimeState> {
  const map = {} as Record<TradingAgentId, AgentRuntimeState>
  for (const role of TRADING_ROLES) {
    map[role.id] = {
      ...role,
      visualStatus: 'idle',
      currentTask: '',
      screenText: '',
    }
  }
  return map
}

const REPORT_KEY_TO_AGENT: Record<string, TradingAgentId> = {
  market_report: 'market_analyst',
  fundamentals_report: 'fundamentals_analyst',
  sentiment_report: 'sentiment_analyst',
  news_report: 'news_policy_analyst',
  investment_plan: 'research_manager',
  trader_investment_plan: 'trader',
  trader_proposal: 'trader',
  final_trade_decision: 'portfolio_manager',
}

const TOOL_LABELS: Record<string, string> = {
  get_stock_data: '读取行情数据',
  get_indicators: '计算技术指标',
  get_fundamentals: '读取财报数据',
  get_news: '抓取新闻公告',
  get_balance_sheet: '读取资产负债表',
  get_income_statement: '读取利润表',
  get_cashflow: '读取现金流',
  get_macro_indicators: '读取宏观指标',
  get_global_news: '抓取全球新闻',
  get_verified_market_snapshot: '校验行情快照',
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name
}

export const useRunStore = defineStore('run', {
  state: () => ({
    currentRunId: null as string | null,
    runStatus: 'idle' as RunStatus,
    selectedAgentId: 'coordinator' as TradingAgentId | null,
    agents: createInitialAgents(),
    events: [] as AgentRunEvent[],
    timeline: [] as TimelineEntry[],
    reportsByAgent: {} as Record<string, string>,
    debateMessages: [] as DebateMessage[],
    riskDebateMessages: [] as DebateMessage[],
    finalDecision: null as FinalDecision | null,
    showFinalDecision: false,
    taskInfo: null as RunTaskInfo | null,
    error: null as string | null,
    isMockMode: false,
    useLocalMock: false,
    connectionStatus: 'unknown' as ConnectionStatus,
    lastEvent: null as AgentRunEvent | null,
    unsubscribe: null as (() => void) | null,
  }),

  getters: {
    isRunning(state): boolean {
      return state.runStatus === 'running' || state.runStatus === 'created'
    },
    selectedAgent(state): AgentRuntimeState | null {
      if (!state.selectedAgentId) return null
      return state.agents[state.selectedAgentId] ?? null
    },
    selectedReport(state): string {
      if (!state.selectedAgentId) return ''
      return state.reportsByAgent[state.selectedAgentId] ?? ''
    },
  },

  actions: {
    async probeBackend(): Promise<void> {
      const ok = await checkHealth()
      this.connectionStatus = ok ? 'connected' : 'disconnected'
    },

    selectAgent(id: TradingAgentId | null) {
      this.selectedAgentId = id
    },

    updateAgentStatus(
      id: TradingAgentId,
      visualStatus: AgentRuntimeState['visualStatus'],
      currentTask = '',
      screenText = '',
    ) {
      const agent = this.agents[id]
      if (!agent) return
      agent.visualStatus = visualStatus
      if (currentTask) agent.currentTask = currentTask
      if (screenText) agent.screenText = screenText
    },

    appendReport(agentId: TradingAgentId, content: string) {
      this.reportsByAgent[agentId] = content
    },

    appendDebateMessage(msg: DebateMessage) {
      this.debateMessages.push(msg)
    },

    appendRiskDebateMessage(msg: DebateMessage) {
      this.riskDebateMessages.push(msg)
    },

    setFinalDecision(decision: FinalDecision) {
      this.finalDecision = decision
      this.showFinalDecision = true
    },

    appendTimeline(event: AgentRunEvent, success = true) {
      this.timeline.push({
        id: event.event_id,
        timestamp: event.timestamp,
        stage: String((event.payload as Record<string, unknown> | undefined)?.stage ?? this.taskInfo?.stage ?? ''),
        agentId: event.agent_id ?? null,
        agentName: event.agent_name ?? null,
        eventType: event.event_type,
        description: event.message ?? event.title ?? event.event_type,
        success,
      })
    },

    resetRun() {
      this.unsubscribe?.()
      this.unsubscribe = null
      this.currentRunId = null
      this.runStatus = 'idle'
      this.events = []
      this.timeline = []
      this.reportsByAgent = {}
      this.debateMessages = []
      this.riskDebateMessages = []
      this.finalDecision = null
      this.showFinalDecision = false
      this.taskInfo = null
      this.error = null
      this.lastEvent = null
      this.agents = createInitialAgents()
    },

    handleEvent(event: AgentRunEvent) {
      this.events.push(event)
      this.lastEvent = event
      this.appendTimeline(event, event.event_type !== 'run_error')

      const agentId = normalizeAgentId(event.agent_id ?? undefined)

      switch (event.event_type) {
        case 'run_started': {
          const p = event.payload ?? {}
          this.taskInfo = {
            symbol: String(p.symbol ?? ''),
            companyName: String(p.company_name ?? ''),
            tradeDate: String(p.trade_date ?? ''),
            stage: 'coordinator',
          }
          this.updateAgentStatus('coordinator', 'working', '接收任务', '任务已下发')
          break
        }
        case 'agent_started': {
          if (agentId) {
            this.updateAgentStatus(agentId, 'working', event.title ?? '分析中', '工位屏幕亮起')
            if (this.taskInfo) this.taskInfo.stage = String((event.payload as Record<string, unknown>)?.stage ?? agentId)
          }
          break
        }
        case 'agent_finished': {
          if (agentId) this.updateAgentStatus(agentId, 'finished', '阶段完成')
          break
        }
        case 'tool_called': {
          if (agentId) {
            const tool = String(event.message ?? (event.payload as Record<string, unknown>)?.tool_name ?? '工具')
            this.updateAgentStatus(agentId, 'working', toolLabel(tool), toolLabel(tool))
          }
          break
        }
        case 'report_ready': {
          if (agentId) {
            const content = String((event.payload as Record<string, unknown>)?.content ?? event.message ?? '')
            this.appendReport(agentId, content)
            this.updateAgentStatus(agentId, 'finished', '报告已生成')
          } else {
            const key = String((event.payload as Record<string, unknown>)?.report_key ?? '')
            const mapped = REPORT_KEY_TO_AGENT[key]
            if (mapped) {
              const content = String((event.payload as Record<string, unknown>)?.content ?? event.message ?? '')
              this.appendReport(mapped, content)
            }
          }
          break
        }
        case 'handoff': {
          if (agentId) this.updateAgentStatus(agentId, 'moving', '任务交付')
          break
        }
        case 'debate_message': {
          const side = String((event.payload as Record<string, unknown>)?.side ?? '')
          const id = agentId ?? (side === 'bull' ? 'bullish_researcher' : 'bearish_researcher')
          this.updateAgentStatus(id, 'debating', '辩论发言')
          this.appendDebateMessage({
            id: event.event_id,
            side,
            agentId: id,
            agentName: event.agent_name ?? id,
            content: String((event.payload as Record<string, unknown>)?.content ?? event.message ?? ''),
            timestamp: event.timestamp,
          })
          break
        }
        case 'debate_finished': {
          const content = String((event.payload as Record<string, unknown>)?.investment_plan ?? event.message ?? '')
          this.appendReport('research_manager', content)
          this.updateAgentStatus('research_manager', 'working', '形成投资计划')
          if (this.taskInfo) this.taskInfo.stage = 'research_summary'
          break
        }
        case 'trader_proposal_ready': {
          const content = String((event.payload as Record<string, unknown>)?.trader_proposal ?? event.message ?? '')
          this.appendReport('trader', content)
          this.updateAgentStatus('trader', 'working', '交易提案就绪')
          if (this.taskInfo) this.taskInfo.stage = 'trader'
          break
        }
        case 'risk_debate_message': {
          const side = String((event.payload as Record<string, unknown>)?.side ?? '')
          const id = agentId ?? 'neutral_risk'
          this.updateAgentStatus(id, 'debating', '风控辩论')
          this.appendRiskDebateMessage({
            id: event.event_id,
            side,
            agentId: id,
            agentName: event.agent_name ?? id,
            content: String((event.payload as Record<string, unknown>)?.content ?? event.message ?? ''),
            timestamp: event.timestamp,
          })
          if (this.taskInfo) this.taskInfo.stage = 'risk_debate'
          break
        }
        case 'risk_debate_finished': {
          if (this.taskInfo) this.taskInfo.stage = 'pm_decision'
          break
        }
        case 'pm_decision_ready': {
          const md = String((event.payload as Record<string, unknown>)?.final_decision ?? event.message ?? '')
          this.appendReport('portfolio_manager', md)
          this.updateAgentStatus('portfolio_manager', 'deciding', '最终决策')
          this.setFinalDecision({
            rating: md.match(/Rating\*\*:\s*(\w+)/i)?.[1] ?? 'Hold',
            raw_markdown: md,
            summary: md,
            symbol: this.taskInfo?.symbol,
            company_name: this.taskInfo?.companyName,
          })
          break
        }
        case 'run_finished': {
          this.runStatus = 'finished'
          const decision = (event.payload as Record<string, unknown>)?.decision as FinalDecision | undefined
          if (decision) this.setFinalDecision({ ...decision, symbol: this.taskInfo?.symbol, company_name: this.taskInfo?.companyName })
          for (const id of Object.keys(this.agents) as TradingAgentId[]) {
            if (this.agents[id].visualStatus !== 'error') {
              this.agents[id].visualStatus = 'idle'
              this.agents[id].currentTask = ''
            }
          }
          if (this.taskInfo) this.taskInfo.stage = 'done'
          break
        }
        case 'run_error': {
          this.runStatus = 'failed'
          this.error = event.message ?? '运行失败'
          if (agentId) this.updateAgentStatus(agentId, 'error', this.error)
          break
        }
        default:
          break
      }
    },

    async startRun(payload: RunCreatePayload, options?: { mock?: boolean; localMock?: boolean }): Promise<string> {
      this.resetRun()
      this.isMockMode = Boolean(options?.mock)
      this.useLocalMock = Boolean(options?.localMock)
      this.runStatus = 'running'

      if (this.useLocalMock) {
        return await this.runLocalMock(payload)
      }

      try {
        const res = await createRun(payload, this.isMockMode)
        this.currentRunId = res.run_id
        this.unsubscribe = subscribeRunEvents(res.run_id, {
          onEvent: (e) => this.handleEvent(e),
          onError: (err) => {
            this.connectionStatus = 'error'
            this.error = err.message
          },
          onComplete: async () => {
            if (this.runStatus === 'running') {
              try {
                const status = await getRun(res.run_id)
                if (status.final_decision) {
                  this.setFinalDecision(status.final_decision)
                }
                this.runStatus = status.status as RunStatus
              } catch {
                /* ignore */
              }
            }
          },
        })
        return res.run_id
      } catch (err) {
        this.connectionStatus = 'disconnected'
        this.useLocalMock = true
        return await this.runLocalMock(payload)
      }
    },

    async runLocalMock(payload: RunCreatePayload): Promise<string> {
      const runId = `local-${Date.now()}`
      this.currentRunId = runId
      this.isMockMode = true
      this.runStatus = 'running'
      const events = buildLocalMockEvents(
        runId,
        payload.symbol,
        payload.company_name ?? payload.symbol,
        payload.trade_date,
      )
      void playLocalMockEvents(events, (e) => this.handleEvent(e), 450)
      return runId
    },
  },
})

export type { AnalysisDepth, RunCreatePayload }
