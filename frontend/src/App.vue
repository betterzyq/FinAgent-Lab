<script setup lang="ts">
import { ref } from 'vue'
import TopControlBar from './components/TopControlBar.vue'
import AgentStatusPanel from './components/AgentStatusPanel.vue'
import TradingCanvas from './components/TradingCanvas.vue'
import ReportPanel from './components/ReportPanel.vue'
import DebatePanel from './components/DebatePanel.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import FinalDecisionCard from './components/FinalDecisionCard.vue'

const rightTab = ref<'reports' | 'debate'>('reports')
</script>

<template>
  <div class="app-shell">
    <TopControlBar />

    <div class="app-main">
      <AgentStatusPanel class="app-side app-side--left" />

      <main class="app-center">
        <TradingCanvas />
      </main>

      <aside class="app-side app-side--right glass">
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': rightTab === 'reports' }"
            @click="rightTab = 'reports'"
          >
            报告
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': rightTab === 'debate' }"
            @click="rightTab = 'debate'"
          >
            辩论
          </button>
        </div>
        <ReportPanel v-show="rightTab === 'reports'" />
        <DebatePanel v-show="rightTab === 'debate'" />
      </aside>
    </div>

    <TimelinePanel />
    <FinalDecisionCard />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: 8px;
  padding: 0 8px 8px;
}

.app-side {
  min-height: 0;
  border-radius: 12px;
}

.app-side--left {
  overflow: hidden;
}

.app-side--right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-center {
  min-height: 0;
  min-width: 0;
}

.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #64748b;
  padding: 6px;
  font-size: 12px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
}

.tab-btn--active {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

@media (max-width: 1100px) {
  .app-main {
    grid-template-columns: 200px 1fr;
    grid-template-rows: 1fr auto;
  }

  .app-side--right {
    grid-column: 1 / -1;
    max-height: 220px;
  }
}
</style>
