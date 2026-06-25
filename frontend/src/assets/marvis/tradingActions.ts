/** Marvis pony sprite actions used by the trading floor. */

export const tradingActionNames = [
  'standby',
  'working',
  'fc_walking_h',
  'running_treadmill',
  'sleeping',
  'talking_on_stand-0',
  'talking_on_stand-1',
] as const

export type MarvisActionName = (typeof tradingActionNames)[number]

export interface MarvisActionAsset {
  name: MarvisActionName
  imagePath: string
  jsonPath: string
}

export function getMarvisActionAsset(name: MarvisActionName): MarvisActionAsset {
  return {
    name,
    imagePath: `marvis/agent/${name}@2x.webp`,
    jsonPath: `marvis/agent/${name}@2x.webp.json`,
  }
}

export const VISUAL_STATE_ACTION: Record<string, MarvisActionName> = {
  idle: 'standby',
  waiting: 'standby',
  finished: 'standby',
  walking: 'fc_walking_h',
  running: 'running_treadmill',
  working: 'working',
  debating: 'talking_on_stand-0',
  talking: 'talking_on_stand-0',
  lazy: 'sleeping',
  error: 'standby',
}

export const ACTION_SPEED: Partial<Record<MarvisActionName, number>> = {
  fc_walking_h: 0.35,
  running_treadmill: 0.55,
  working: 0.28,
  sleeping: 0.18,
  'talking_on_stand-0': 0.32,
}
