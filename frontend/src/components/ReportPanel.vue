<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { TRADING_ROLES } from '../assets/agent/tradingRoles'
import { useRunStore } from '../stores/runStore'

const runStore = useRunStore()
const { reportsByAgent, selectedAgentId, selectedReport } = storeToRefs(runStore)

const reportSections = computed(() =>
  TRADING_ROLES.filter((r) => reportsByAgent.value[r.id]).map((r) => ({
    id: r.id,
    name: r.name,
    content: reportsByAgent.value[r.id],
  })),
)
</script>

<template>
  <section class="report-panel glass">
    <h2 class="panel-title">报告与决策</h2>

    <div v-if="selectedAgentId && selectedReport" class="report-card report-card--active">
      <h3>{{ TRADING_ROLES.find((r) => r.id === selectedAgentId)?.name }} 报告</h3>
      <pre class="report-body">{{ selectedReport }}</pre>
    </div>

    <div v-if="reportSections.length === 0" class="empty">暂无报告，启动分析后将在此展示</div>

    <div v-for="sec in reportSections" :key="sec.id" class="report-card">
      <h3>{{ sec.name }}</h3>
      <pre class="report-body">{{ sec.content }}</pre>
    </div>
  </section>
</template>

<style scoped>
.report-panel {
  padding: 12px;
  overflow: auto;
  height: 100%;
}

.panel-title {
  margin: 0 0 10px;
  font-size: 13px;
  color: #94a3b8;
  font-weight: 600;
}

.report-card {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.report-card--active {
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.08);
}

.report-card h3 {
  margin: 0 0 6px;
  font-size: 12px;
  color: #cbd5e1;
}

.report-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.5;
  color: #94a3b8;
  font-family: Consolas, 'Segoe UI', sans-serif;
}

.empty {
  color: #64748b;
  font-size: 12px;
  padding: 20px 0;
  text-align: center;
}
</style>
