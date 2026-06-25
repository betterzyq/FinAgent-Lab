/**

 * Map backend AgentRunEvent -> marvis-style pony animations.

 */



import { AGENT_POSITIONS, HANDOFF_DELIVERY } from '../assets/agent/sceneLayout'

import { normalizeAgentId, TRADING_ROLE_BY_ID } from '../assets/agent/tradingRoles'

import type { AgentRunEvent } from '../types/events'

import type { TradingAgentId } from '../types/agent'

import type { AgentVisualState } from './TradingAgentPerson'

import type { TradingOrchestrator } from './useTradingOrchestrator'

import type { TradingSceneController, ZoneId } from './useTradingScene'



type SceneApi = TradingSceneController & {

  setAgentStatus?: (id: TradingAgentId, status: string, text?: string) => void

  showBubble?: (id: TradingAgentId, text: string) => Promise<void>

  moveAgentToZone?: (id: TradingAgentId, zone: string, slot?: string) => Promise<void>

}



const HANDOFF_DEST: Record<string, { x: number; y: number } | undefined> = {

  trader: HANDOFF_DELIVERY.traderDesk,

  risk_room: HANDOFF_DELIVERY.riskRoom,

  research_room: HANDOFF_DELIVERY.researchRoom,

}



const HANDOFF_ZONE: Record<string, ZoneId> = {

  trader: 'traderDesk',

  risk_room: 'riskRoom',

  research_room: 'researchRoom',

}



const RESEARCH_DEBATERS = ['bullish_researcher', 'bearish_researcher'] as const

const RISK_DEBATERS = ['aggressive_risk', 'neutral_risk', 'conservative_risk'] as const



/** Sitting pose at meeting table after debate segment ends. */

function seatResearchers(scene: SceneApi): void {

  for (const id of RESEARCH_DEBATERS) {

    scene.setAgentState(id, 'working')

  }

}



function seatRiskPanel(scene: SceneApi): void {

  for (const id of RISK_DEBATERS) {

    scene.setAgentState(id, 'working')

  }

}



const TOOL_LABELS: Record<string, string> = {

  get_stock_data: '读取行情数据',

  get_indicators: '计算技术指标',

  get_fundamentals: '读取财报',

  get_news: '抓取新闻',

  get_balance_sheet: '读取资产负债表',

  get_income_statement: '读取利润表',

  get_cashflow: '读取现金流',

}



function toolLabel(raw: string): string {

  return TOOL_LABELS[raw] ?? raw

}



function zoneForAgent(id: TradingAgentId): ZoneId {

  const z = TRADING_ROLE_BY_ID[id]?.zone ?? 'analystZone'

  const map: Record<string, ZoneId> = {

    command_console: 'commandCenter',

    analyst_row: 'analystZone',

    research_room: 'researchRoom',

    trading_desk: 'traderDesk',

    risk_room: 'riskRoom',

    pm_office: 'pmOffice',

  }

  return map[z] ?? 'analystZone'

}



