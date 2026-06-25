/**
 * Furniture drawing helpers — light marvis-office style trading floor.
 */

import { Graphics } from 'pixi.js'
import type { DeskRect, MeetingTableRect } from './sceneLayout'

export function drawAnalystDesk(g: Graphics, desk: DeskRect): void {
  const { x, y, width: w, height: h } = desk
  g.roundRect(x - w / 2, y, w, h, 5)
    .fill({ color: 0xf8fafc, alpha: 0.98 })
  g.roundRect(x - w / 2, y, w, h, 5)
    .stroke({ width: 1, color: 0xcad5e1, alpha: 0.9 })
  g.roundRect(x - w / 2 + 8, y + 6, w - 16, 16, 3)
    .fill({ color: 0x0ea5e9, alpha: 0.18 })
  g.roundRect(x - 12, y + h - 2, 24, 10, 3)
    .fill({ color: 0xe2e8f0, alpha: 0.95 })
}

export function drawResearchDebateTable(g: Graphics, table: MeetingTableRect): void {
  const { cx, cy, width: w, height: h } = table
  g.ellipse(cx, cy, w / 2, h / 2)
    .fill({ color: 0xf1f5f9, alpha: 0.95 })
  g.ellipse(cx, cy, w / 2, h / 2)
    .stroke({ width: 1.5, color: 0x94a3b8, alpha: 0.7 })
  g.ellipse(cx - w * 0.15, cy - h * 0.2, w * 0.12, h * 0.08)
    .fill({ color: 0xffffff, alpha: 0.45 })
  g.roundRect(cx - 14, cy - 6, 28, 18, 3)
    .fill({ color: 0x1e293b, alpha: 0.12 })
  g.roundRect(cx - 10, cy - 3, 20, 12, 2)
    .fill({ color: 0x38bdf8, alpha: 0.25 })
}

export function drawRiskRoundTable(g: Graphics, table: MeetingTableRect): void {
  const { cx, cy, width: w, height: h } = table
  g.ellipse(cx, cy, w / 2, h / 2)
    .fill({ color: 0xf1f5f9, alpha: 0.95 })
  g.ellipse(cx, cy, w / 2, h / 2)
    .stroke({ width: 1.5, color: 0x94a3b8, alpha: 0.7 })
  g.ellipse(cx - w * 0.12, cy - h * 0.18, w * 0.1, h * 0.07)
    .fill({ color: 0xffffff, alpha: 0.45 })
  g.roundRect(cx - 12, cy - 5, 24, 16, 3)
    .fill({ color: 0x1e293b, alpha: 0.1 })
}

export function drawTraderDesk(g: Graphics, desk: DeskRect): void {
  const { x, y, width: w, height: h } = desk
  g.roundRect(x - w / 2, y, w, h, 5)
    .fill({ color: 0xf8fafc, alpha: 0.98 })
  g.roundRect(x - w / 2, y, w, h, 5)
    .stroke({ width: 1, color: 0xcad5e1, alpha: 0.9 })
  g.roundRect(x - w / 2 + 10, y + 5, w - 20, 22, 3)
    .fill({ color: 0x0f172a, alpha: 0.85 })
  g.roundRect(x - w / 2 + 14, y + 9, (w - 28) * 0.45, 14, 2)
    .fill({ color: 0x22c55e, alpha: 0.35 })
  g.roundRect(x - w / 2 + 14 + (w - 28) * 0.5, y + 9, (w - 28) * 0.45, 14, 2)
    .fill({ color: 0xef4444, alpha: 0.35 })
}

export function drawPmDesk(g: Graphics, desk: DeskRect): void {
  drawAnalystDesk(g, desk)
}

export function drawCommandConsole(g: Graphics, desk: DeskRect): void {
  const { x, y, width: w, height: h } = desk
  g.roundRect(x - w / 2, y, w, h, 5)
    .fill({ color: 0xf1f5f9, alpha: 0.98 })
  g.roundRect(x - w / 2, y, w, h, 5)
    .stroke({ width: 1, color: 0x94a3b8, alpha: 0.8 })
  g.roundRect(x - w / 2 + 6, y + 5, w - 12, 14, 2)
    .fill({ color: 0x1e293b, alpha: 0.15 })
  g.roundRect(x - w / 2 + 10, y + 7, w - 20, 10, 2)
    .fill({ color: 0x38bdf8, alpha: 0.3 })
}
