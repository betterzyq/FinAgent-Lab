<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { TRADING_ROLES } from '../assets/agent/tradingRoles'
import { useRunStore } from '../stores/runStore'
import type { TradingAgentId } from '../types/agent'

const runStore = useRunStore()
const { agents, selectedAgentId } = storeToRefs(runStore)

const statusClass = (status: string) => `status-dot status-dot--${status}`

function select(id: TradingAgentId) {
  runStore.selectAgent(id)
}
</script>

<template>
  <aside class="agent-panel glass">
    <h2 class="panel-title">Agent 状态</h2>
    <ul class="agent-list">
      <li
        v-for="role in TRADING_ROLES"
        :key="role.id"
        class="agent-item"
        :class="{ 'agent-item--active': selectedAgentId === role.id }"
        @click="select(role.id)"
      >
        <span class="agent-item__avatar" :style="{ borderColor: role.color }">{{ role.avatarEmoji }}</span>
        <div class="agent-item__body">
          <div class="agent-item__row">
            <strong>{{ role.name }}</strong>
            <span :class="statusClass(agents[role.id]?.visualStatus ?? 'idle')" />
          </div>
          <div class="agent-item__meta">{{ role.team }} · {{ agents[role.id]?.visualStatus }}</div>
          <div v-if="agents[role.id]?.currentTask" class="agent-item__task">{{ agents[role.id].currentTask }}</div>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.agent-panel {
  padding: 12px;
  overflow: auto;
  height: 100%;
}

.panel-title {
  margin: 0 0 10px;
  font-size: 13px;
  color: #94a3b8;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.agent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.agent-item:hover,
.agent-item--active {
  background: rgba(56, 189, 248, 0.08);
  border-color: rgba(56, 189, 248, 0.25);
}

.agent-item__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid;
  display: grid;
  place-items: center;
  font-size: 16px;
  background: rgba(15, 23, 42, 0.6);
  flex-shrink: 0;
}

.agent-item__body { min-width: 0; flex: 1; }

.agent-item__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.agent-item__row strong {
  font-size: 12px;
  color: #e2e8f0;
}

.agent-item__meta {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.agent-item__task {
  font-size: 10px;
  color: #38bdf8;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--idle { background: #475569; }
.status-dot--working { background: #38bdf8; box-shadow: 0 0 6px #38bdf8; }
.status-dot--moving { background: #eab308; }
.status-dot--debating { background: #f97316; }
.status-dot--deciding { background: #c084fc; box-shadow: 0 0 6px #c084fc; }
.status-dot--finished { background: #22c55e; }
.status-dot--error { background: #ef4444; }
</style>
