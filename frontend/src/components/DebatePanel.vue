<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRunStore } from '../stores/runStore'

const runStore = useRunStore()
const { debateMessages, riskDebateMessages } = storeToRefs(runStore)
</script>

<template>
  <section class="debate-panel">
    <div class="debate-block">
      <h3 class="debate-title debate-title--bull">Research Debate · 多空辩论</h3>
      <div class="debate-columns">
        <div class="debate-col debate-col--bull">
          <h4>多头 🐂</h4>
          <div
            v-for="m in debateMessages.filter((x) => x.side === 'bull' || x.agentId === 'bullish_researcher')"
            :key="m.id"
            class="bubble bubble--bull"
          >
            {{ m.content }}
          </div>
          <div v-if="debateMessages.filter((x) => x.side === 'bull').length === 0" class="empty">等待多头观点…</div>
        </div>
        <div class="debate-col debate-col--bear">
          <h4>空头 🐻</h4>
          <div
            v-for="m in debateMessages.filter((x) => x.side === 'bear' || x.agentId === 'bearish_researcher')"
            :key="m.id"
            class="bubble bubble--bear"
          >
            {{ m.content }}
          </div>
          <div v-if="debateMessages.filter((x) => x.side === 'bear').length === 0" class="empty">等待空头观点…</div>
        </div>
      </div>
    </div>

    <div class="debate-block">
      <h3 class="debate-title debate-title--risk">Risk Debate · 风控辩论</h3>
      <div class="risk-columns">
        <div v-for="side in ['aggressive', 'neutral', 'conservative'] as const" :key="side" class="risk-col">
          <h4>{{ side }}</h4>
          <div
            v-for="m in riskDebateMessages.filter((x) => x.side === side)"
            :key="m.id"
            class="bubble bubble--risk"
          >
            {{ m.content }}
          </div>
          <div v-if="!riskDebateMessages.some((x) => x.side === side)" class="empty">—</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.debate-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: auto;
  height: 100%;
}

.debate-block {
  background: rgba(15, 23, 42, 0.45);
  border-radius: 8px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.debate-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.debate-title--bull { color: #f87171; }
.debate-title--risk { color: #94a3b8; }

.debate-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.debate-col h4,
.risk-col h4 {
  margin: 0 0 6px;
  font-size: 11px;
  color: #94a3b8;
}

.debate-col--bull h4 { color: #ef4444; }
.debate-col--bear h4 { color: #22c55e; }

.risk-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.bubble {
  font-size: 11px;
  line-height: 1.45;
  padding: 8px;
  border-radius: 8px;
  margin-bottom: 6px;
}

.bubble--bull {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fecaca;
}

.bubble--bear {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.25);
  color: #bbf7d0;
}

.bubble--risk {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.empty {
  font-size: 10px;
  color: #64748b;
}
</style>
