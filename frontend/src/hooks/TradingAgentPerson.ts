/**
 * Marvis pony agent — feet at container origin, label directly below.
 */

import { AnimatedSprite, Container, Text } from 'pixi.js'
import { Easing, Tween } from '@tweenjs/tween.js'
import { LABEL_OFFSETS } from '../assets/agent/sceneLayout'
import {
  ACTION_SPEED,
  VISUAL_STATE_ACTION,
  type MarvisActionName,
} from '../assets/marvis/tradingActions'
import type { ActionTextureLoader } from './useActionTextures'

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

export type TradingAgentPersonOptions = {
  name: string
  scarfColor: string
  homeX: number
  homeY: number
  scale?: number
  labelFontSize?: number
}

export const PERSON_SCALE = 0.34
const DEFAULT_SPEED = 0.32

function runTween<T extends object>(tween: Tween<T>): Promise<void> {
  return new Promise((resolve) => {
    let frameId = 0
    let done = false
    const finish = () => {
      if (done) return
      done = true
      cancelAnimationFrame(frameId)
      resolve()
    }
    const tick = (time: number) => {
      if (tween.update(time) && !done) {
        frameId = requestAnimationFrame(tick)
        return
      }
      finish()
    }
    tween.onComplete(finish)
    tween.start(performance.now())
    frameId = requestAnimationFrame(tick)
  })
}

export class TradingAgentPerson {
  readonly container: Container
  readonly homeX: number
  readonly homeY: number

  private spriteRoot = new Container()
  private labelRoot = new Container()
  private label: Text
  private errorMark: Text
  private sprite: AnimatedSprite | null = null
  private textureLoader: ActionTextureLoader
  private scarfColor: string
  private personScale: number
  private state: AgentVisualState = 'idle'
  private currentAction: MarvisActionName = 'standby'
  private lazyTimer = 0
  private facing = 1

  private constructor(opts: TradingAgentPersonOptions, textureLoader: ActionTextureLoader) {
    this.textureLoader = textureLoader
    this.scarfColor = opts.scarfColor
    this.homeX = opts.homeX
    this.homeY = opts.homeY
    this.personScale = opts.scale ?? PERSON_SCALE

    this.container = new Container()
    this.container.x = opts.homeX
    this.container.y = opts.homeY

    this.spriteRoot.scale.set(this.personScale)
    this.labelRoot.y = LABEL_OFFSETS.y

    this.label = new Text({
      text: opts.name,
      style: {
        fill: '#1e293b',
        fontSize: opts.labelFontSize ?? 12,
        fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
        fontWeight: '600',
        lineHeight: (opts.labelFontSize ?? 12) + 1,
        dropShadow: {
          alpha: 0.55,
          angle: Math.PI / 2,
          blur: 1,
          color: '#ffffff',
          distance: 1,
        },
      },
    })
    this.label.anchor.set(0.5, 0)

    this.errorMark = new Text({
      text: '!',
      style: { fill: '#ef4444', fontSize: 16, fontWeight: '700' },
    })
    this.errorMark.anchor.set(0.5, 1)
    this.errorMark.y = -62
    this.errorMark.visible = false

    this.container.addChild(this.spriteRoot, this.labelRoot, this.errorMark)
    this.labelRoot.addChild(this.label)
  }

  static async create(
    opts: TradingAgentPersonOptions,
    textureLoader: ActionTextureLoader,
  ): Promise<TradingAgentPerson> {
    const person = new TradingAgentPerson(opts, textureLoader)
    await person.playAction('standby')
    return person
  }

  setState(state: AgentVisualState): void {
    this.state = state
    this.errorMark.visible = state === 'error'
    if (state !== 'lazy') this.lazyTimer = 0
    if (state === 'working' || state === 'debating' || state === 'talking') this.lazyTimer = 0
    void this.playAction(VISUAL_STATE_ACTION[state] ?? 'standby')
  }

  getState(): AgentVisualState {
    return this.state
  }

  tick(dt: number): void {
    if (this.state === 'idle') {
      this.lazyTimer += dt
      if (this.lazyTimer > 10) this.setState('lazy')
    }
  }

  async moveTo(x: number, y: number, options?: { speed?: number; run?: boolean }): Promise<void> {
    const run = options?.run ?? false
    this.facing = x >= this.container.x ? 1 : -1
    this.setState(run ? 'running' : 'walking')

    const dist = Math.hypot(x - this.container.x, y - this.container.y)
    const speed = options?.speed ?? (run ? 0.5 : 0.3)
    const duration = Math.max(400, Math.min(2400, dist / speed))

    await runTween(new Tween(this.container).to({ x, y }, duration).easing(Easing.Quadratic.InOut))
    this.setState('idle')
  }

  async moveHome(): Promise<void> {
    await this.moveTo(this.homeX, this.homeY)
  }

  say(_text: string, _duration = 2800): void { /* no-op */ }
  showWorking(_toolName?: string): void { this.setState('working') }
  showThinking(_text = '思考中…'): void { this.setState('working') }
  showLazy(): void { this.setState('lazy') }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y }
  }

  /** Feet at container origin (0,0); label fixed offset below. */
  private mountSprite(sprite: AnimatedSprite): void {
    sprite.anchor.set(0.5, 1)
    sprite.x = 0
    sprite.y = 0
    sprite.scale.x = this.facing
    this.spriteRoot.addChild(sprite)
    this.labelRoot.y = LABEL_OFFSETS.y
  }

  private async playAction(actionName: MarvisActionName): Promise<void> {
    if (this.currentAction === actionName && this.sprite?.playing) return
    this.currentAction = actionName

    const textures = await this.textureLoader.loadActionTextures(actionName, {
      replaceDefaultRedWith: this.scarfColor,
    })

    const prev = this.sprite
    const next = new AnimatedSprite(textures)
    next.animationSpeed = ACTION_SPEED[actionName] ?? DEFAULT_SPEED
    next.loop = true
    next.play()

    this.spriteRoot.removeChildren()
    this.mountSprite(next)
    this.sprite = next
    prev?.destroy()
  }
}
