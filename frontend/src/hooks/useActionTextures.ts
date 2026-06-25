import { Assets, Spritesheet, Texture } from 'pixi.js'
import type { SpritesheetData } from 'pixi.js'
import { getMarvisActionAsset, type MarvisActionName } from '../assets/marvis/tradingActions'

const agentImageModules = import.meta.glob<string>('../assets/marvis/agent/*@2x.webp', {
  import: 'default',
  query: '?url',
})
const agentSheetModules = import.meta.glob<SpritesheetData>('../assets/marvis/agent/*@2x.webp.json', {
  import: 'default',
})

export type ActionTextureLoader = {
  loadActionTextures: (actionName: MarvisActionName, options?: LoadActionTextureOptions) => Promise<Texture[]>
}

export type LoadActionTextureOptions = {
  replaceDefaultRedWith?: string
}

export function useActionTextures(): ActionTextureLoader {
  const actionTextures = new Map<string, Texture[]>()

  async function loadActionTextures(
    actionName: MarvisActionName,
    options: LoadActionTextureOptions = {},
  ): Promise<Texture[]> {
    const cacheKey = `${actionName}:${options.replaceDefaultRedWith ?? 'default'}`
    const cached = actionTextures.get(cacheKey)
    if (cached) return cached

    const asset = getMarvisActionAsset(actionName)
    const imageModule = agentImageModules[`../assets/${asset.imagePath}`]
    const sheetModule = agentSheetModules[`../assets/${asset.jsonPath}`]

    if (!imageModule || !sheetModule) {
      throw new Error(`Missing marvis action asset: ${actionName}`)
    }

    const imageUrl = await imageModule()
    const sheetData = await sheetModule()
    const baseTexture = options.replaceDefaultRedWith
      ? await createRedReplacedTexture(imageUrl, options.replaceDefaultRedWith)
      : await Assets.load<Texture>(imageUrl)
    const spritesheet = new Spritesheet(baseTexture, sheetData)
    await spritesheet.parse()

    const textures = Object.entries(spritesheet.textures)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, texture]) => texture)

    actionTextures.set(cacheKey, textures)
    return textures
  }

  return { loadActionTextures }
}

function toRgb(color: string): [number, number, number] {
  const value = Number.parseInt(color.replace('#', ''), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function shouldReplaceDefaultRed(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha < 24) return false
  return red > 90 && red > green * 1.45 && red > blue * 1.45 && green < 110 && blue < 110
}

async function createRedReplacedTexture(imageUrl: string, color: string): Promise<Texture> {
  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create canvas context for recolored sprite')

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  context.drawImage(image, 0, 0)

  const [targetRed, targetGreen, targetBlue] = toRgb(color)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (!shouldReplaceDefaultRed(red, green, blue, alpha)) continue
    const shade = Math.min(1.25, Math.max(0.25, red / 229))
    data[index] = Math.min(255, Math.round(targetRed * shade))
    data[index + 1] = Math.min(255, Math.round(targetGreen * shade))
    data[index + 2] = Math.min(255, Math.round(targetBlue * shade))
  }

  context.putImageData(imageData, 0, 0)
  return Texture.from(canvas)
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image: ${imageUrl}`))
    image.src = imageUrl
  })
}
