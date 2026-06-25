import type { AgentRunEvent } from './events'
import type { TradingAgentId } from './agent'

export type RunStatus =
  | 'idle'
  | 'created'
  | 'running'
  | 'finished'
  | 'failed'
  | 'cancelled'

export type ConnectionStatus = 'unknown' | 'connected' | 'disconnected' | 'error'

export type AnalysisDepth = 'quick' | 'standard' | 'deep'

export interface RunCreatePayload {
  symbol: string
  company_name?: string | null
  market?: string
  trade_date: string
  analysis_depth?: AnalysisDepth
  debate_rounds?: number
  risk_rounds?: number
}

export interface RunCreateResponse {
  run_id: string
  status: 'created' | 'running' | 'failed'
  message: string
}

export interface FinalDecision {
  rating?: string
  action?: string
  confidence?: string
  summary?: string
  raw_markdown?: string
  position_sizing?: string
  risks?: string[]
  stop_loss_hint?: string
  time_horizon?: string
  symbol?: string
  company_name?: string
}

export interface RunStatusResponse {
  run_id: string
  status: RunStatus
  symbol: string
  company_name: string | null
  trade_date: string
  started_at: string | null
  finished_at: string | null
  current_stage: string | null
  final_decision: FinalDecision | null
  error: string | null
}

export interface ReportMap {
  [agentId: string]: string
}

export interface RunTaskInfo {
  symbol: string
  companyName: string
  tradeDate: string
  stage: string
}

export interface RunStoreSnapshot {
  currentRunId: string | null
  runStatus: RunStatus
  selectedAgentId: TradingAgentId | null
  events: AgentRunEvent[]
  taskInfo: RunTaskInfo | null
}
