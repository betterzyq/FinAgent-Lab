export type EventType =
  | 'run_started'
  | 'agent_started'
  | 'agent_finished'
  | 'tool_called'
  | 'tool_finished'
  | 'report_ready'
  | 'handoff'
  | 'debate_message'
  | 'debate_finished'
  | 'risk_debate_message'
  | 'risk_debate_finished'
  | 'trader_proposal_ready'
  | 'pm_decision_ready'
  | 'run_finished'
  | 'run_error'

export interface AgentRunEvent {
  event_id: string
  run_id: string
  timestamp: string
  event_type: EventType
  agent_id?: string | null
  agent_name?: string | null
  team?: string | null
  from_agent?: string | null
  to_agent?: string | null
  title?: string | null
  message?: string | null
  payload?: Record<string, unknown> | null
}

export interface DebateMessage {
  id: string
  side: string
  agentId: string
  agentName: string
  content: string
  timestamp: string
}

export interface TimelineEntry {
  id: string
  timestamp: string
  stage: string
  agentId: string | null
  agentName: string | null
  eventType: EventType
  description: string
  success: boolean
}
