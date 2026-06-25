import { Container, Graphics, Text } from 'pixi.js'

export type SpeechBubbleType = 'talking' | 'working' | 'thinking' | 'handoff'

export type SpeechBubbleOptions = {
  type?: SpeechBubbleType
  maxWidth?: number
  duration?: number
  headOffsetY?: number
}

const BUBBLE_STYLE: Record<SpeechBubbleType, { fill: number; stroke: number; text: string }> = {
  talking: { fill: 0xffffff, stroke: 0xcbd5e1, text: '#1e293b' },
  working: { fill: 0xe0f2fe, stroke: 0x7dd3fc, text: '#0c4a6e' },
  thinking: { fill: 0xf1f5f9, stroke: 0xcbd5e1, text: '#475569' },
  handoff: { fill: 0xfef9c3, stroke: 0xfacc15, text: '#713f12' },
}

const PAD = 8
const TAIL = 7
const FONT = 12
const MAX_CHARS = 48

export class SpeechBubble {
  readonly container = new Container()
  private bg = new Graphics()
  private textObj: Text
  private timer = 0
  private headOffsetY = -52

  constructor() {
    this.textObj = new Text({
      text: '',
      style: {
        fill: '#1e293b',
        fontSize: FONT,
        fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
        wordWrap: true,
        lineHeight: FONT + 4,
      },
    })
    this.textObj.anchor.set(0, 0)
    this.container.addChild(this.bg, this.textObj)
    this.container.visible = false
  }

  show(rawText: string, options: SpeechBubbleOptions = {}): void {
    const type = options.type ?? 'talking'
    const maxWidth = options.maxWidth ?? 168
    this.headOffsetY = options.headOffsetY ?? -52
    const style = BUBBLE_STYLE[type]

    const text = rawText.length > MAX_CHARS ? `${rawText.slice(0, MAX_CHARS - 1)}…` : rawText
    this.textObj.style.fill = style.text
    this.textObj.style.wordWrapWidth = maxWidth - PAD * 2
    this.textObj.text = text

    const textW = Math.ceil(this.textObj.width)
    const textH = Math.ceil(this.textObj.height)
    const w = Math.min(maxWidth, Math.max(56, textW + PAD * 2))
    const h = textH + PAD * 2
    const left = -w / 2
    const top = this.headOffsetY - h - TAIL

    this.bg.clear()
    this.bg.roundRect(left, top, w, h, 8).fill({ color: style.fill, alpha: 0.97 })
    this.bg.roundRect(left, top, w, h, 8).stroke({ width: 1, color: style.stroke, alpha: 0.9 })
    this.bg.moveTo(-5, top + h)
    this.bg.lineTo(0, top + h + TAIL)
    this.bg.lineTo(5, top + h)
    this.bg.closePath()
    this.bg.fill({ color: style.fill, alpha: 0.97 })
    this.bg.stroke({ width: 1, color: style.stroke, alpha: 0.9 })

    this.textObj.x = left + PAD
    this.textObj.y = top + PAD
    this.container.visible = true

    window.clearTimeout(this.timer)
    const duration = options.duration ?? 2800
    this.timer = window.setTimeout(() => this.hide(), duration)
  }

  hide(): void {
    this.container.visible = false
    window.clearTimeout(this.timer)
  }

  updateHeadOffset(y: number): void {
    this.headOffsetY = y
  }
}
