/**
 * PixiJS trading floor — marvis pony sprites, light office layout.
 */

import { Container, Graphics, Text } from 'pixi.js'
import {
  AGENT_POSITIONS,
  DESK_POSITIONS,
  formatStageLabel,
  getLabelFontSize,
  MEETING_TABLE_POSITIONS,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SCENE_ZONES,
  type ZoneKey,
} from '../assets/agent/sceneLayout'
import {
  drawAnalystDesk,
  drawCommandConsole,
  drawPmDesk,
  drawResearchDebateTable,
  drawRiskRoundTable,
  drawTraderDesk,
} from '../assets/agent/sceneFurniture'
import { TRADING_ROLES } from '../assets/agent/tradingRoles'
import { TradingAgentPerson, type AgentVisualState } from './TradingAgentPerson'
import { useActionTextures } from './useActionTextures'
import type { TradingAgentId } from '../types/agent'

export type ZoneId = ZoneKey

export type SpeechBubbleOptions = {
  type?: 'talking' | 'working' | 'thinking' | 'handoff'
  maxWidth?: number
  duration?: number
}

export type TradingSceneController = {
  container: Container
  layout: (width: number, height: number) => void
  tick: (dt: number) => void
  destroy: () => void
  setTicker: (symbol: string, name: string, date: string, stage: string) => void
  getPerson: (id: TradingAgentId) => TradingAgentPerson | undefined
  setAgentState: (id: TradingAgentId, state: AgentVisualState, message?: string) => void
  showSpeechBubble: (id: TradingAgentId, text: string, options?: SpeechBubbleOptions) => void
  moveAgent: (id: TradingAgentId, x: number, y: number, run?: boolean) => Promise<void>
  moveAgentHome: (id: TradingAgentId) => Promise<void>
  moveAgentToPoint: (
    id: TradingAgentId,
    point: 'home' | 'work' | 'meeting' | 'debate' | 'trader' | 'risk' | 'decision',
    run?: boolean,
  ) => Promise<void>
  highlightZone: (zone: ZoneId | null) => void
  showHandoffTrail: (fromId: TradingAgentId, toX: number, toY: number) => Promise<void>
  resetAllHomes: () => Promise<void>
}

