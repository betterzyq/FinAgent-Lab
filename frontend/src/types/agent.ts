export type AgentTeam = 'coordinator' | 'analyst' | 'researcher' | 'trader' | 'risk' | 'pm'

export type AgentVisualStatus =
  | 'idle'
  | 'working'
  | 'moving'
  | 'debating'
  | 'waiting'
  | 'deciding'
  | 'finished'
  | 'error'

export type AvatarType = 'circle' | 'emoji' | 'sprite'

export type AgentVisualState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'working'
  | 'debating'
  | 'talking'
  | 'lazy'
  | 'waiting'
  | 'finished'
  | 'error'

export type TradingAgentId =
  | 'coordinator'
  | 'market_analyst'
  | 'fundamentals_analyst'
  | 'sentiment_analyst'
  | 'news_policy_analyst'
  | 'bullish_researcher'
  | 'bearish_researcher'
  | 'research_manager'
  | 'trader'
  | 'aggressive_risk'
  | 'neutral_risk'
  | 'conservative_risk'
  | 'portfolio_manager'

export type AgentAction = 'standby' | 'working' | 'walking' | 'talking' | 'delivering'

export interface AgentPosition {
  x: number
  y: number
}

export interface TradingRoleProfile {
  id: TradingAgentId
  name: string
  title: string
  team: AgentTeam
  status: string
  description: string
  skills: readonly string[]
  color: string
  position: AgentPosition
  deskPosition: AgentPosition
  meetingPosition: AgentPosition
  avatarType: AvatarType
  avatarEmoji: string
  currentAction: AgentAction
  zone: string
}

export interface AgentRuntimeState extends TradingRoleProfile {
  visualStatus: AgentVisualStatus
  currentTask: string
  screenText: string
}

export interface AgentProfileApi {
  id: string
  name: string
  team: string
  title: string
  description: string
  skills: string[]
  color: string
  default_status: string
}