export function useEventDrivenAnimation(scene: SceneApi, orchestrator: TradingOrchestrator) {

  const { sequence, wait, parallel } = orchestrator



  async function handleEvent(

    event: AgentRunEvent,

    task?: { symbol: string; companyName: string; tradeDate: string; stage: string },

  ): Promise<void> {

    const agentId = normalizeAgentId(event.agent_id ?? undefined)



    switch (event.event_type) {

      case 'run_started': {

        const p = event.payload ?? {}

        scene.setTicker(

          String(p.symbol ?? task?.symbol ?? ''),

          String(p.company_name ?? task?.companyName ?? ''),

          String(p.trade_date ?? task?.tradeDate ?? ''),

          '任务启动',

        )

        await scene.resetAllHomes()

        scene.highlightZone('commandCenter')

        scene.setAgentState('coordinator', 'working', '接收任务')

        await scene.moveAgentToPoint('coordinator', 'work')

        break

      }



      case 'agent_started': {

        if (!agentId) break

        scene.highlightZone(zoneForAgent(agentId))

        const p = scene.getPerson(agentId)

        if (p && Math.hypot(p.container.x - p.homeX, p.container.y - p.homeY) > 20) {

          await scene.moveAgentToPoint(agentId, 'work')

        }

        scene.setAgentState(agentId, 'working', '开始工作')

        break

      }



      case 'tool_called': {

        if (!agentId) break

        const tool = toolLabel(String(event.message ?? '分析中'))

        scene.getPerson(agentId)?.showWorking(tool)

        break

      }



      case 'report_ready': {

        if (!agentId) break

        scene.setAgentState(agentId, 'finished', '报告完成')

        const meeting = AGENT_POSITIONS[agentId]?.meeting

        if (meeting) {

          await sequence(

            () => scene.moveAgent(agentId, meeting.x, meeting.y, true),

            () => wait(300),

            async () => { scene.getPerson(agentId)?.say('交付报告', 1500) },

            () => scene.moveAgentHome(agentId),

          )

        }

        break

      }



      case 'handoff': {

        const to = event.to_agent ?? ''

        const from = normalizeAgentId(event.from_agent ?? event.agent_id ?? undefined)

        const dest = HANDOFF_DEST[to]

        if (!from || !dest) break



        scene.highlightZone(HANDOFF_ZONE[to] ?? 'researchRoom')

        await sequence(

          async () => { scene.setAgentState(from, 'running') },

          () => scene.moveAgent(from, dest.x, dest.y, true),

          async () => {

            scene.showSpeechBubble(from, '交付任务', { type: 'handoff', duration: 1500 })

          },

          () => scene.showHandoffTrail(from, dest.x, dest.y),

          () => wait(400),

          () => scene.moveAgentHome(from),

          async () => { scene.setAgentState(from, 'working') },

        )

        break

      }



      case 'debate_message': {

        const side = String((event.payload as Record<string, unknown>)?.side ?? '')

        const id = agentId ?? (side === 'bull' ? 'bullish_researcher' : 'bearish_researcher')

        scene.highlightZone('researchRoom')

        await parallel(

          async () => {

            scene.setAgentState(id, 'debating')

            const text = String((event.payload as Record<string, unknown>)?.content ?? event.message ?? '')

            scene.getPerson(id)?.say(text.slice(0, 80), 2500)

          },

          async () => {

            const other = id === 'bullish_researcher' ? 'bearish_researcher' : 'bullish_researcher'

            scene.setAgentState(other, 'working')

          },

        )

        break

      }



      case 'debate_finished': {

        scene.highlightZone('researchRoom')

        scene.setAgentState('research_manager', 'working', '形成投资计划')

        seatResearchers(scene)

        await parallel(

          () => scene.moveAgentToPoint('bullish_researcher', 'home'),

          () => scene.moveAgentToPoint('bearish_researcher', 'home'),

          () => scene.moveAgentToPoint('research_manager', 'home'),

        )

        break

      }



      case 'trader_proposal_ready': {

        scene.highlightZone('traderDesk')

        scene.getPerson('trader')?.say('交易提案已生成', 2000)

        scene.setAgentState('trader', 'working')

        await scene.moveAgentToPoint('trader', 'home')

        break

      }



      case 'risk_debate_message': {

        scene.highlightZone('riskRoom')

        if (agentId) {

          scene.setAgentState(agentId, 'debating')

          const text = String((event.payload as Record<string, unknown>)?.content ?? event.message ?? '')

          scene.getPerson(agentId)?.say(text.slice(0, 70), 2200)

          for (const other of RISK_DEBATERS) {

            if (other !== agentId) scene.setAgentState(other, 'working')

          }

        }

        break

      }



      case 'risk_debate_finished': {

        scene.highlightZone('riskRoom')

        seatRiskPanel(scene)

        await parallel(

          ...RISK_DEBATERS.map((id) => () => scene.moveAgentToPoint(id, 'home')),

          () => scene.moveAgentToPoint('trader', 'home'),

        )

        break

      }



      case 'pm_decision_ready': {

        scene.highlightZone('pmOffice')

        scene.setAgentState('portfolio_manager', 'working', '最终决策')

        scene.getPerson('portfolio_manager')?.say('PM 决策就绪', 2800)

        break

      }



      case 'run_finished': {

        scene.setTicker(

          task?.symbol ?? '',

          task?.companyName ?? '',

          task?.tradeDate ?? '',

          '分析完成',

        )

        scene.highlightZone(null)

        await scene.resetAllHomes()

        for (const id of Object.keys(TRADING_ROLE_BY_ID) as TradingAgentId[]) {

          scene.setAgentState(id, 'finished')

        }

        break

      }



      case 'run_error': {

        if (agentId) scene.setAgentState(agentId, 'error', event.message ?? '错误')

        break

      }



      default:

        break

    }

  }



  return { handleEvent }

}



export function useTradingAnimation(scene: SceneApi, orchestrator: TradingOrchestrator) {

  return useEventDrivenAnimation(scene, orchestrator)

}



export type { AgentVisualState }


