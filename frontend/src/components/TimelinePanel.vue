<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRunStore } from '../stores/runStore'

const runStore = useRunStore()
const { timeline, runStatus, error } = storeToRefs(runStore)
</script>

<template>
  <footer class="timeline-panel glass">
    <h2 class="panel-title">任务时间线</h2>
    <div v-if="error" class="timeline-error">{{ error }}</div>
    <ul class="timeline-list">
      <li
        v-for="item in timeline"
        :key="item.id"
        class="timeline-item"
        :class="{ 'timeline-item--fail': !item.success }"
      >
        <span class="timeline-time">{{ item.timestamp.slice(11, 19) }}</span>
        <span class="timeline-type">{{ item.eventType }}</span>
        <span class="timeline-agent">{{ item.agentName ?? '—' }}</span>
        <span class="timeline-desc">{{ item.description }}</span>
      </li>
      <li v-if="timeline.length === 0" class="timeline-empty">等待事件…</li>
      <li v-if="runStatus === 'finished'" class="timeline-done">✓ 分析完成</li>
    </ul>
  </footer>
</template>

<style scoped>
.timeline-panel {
  padding: 8px 12px;
  max-height: 160px;
  overflow: auto;
}

.panel-title {
  margin: 0 0 6px;
  font-size: 12px;
  color: #94a3b8;
}

.timeline-error {
  color: #f87171;
  font-size: 11px;
  margin-bottom: 6px;
}

.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 64px 120px 100px 1fr;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.35);
}

.timeline-item--fail {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.timeline-type { color: #38bdf8; font-family: Consolas, monospace; }
.timeline-agent { color: #cbd5e1; }
.timeline-empty, .timeline-done {
  font-size: 11px;
  color: #64748b;
  padding: 4px;
}

.timeline-done { color: #4ade80; }
</style>