export function useTradingScene(): { createScene: () => Promise<TradingSceneController> } {
  async function createScene(): Promise<TradingSceneController> {
    const textureLoader = useActionTextures()
    const root = new Container()
    const floorLayer = new Container()
    const furnitureLayer = new Container()
    const handoffLayer = new Container()
    const agentLayer = new Container()
    const uiLayer = new Container()

    root.addChild(floorLayer, furnitureLayer, handoffLayer, agentLayer, uiLayer)

    const floor = new Graphics()
    floor.rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT).fill(0xf4f6f8)
    for (let x = 0; x <= SCENE_WIDTH; x += 56) {
      floor.moveTo(x, 0).lineTo(x, SCENE_HEIGHT).stroke({ width: 1, color: 0xe2e8f0, alpha: 0.65 })
    }
    for (let y = 0; y <= SCENE_HEIGHT; y += 56) {
      floor.moveTo(0, y).lineTo(SCENE_WIDTH, y).stroke({ width: 1, color: 0xe2e8f0, alpha: 0.65 })
    }
    floorLayer.addChild(floor)

    const zoneGfx = new Map<ZoneKey, Graphics>()
    for (const [key, z] of Object.entries(SCENE_ZONES) as [ZoneKey, (typeof SCENE_ZONES)[ZoneKey]][]) {
      if (key === 'tickerBoard') continue
      const g = new Graphics()
      g.roundRect(z.x, z.y, z.width, z.height, 12)
        .fill({ color: z.floorColor, alpha: 0.72 })
      g.roundRect(z.x, z.y, z.width, z.height, 12)
        .stroke({ width: 1, color: 0xd1d9e2, alpha: 0.55 })
      const lbl = new Text({
        text: z.label,
        style: {
          fill: '#64748b',
          fontSize: 11,
          fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
          fontWeight: '500',
        },
      })
      lbl.x = z.x + 12
      lbl.y = z.y + 8
      floorLayer.addChild(g, lbl)
      zoneGfx.set(key, g)
    }

    const furniture = new Graphics()
    for (const desk of DESK_POSITIONS.analyst) drawAnalystDesk(furniture, desk)
    drawResearchDebateTable(furniture, MEETING_TABLE_POSITIONS.researchTable)
    drawRiskRoundTable(furniture, MEETING_TABLE_POSITIONS.riskTable)
    drawTraderDesk(furniture, DESK_POSITIONS.traderDesk)
    drawPmDesk(furniture, DESK_POSITIONS.pmDesk)
    drawCommandConsole(furniture, DESK_POSITIONS.commandConsole)
    furnitureLayer.addChild(furniture)

    const tb = SCENE_ZONES.tickerBoard
    const tickerBg = new Graphics()
    tickerBg.roundRect(tb.x, tb.y, tb.width, tb.height, 8)
      .fill({ color: 0x0f172a, alpha: 0.94 })
    tickerBg.roundRect(tb.x, tb.y, tb.width, tb.height, 8)
      .stroke({ width: 1, color: 0x334155, alpha: 0.8 })
    const tickerText = new Text({
      text: '等待任务…',
      style: {
        fill: '#e2e8f0',
        fontSize: 13,
        fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
        fontWeight: '600',
      },
    })
    tickerText.anchor.set(0.5, 0.5)
    tickerText.x = tb.x + tb.width / 2
    tickerText.y = tb.y + tb.height / 2
    uiLayer.addChild(tickerBg, tickerText)

    const handoffGfx = new Graphics()
    handoffLayer.addChild(handoffGfx)

    const persons = new Map<TradingAgentId, TradingAgentPerson>()
    for (const role of TRADING_ROLES) {
      const pos = AGENT_POSITIONS[role.id]?.home ?? role.deskPosition
      const person = await TradingAgentPerson.create(
        {
          name: role.name,
          scarfColor: role.color,
          homeX: pos.x,
          homeY: pos.y,
          labelFontSize: getLabelFontSize(role.id),
        },
        textureLoader,
      )
      persons.set(role.id, person)
      agentLayer.addChild(person.container)
    }

    let activeZone: ZoneKey | null = null
    let lastTick = performance.now()
    let rafId = 0

    function tickFrame(now: number): void {
      const dt = Math.min(0.05, (now - lastTick) / 1000)
      lastTick = now
      for (const p of persons.values()) p.tick(dt)
      rafId = requestAnimationFrame(tickFrame)
    }
    rafId = requestAnimationFrame(tickFrame)

    function getPerson(id: TradingAgentId): TradingAgentPerson | undefined {
      return persons.get(id)
    }

    function setTicker(symbol: string, name: string, date: string, stage: string): void {
      tickerText.text = `${symbol}  ${name}  |  ${date}  |  阶段: ${formatStageLabel(stage)}`
    }

    function showSpeechBubble(_id: TradingAgentId, _text: string, _options?: SpeechBubbleOptions): void {
      /* bubble disabled this round */
    }

    function setAgentState(id: TradingAgentId, state: AgentVisualState, _message?: string): void {
      const p = persons.get(id)
      if (!p) return
      p.setState(state)
    }

    function moveAgent(id: TradingAgentId, x: number, y: number, run = false): Promise<void> {
      return persons.get(id)?.moveTo(x, y, { run }) ?? Promise.resolve()
    }

    function moveAgentHome(id: TradingAgentId): Promise<void> {
      return persons.get(id)?.moveHome() ?? Promise.resolve()
    }

    function moveAgentToPoint(
      id: TradingAgentId,
      point: 'home' | 'work' | 'meeting' | 'debate' | 'trader' | 'risk' | 'decision',
      run = false,
    ): Promise<void> {
      const pts = AGENT_POSITIONS[id]
      const target = pts?.[point] ?? pts?.home
      if (!target) return Promise.resolve()
      return moveAgent(id, target.x, target.y, run)
    }

    function highlightZone(zone: ZoneId | null): void {
      if (activeZone && zoneGfx.has(activeZone)) {
        const z = SCENE_ZONES[activeZone]
        const g = zoneGfx.get(activeZone)!
        g.clear()
        g.roundRect(z.x, z.y, z.width, z.height, 12).fill({ color: z.floorColor, alpha: 0.72 })
        g.roundRect(z.x, z.y, z.width, z.height, 12).stroke({ width: 1, color: 0xd1d9e2, alpha: 0.55 })
      }
      activeZone = zone
      if (zone && zone !== 'tickerBoard' && zoneGfx.has(zone)) {
        const z = SCENE_ZONES[zone]
        const g = zoneGfx.get(zone)!
        g.clear()
        g.roundRect(z.x, z.y, z.width, z.height, 12).fill({ color: z.floorColor, alpha: 0.92 })
        g.roundRect(z.x, z.y, z.width, z.height, 12).stroke({ width: 1.5, color: 0x38bdf8, alpha: 0.55 })
      }
    }

    async function showHandoffTrail(fromId: TradingAgentId, toX: number, toY: number): Promise<void> {
      const from = persons.get(fromId)?.getPosition()
      if (!from) return
      handoffGfx.clear()
      handoffGfx.moveTo(from.x, from.y).lineTo(toX, toY)
      handoffGfx.stroke({ width: 2, color: 0xeab308, alpha: 0.75 })
      handoffGfx.circle(toX, toY, 5).fill({ color: 0xeab308, alpha: 0.55 })
      await new Promise((r) => window.setTimeout(r, 900))
      handoffGfx.clear()
    }

    async function resetAllHomes(): Promise<void> {
      await Promise.all([...persons.keys()].map((id) => moveAgentHome(id)))
      for (const p of persons.values()) p.setState('idle')
    }

    function layout(width: number, height: number): void {
      const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT)
      root.scale.set(scale)
      root.x = (width - SCENE_WIDTH * scale) / 2
      root.y = (height - SCENE_HEIGHT * scale) / 2
    }

    function tick(_dt: number): void { /* RAF */ }

    function destroy(): void {
      cancelAnimationFrame(rafId)
    }

    const controller: TradingSceneController = {
      container: root,
      layout,
      tick,
      destroy,
      setTicker,
      getPerson,
      setAgentState,
      showSpeechBubble,
      moveAgent,
      moveAgentHome,
      moveAgentToPoint,
      highlightZone,
      showHandoffTrail,
      resetAllHomes,
    }

    ;(controller as TradingSceneController & {
      setAgentStatus: typeof setAgentState
      showBubble: (id: TradingAgentId, text: string) => Promise<void>
      moveAgentToZone: (id: TradingAgentId, zone: string) => Promise<void>
      getAgentPosition: (id: TradingAgentId) => { x: number; y: number }
    }).setAgentStatus = (id, _status, text) => setAgentState(id, 'working', text)
    ;(controller as TradingSceneController & { showBubble: (id: TradingAgentId, text: string) => Promise<void> }).showBubble =
      async (id, text) => {
        showSpeechBubble(id, text, { type: 'talking' })
        await new Promise((r) => window.setTimeout(r, 1200))
      }
    ;(controller as TradingSceneController & { moveAgentToZone: (id: TradingAgentId, zone: string) => Promise<void> }).moveAgentToZone =
      (id, zone) => {
        const z = SCENE_ZONES[zone as ZoneKey]
        if (!z) return Promise.resolve()
        return moveAgent(id, z.x + z.width / 2, z.y + z.height * 0.72)
      }
    ;(controller as TradingSceneController & { getAgentPosition: (id: TradingAgentId) => { x: number; y: number } }).getAgentPosition =
      (id) => persons.get(id)?.getPosition() ?? { x: 0, y: 0 }

    return controller as TradingSceneController & {
      setAgentStatus: (id: TradingAgentId, status: string, text?: string) => void
      showBubble: (id: TradingAgentId, text: string) => Promise<void>
      moveAgentToZone: (id: TradingAgentId, zone: string, slot?: string) => Promise<void>
      getAgentPosition: (id: TradingAgentId) => { x: number; y: number }
    }
  }

  return { createScene }
}

export { SCENE_WIDTH, SCENE_HEIGHT }
