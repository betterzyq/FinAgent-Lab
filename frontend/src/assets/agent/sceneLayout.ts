/**
 * Central layout — desk center coords, agent feet derived from desk front.
 */

export const SCENE_WIDTH = 1280
export const SCENE_HEIGHT = 720

export type ZoneKey =
  | 'tickerBoard'
  | 'commandCenter'
  | 'analystZone'
  | 'researchRoom'
  | 'traderDesk'
  | 'riskRoom'
  | 'pmOffice'

export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
  label: string
  floorColor: number
}

/** Desk x/y = top-left corner (matches sceneFurniture draw helpers). */
export interface DeskRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MeetingTableRect {
  cx: number
  cy: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface WorkstationSlot {
  desk: DeskRect
  agent: Point
}

export const SCENE_SIZE = { width: SCENE_WIDTH, height: SCENE_HEIGHT }

/** Global downward shift for all agent feet (1/26 of scene width). */
export const AGENT_GLOBAL_Y_OFFSET = SCENE_WIDTH / 26

function shiftAgentY(y: number): number {
  return y + AGENT_GLOBAL_Y_OFFSET
}

/** Agent feet below desk front edge. */
export const AGENT_STAND_GAP = 8

/** Label Y offset below agent feet (container local px, NOT scaled). */
export const LABEL_OFFSETS = { x: 0, y: -45 } as const

export const TABLE_SEAT_OFFSET_X = 108
export const TABLE_BOTTOM_SEAT_OFFSET_Y = 22

export const TOP_BANNER_POSITION = { x: 360, y: 6, width: 560, height: 34 }

export const COMMAND_CENTER_POSITION = { x: 520, y: 96, width: 240, height: 100 }

export const SCENE_ZONES: Record<ZoneKey, ZoneRect> = {
  tickerBoard: { ...TOP_BANNER_POSITION, label: '行情大屏', floorColor: 0x0f172a },
  commandCenter: { ...COMMAND_CENTER_POSITION, label: '中央控制台', floorColor: 0xe8edf3 },
  analystZone: { x: 16, y: 208, width: 380, height: 228, label: '分析师工位区', floorColor: 0xeef2f6 },
  pmOffice: { x: 920, y: COMMAND_CENTER_POSITION.y, width: 340, height: 118, label: 'PM 办公室', floorColor: 0xede9f6 },
  researchRoom: { x: 420, y: 278, width: 440, height: 198, label: '研究辩论室', floorColor: 0xeaf0f5 },
  traderDesk: { x: 920, y: 262, width: 340, height: 118, label: '交易执行台', floorColor: 0xeef2f6 },
  riskRoom: { x: 420, y: 498, width: 440, height: 198, label: '风控会议室', floorColor: 0xeaf0f5 },
}

const ZONE = SCENE_ZONES

/** Build desk + agent feet from desk center X and top Y. */
function workstation(centerX: number, topY: number, width: number, height: number): WorkstationSlot {
  const desk: DeskRect = { x: centerX, y: topY, width, height }
  return {
    desk,
    agent: { x: centerX, y: shiftAgentY(topY + height + AGENT_STAND_GAP) },
  }
}

function tableInZone(zone: ZoneRect, relCy: number, width: number, height: number): MeetingTableRect {
  return { cx: zone.x + zone.width / 2, cy: zone.y + relCy, width, height }
}

function meetingSeats(table: MeetingTableRect): { left: Point; right: Point; bottom: Point } {
  const halfH = table.height / 2
  const rowY = table.cy + halfH + AGENT_STAND_GAP
  return {
    left: { x: table.cx - TABLE_SEAT_OFFSET_X, y: shiftAgentY(rowY) },
    right: { x: table.cx + TABLE_SEAT_OFFSET_X, y: shiftAgentY(rowY) },
    bottom: { x: table.cx, y: shiftAgentY(rowY + TABLE_BOTTOM_SEAT_OFFSET_Y) },
  }
}

// --- Workstations: desk center X, desk top Y ---
const az = ZONE.analystZone
const analystSlots: WorkstationSlot[] = [
  workstation(az.x + 98, az.y + 38, 72, 34),   // market — top-left
  workstation(az.x + 282, az.y + 38, 72, 34), // fundamentals — top-right
  workstation(az.x + 98, az.y + 122, 72, 34), // sentiment — bottom-left
  workstation(az.x + 282, az.y + 122, 72, 34), // news — bottom-right
]

const cc = ZONE.commandCenter
const commandSlot = workstation(cc.x + cc.width / 2, cc.y + 34, 76, 34)

const pm = ZONE.pmOffice
const pmSlot = workstation(pm.x + pm.width / 2, pm.y + 34, 80, 34)

const td = ZONE.traderDesk
const traderSlot = workstation(td.x + td.width / 2, td.y + 34, 96, 36)

export const DESK_POSITIONS = {
  analyst: analystSlots.map((s) => s.desk),
  commandConsole: commandSlot.desk,
  pmDesk: pmSlot.desk,
  traderDesk: traderSlot.desk,
} as const

export const MEETING_TABLE_POSITIONS = {
  researchTable: tableInZone(ZONE.researchRoom, 82, 188, 58),
  riskTable: tableInZone(ZONE.riskRoom, 82, 188, 58),
} as const

export const AGENT_HOME_POSITIONS: Record<string, Point> = {
  coordinator: commandSlot.agent,
  market_analyst: analystSlots[0].agent,
  fundamentals_analyst: analystSlots[1].agent,
  sentiment_analyst: analystSlots[2].agent,
  news_policy_analyst: analystSlots[3].agent,
  portfolio_manager: pmSlot.agent,
  trader: traderSlot.agent,
  ...Object.fromEntries(
    (['bullish_researcher', 'bearish_researcher', 'research_manager'] as const).map((id, i) => {
      const seats = meetingSeats(MEETING_TABLE_POSITIONS.researchTable)
      const pt = i === 0 ? seats.left : i === 1 ? seats.right : seats.bottom
      return [id, pt]
    }),
  ),
  ...Object.fromEntries(
    (['aggressive_risk', 'conservative_risk', 'neutral_risk'] as const).map((id, i) => {
      const seats = meetingSeats(MEETING_TABLE_POSITIONS.riskTable)
      const pt = i === 0 ? seats.left : i === 1 ? seats.right : seats.bottom
      return [id, pt]
    }),
  ),
}

function buildAgentPositions() {
  const rs = meetingSeats(MEETING_TABLE_POSITIONS.researchTable)
  const ks = meetingSeats(MEETING_TABLE_POSITIONS.riskTable)
  return {
    coordinator: { home: commandSlot.agent, work: commandSlot.agent },
    market_analyst: { home: analystSlots[0].agent, work: analystSlots[0].agent, meeting: rs.left },
    fundamentals_analyst: { home: analystSlots[1].agent, work: analystSlots[1].agent, meeting: rs.left },
    sentiment_analyst: { home: analystSlots[2].agent, work: analystSlots[2].agent, meeting: rs.right },
    news_policy_analyst: { home: analystSlots[3].agent, work: analystSlots[3].agent, meeting: rs.right },
    bullish_researcher: { home: rs.left, debate: rs.left },
    bearish_researcher: { home: rs.right, debate: rs.right },
    research_manager: { home: rs.bottom, debate: rs.bottom, trader: traderSlot.agent },
    trader: { home: traderSlot.agent, work: traderSlot.agent, risk: ks.bottom },
    aggressive_risk: { home: ks.left, debate: ks.left },
    neutral_risk: { home: ks.bottom, debate: ks.bottom },
    conservative_risk: { home: ks.right, debate: ks.right },
    portfolio_manager: { home: pmSlot.agent, decision: pmSlot.agent },
  }
}

export interface AgentPointSet {
  home: Point
  work?: Point
  meeting?: Point
  debate?: Point
  trader?: Point
  risk?: Point
  decision?: Point
}

export const AGENT_POSITIONS: Record<string, AgentPointSet> = buildAgentPositions()

/** Temporary visit coords for handoff — not another agent's home seat. */
export const HANDOFF_DELIVERY: Record<'traderDesk' | 'riskRoom' | 'researchRoom', Point> = (() => {
  const rt = MEETING_TABLE_POSITIONS.researchTable
  const kt = MEETING_TABLE_POSITIONS.riskTable
  const rtHalf = rt.height / 2
  const ktHalf = kt.height / 2
  return {
    traderDesk: traderSlot.agent,
    researchRoom: {
      x: rt.cx,
      y: shiftAgentY(rt.cy + rtHalf + AGENT_STAND_GAP),
    },
    riskRoom: {
      x: kt.cx,
      y: shiftAgentY(kt.cy + ktHalf + AGENT_STAND_GAP),
    },
  }
})()

/** @deprecated use LABEL_OFFSETS */
export const LABEL_GAP_BELOW_SPRITE = LABEL_OFFSETS.y

export const LABEL_FONT_SIZES = { default: 12, emphasis: 13 } as const

export const EMPHASIS_AGENT_IDS = new Set([
  'research_manager',
  'portfolio_manager',
  'trader',
  'coordinator',
])

export function getLabelFontSize(agentId: string): number {
  return EMPHASIS_AGENT_IDS.has(agentId) ? LABEL_FONT_SIZES.emphasis : LABEL_FONT_SIZES.default
}

export const SCENE_DESKS = {
  ...DESK_POSITIONS,
  researchTable: MEETING_TABLE_POSITIONS.researchTable,
  riskTable: MEETING_TABLE_POSITIONS.riskTable,
} as const

export const LEGACY_ZONE_MAP: Record<string, ZoneKey> = {
  command_console: 'commandCenter',
  analyst_row: 'analystZone',
  research_room: 'researchRoom',
  trading_desk: 'traderDesk',
  risk_room: 'riskRoom',
  pm_office: 'pmOffice',
}

export const STAGE_LABELS: Record<string, string> = {
  idle: '待启动',
  pending: '待启动',
  coordinator: '任务协调',
  analyst: '分析师工作中',
  research: '研究辩论',
  research_summary: '研究总结',
  trader: '交易提案',
  risk_debate: '风控辩论',
  pm_decision: 'PM 决策',
  done: '已完成',
  finished: '已完成',
  error: '出错',
}

export function formatStageLabel(stage: string): string {
  if (!stage) return '待启动'
  return STAGE_LABELS[stage] ?? stage
}
