const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

import type { AgentProfileApi } from '../types/agent'
import type { AgentRunEvent } from '../types/events'
import type { RunCreatePayload, RunCreateResponse, RunStatusResponse } from '../types/run'

function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/health'), { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function createRun(
  payload: RunCreatePayload,
  mock = false,
): Promise<RunCreateResponse> {
  const qs = mock ? '?mock=true' : ''
  const res = await fetch(apiUrl(`/api/runs${qs}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: payload.symbol,
      company_name: payload.company_name ?? null,
      market: payload.market ?? 'A股',
      trade_date: payload.trade_date,
      analysis_depth: payload.analysis_depth ?? 'standard',
      debate_rounds: payload.debate_rounds ?? 2,
      risk_rounds: payload.risk_rounds ?? 2,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `createRun failed: ${res.status}`)
  }
  return res.json() as Promise<RunCreateResponse>
}

export async function getRun(runId: string): Promise<RunStatusResponse> {
  const res = await fetch(apiUrl(`/api/runs/${runId}`))
  if (!res.ok) throw new Error(`getRun failed: ${res.status}`)
  return res.json() as Promise<RunStatusResponse>
}

export async function getRunTimeline(runId: string): Promise<{ events: AgentRunEvent[] }> {
  const res = await fetch(apiUrl(`/api/runs/${runId}/timeline`))
  if (!res.ok) throw new Error(`getRunTimeline failed: ${res.status}`)
  return res.json() as Promise<{ events: AgentRunEvent[] }>
}

export async function getAgents(): Promise<AgentProfileApi[]> {
  const res = await fetch(apiUrl('/api/agents'))
  if (!res.ok) throw new Error(`getAgents failed: ${res.status}`)
  const data = (await res.json()) as { agents: AgentProfileApi[] }
  return data.agents
}

export interface SymbolItem {
  symbol: string
  display: string
  name: string
  market: string
}

export async function searchSymbols(keyword: string): Promise<SymbolItem[]> {
  const res = await fetch(apiUrl(`/api/symbols/search?keyword=${encodeURIComponent(keyword)}`))
  if (!res.ok) throw new Error(`searchSymbols failed: ${res.status}`)
  const data = (await res.json()) as { items: SymbolItem[] }
  return data.items
}

export type EventHandlers = {
  onEvent: (event: AgentRunEvent) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

/** Subscribe to SSE event stream for a run. Returns cleanup function. */
export function subscribeRunEvents(runId: string, handlers: EventHandlers): () => void {
  const source = new EventSource(apiUrl(`/api/runs/${runId}/events`))

  source.onmessage = (msg) => {
    if (!msg.data || msg.data === '{}') return
    try {
      const event = JSON.parse(msg.data) as AgentRunEvent
      handlers.onEvent(event)
      if (event.event_type === 'run_finished' || event.event_type === 'run_error') {
        handlers.onComplete?.()
        source.close()
      }
    } catch (err) {
      handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  source.onerror = () => {
    handlers.onError?.(new Error('SSE connection error'))
    source.close()
    handlers.onComplete?.()
  }

  return () => source.close()
}

export { API_BASE }
