<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRunStore } from '../stores/runStore'

const runStore = useRunStore()
const { finalDecision, showFinalDecision, taskInfo } = storeToRefs(runStore)

function close() {
  runStore.showFinalDecision = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="showFinalDecision && finalDecision" class="decision-overlay" @click.self="close">
      <article class="decision-card glass">
        <header class="decision-card__head">
          <div>
            <p class="decision-card__label">Portfolio Manager · 最终决策</p>
            <h2>{{ taskInfo?.symbol }} {{ taskInfo?.companyName }}</h2>
          </div>
          <button class="decision-card__close" @click="close">×</button>
        </header>

        <div class="decision-card__body">
          <div class="decision-grid">
            <div class="metric metric--rating">
              <span>最终评级</span>
              <strong>{{ finalDecision.rating ?? '—' }}</strong>
            </div>
            <div class="metric">
              <span>交易动作</span>
              <strong>{{ finalDecision.action ?? '—' }}</strong>
            </div>
            <div class="metric">
              <span>置信度</span>
              <strong>{{ finalDecision.confidence ?? '—' }}</strong>
            </div>
            <div class="metric">
              <span>建议仓位</span>
              <strong>{{ finalDecision.position_sizing ?? '—' }}</strong>
            </div>
          </div>

          <section v-if="finalDecision.summary" class="decision-section">
            <h3>核心理由</h3>
            <p>{{ finalDecision.summary }}</p>
          </section>

          <section v-if="finalDecision.raw_markdown" class="decision-section">
            <h3>完整决策</h3>
            <pre>{{ finalDecision.raw_markdown }}</pre>
          </section>

          <section class="decision-section">
            <h3>观察周期 / 止损</h3>
            <p>{{ finalDecision.time_horizon ?? '—' }} · {{ finalDecision.stop_loss_hint ?? '请结合风控规则自行设定' }}</p>
          </section>

          <p class="disclaimer">本系统仅用于研究与演示，不构成任何投资建议。</p>
        </div>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.decision-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 20px;
}

.decision-card {
  width: min(520px, 100%);
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid rgba(192, 132, 252, 0.35);
  box-shadow: 0 0 40px rgba(192, 132, 252, 0.15);
}

.decision-card__head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.decision-card__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
  scrollbar-gutter: stable;
}

.decision-card__body::-webkit-scrollbar {
  width: 6px;
}

.decision-card__body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}

.decision-card__body::-webkit-scrollbar-track {
  background: transparent;
}

.decision-card__label {
  margin: 0;
  font-size: 11px;
  color: #c084fc;
  letter-spacing: 0.06em;
}

.decision-card__head h2 {
  margin: 4px 0 0;
  color: #f8fafc;
  font-size: 20px;
}

.decision-card__close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
}

.decision-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.metric {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.metric span {
  display: block;
  font-size: 10px;
  color: #64748b;
  margin-bottom: 4px;
}

.metric strong {
  font-size: 18px;
  color: #e2e8f0;
}

.metric--rating strong {
  color: #c084fc;
  text-shadow: 0 0 12px rgba(192, 132, 252, 0.5);
}

.decision-section {
  margin-bottom: 12px;
}

.decision-section h3 {
  margin: 0 0 6px;
  font-size: 12px;
  color: #94a3b8;
}

.decision-section p,
.decision-section pre {
  margin: 0;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.5;
  white-space: pre-wrap;
}

.disclaimer {
  margin: 16px 0 0;
  font-size: 10px;
  color: #64748b;
  text-align: center;
}
</style>
