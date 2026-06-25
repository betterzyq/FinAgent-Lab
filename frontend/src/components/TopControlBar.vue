<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { searchSymbols } from '../api/tradingApi'
import { useRunStore, type AnalysisDepth } from '../stores/runStore'

const runStore = useRunStore()
const { isRunning, connectionStatus } = storeToRefs(runStore)

const symbol = ref('600519')
const companyName = ref('贵州茅台')
const tradeDate = ref(new Date().toISOString().slice(0, 10))
const analysisDepth = ref<AnalysisDepth>('standard')
const debateRounds = ref(2)
const riskRounds = ref(2)
const mockBackend = ref(true)
const localMockOnly = ref(false)

const connectionLabel = computed(() => {
  const map = {
    unknown: '检测中…',
    connected: '已连接',
    disconnected: '未连接',
    error: '连接异常',
  } as const
  return map[connectionStatus.value]
})

const connectionClass = computed(() => `conn conn--${connectionStatus.value}`)

let searchTimer: number | undefined

watch(symbol, (val) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(async () => {
    if (val.length < 2) return
    try {
      const items = await searchSymbols(val)
      const hit = items.find((i) => i.symbol === val || i.display.startsWith(val))
      if (hit) companyName.value = hit.name
    } catch {
      /* offline */
    }
  }, 400)
})

onMounted(() => {
  void runStore.probeBackend()
})

async function onStart() {
  await runStore.startRun(
    {
      symbol: symbol.value,
      company_name: companyName.value,
      trade_date: tradeDate.value,
      analysis_depth: analysisDepth.value,
      debate_rounds: debateRounds.value,
      risk_rounds: riskRounds.value,
    },
    { mock: mockBackend.value, localMock: localMockOnly.value },
  )
}

function onReset() {
  runStore.resetRun()
}
</script>

<template>
  <header class="top-bar glass">
    <div class="top-bar__brand">
      <span class="top-bar__logo">⬡</span>
      <div>
        <h1>Agent Trading Floor</h1>
        <p class="top-bar__sub">A股智能投研交易室 · 仅供研究演示，不构成任何投资建议</p>
      </div>
    </div>

    <div class="top-bar__controls">
      <label class="field">
        <span>代码</span>
        <input v-model="symbol" placeholder="600519" :disabled="isRunning" />
      </label>
      <label class="field">
        <span>名称</span>
        <input v-model="companyName" placeholder="贵州茅台" :disabled="isRunning" />
      </label>
      <label class="field">
        <span>日期</span>
        <input v-model="tradeDate" type="date" :disabled="isRunning" />
      </label>
      <label class="field">
        <span>深度</span>
        <select v-model="analysisDepth" :disabled="isRunning">
          <option value="quick">快速</option>
          <option value="standard">标准</option>
          <option value="deep">深度</option>
        </select>
      </label>
      <label class="field field--sm">
        <span>辩论</span>
        <input v-model.number="debateRounds" type="number" min="1" max="5" :disabled="isRunning" />
      </label>
      <label class="field field--sm">
        <span>风控</span>
        <input v-model.number="riskRounds" type="number" min="1" max="5" :disabled="isRunning" />
      </label>
      <label class="toggle">
        <input v-model="mockBackend" type="checkbox" :disabled="isRunning" />
        后端 Mock
      </label>
      <label class="toggle">
        <input v-model="localMockOnly" type="checkbox" :disabled="isRunning" />
        纯前端 Mock
      </label>
      <span :class="connectionClass">{{ connectionLabel }}</span>
      <button class="btn btn--primary" :disabled="isRunning" @click="onStart">启动分析</button>
      <button class="btn btn--ghost" @click="onReset">重置</button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.top-bar__brand {
  display: flex;
  gap: 10px;
  align-items: center;
}

.top-bar__brand h1 {
  margin: 0;
  font-size: 16px;
  color: #e2e8f0;
  font-weight: 700;
}

.top-bar__sub {
  margin: 2px 0 0;
  font-size: 11px;
  color: #64748b;
}

.top-bar__logo {
  font-size: 22px;
  color: #38bdf8;
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
}

.top-bar__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #94a3b8;
}

.field input,
.field select {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  color: #e2e8f0;
  padding: 6px 8px;
  min-width: 100px;
  font-size: 13px;
}

.field--sm input {
  min-width: 52px;
  width: 52px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
  padding-bottom: 6px;
}

.conn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  margin-bottom: 6px;
}

.conn--connected { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.conn--disconnected { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.conn--error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.conn--unknown { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

.btn {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 2px;
}

.btn--primary {
  background: linear-gradient(135deg, #2563eb, #38bdf8);
  color: #fff;
  font-weight: 600;
}

.btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--ghost {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #cbd5e1;
}
</style>
