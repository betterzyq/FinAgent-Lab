/** High-level animation sequencing (adapted from marvis useOfficeOrchestrator). */

export type OrchestratorStep = () => Promise<void>

export type TradingOrchestrator = {
  wait: (ms: number) => Promise<void>
  sequence: (...steps: OrchestratorStep[]) => Promise<void>
  parallel: (...steps: OrchestratorStep[]) => Promise<void>
}

export function useTradingOrchestrator(): TradingOrchestrator {
  async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  async function sequence(...steps: OrchestratorStep[]): Promise<void> {
    for (const step of steps) {
      await step()
    }
  }

  async function parallel(...steps: OrchestratorStep[]): Promise<void> {
    await Promise.all(steps.map((step) => step()))
  }

  return { wait, sequence, parallel }
}
