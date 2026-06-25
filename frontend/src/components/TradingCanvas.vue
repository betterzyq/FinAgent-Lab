<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Application } from 'pixi.js'
import { storeToRefs } from 'pinia'
import { useEventDrivenAnimation } from '../hooks/useEventDrivenAnimation'
import { useTradingOrchestrator } from '../hooks/useTradingOrchestrator'
import { useTradingScene, type TradingSceneController } from '../hooks/useTradingScene'
import { useRunStore } from '../stores/runStore'

const mountRef = ref<HTMLDivElement | null>(null)
const isReady = ref(false)

let app: Application | null = null
let scene: TradingSceneController | null = null
let resizeObserver: ResizeObserver | null = null

const runStore = useRunStore()
const { lastEvent, taskInfo } = storeToRefs(runStore)

const orchestrator = useTradingOrchestrator()
const { createScene } = useTradingScene()
let anim: ReturnType<typeof useEventDrivenAnimation> | null = null

onMounted(async () => {
  const el = mountRef.value
  if (!el) return

  app = new Application()
  await app.init({
    antialias: true,
    background: '#eef1f5',
    width: el.clientWidth,
    height: el.clientHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  el.appendChild(app.canvas)

  scene = await createScene()
  anim = useEventDrivenAnimation(scene, orchestrator)
  app.stage.addChild(scene.container)

  const resize = () => {
    if (!app || !scene || !el) return
    app.renderer.resize(el.clientWidth, el.clientHeight)
    scene.layout(el.clientWidth, el.clientHeight)
  }
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  isReady.value = true
})

watch(lastEvent, (event) => {
  if (!event || !anim) return
  void anim.handleEvent(event, taskInfo.value ?? undefined)
})

watch(taskInfo, (info) => {
  if (!info || !scene) return
  scene.setTicker(info.symbol, info.companyName, info.tradeDate, info.stage)
}, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  scene?.destroy()
  app?.destroy(true, { children: true })
  app = null
  scene = null
})
</script>

<template>
  <div ref="mountRef" class="trading-canvas" :class="{ 'trading-canvas--ready': isReady }">
    <div v-if="!isReady" class="trading-canvas__loading">加载交易大厅…</div>
  </div>
</template>

<style scoped>
.trading-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: #eef1f5;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.2);
  box-shadow: 0 0 40px rgba(56, 189, 248, 0.08) inset;
}

.trading-canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.trading-canvas__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #94a3b8;
  font-size: 14px;
}
</style>
