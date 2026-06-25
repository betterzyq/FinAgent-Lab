# TradingAgents A 股多智能体投研交易可视化系统 — 改造方案（第一阶段）

> **文档版本**：v0.2  
> **日期**：2026-06-17  
> **阶段**：架构检查与设计（不修改代码）  
> **产品定位**：基于 FastAPI + Vue 3 + PixiJS 的 A 股多智能体投研交易可视化系统 — 「Agent Trading Floor / 2D 金融交易作战室」  
> **v0.2 变更**：允许复用 `marvis-office` 中的 Marvis **小马精灵**（spritesheet + 动作）作为 Agent 卡通形象；仍禁止 Marvis 品牌 Logo、官方文案与办公室场景素材。

---

## 1. 执行摘要

本方案在**不破坏**现有 TradingAgents CLI 与 `propagate()` 的前提下，新增 FastAPI 后端与 Vue 3 + PixiJS 前端，将 LangGraph 执行过程拆成**统一事件流**，驱动 2D 交易大厅动画与报告面板。

**核心结论**：

| 维度 | 结论 |
|------|------|
| 事件流实现 | **方案 A（推荐）**：复用 CLI 已验证的 `graph.stream()` + chunk 差分逻辑；**不修改** `propagate()` |
| 实时推送 | **SSE 优先**（MVP），后续可增 WebSocket |
| 前端基础 | 借鉴 `marvis-office` 的 Hook/编排模式；**复用小马精灵**作 Agent 形象；场景改为金融作战室，**不用** Marvis 品牌 Logo/办公室背景 |
| 后端位置 | 工作区根目录 `backend/`，依赖 `TradingAgents/` Python 包 |
| 分析师执行 | 当前默认**串行**（`analyst_concurrency_limit=1`），动画按串行设计，后续可配置并行 |
| 协调官 Agent | 图内**不存在**，作为前端虚拟角色 + 后端 `run_started` 事件承载 |

---

## 2. 现状扫描

### 2.1 工作区结构

```
TradingAgents-Visual-Workspace/
├── TradingAgents/          # 已改造 A 股数据源的多智能体框架（Python）
├── marvis-office/          # Vue 3 + PixiJS 2D 办公室 Demo（参考前端）
└── docs/                   # 本文档目录（新建）
```

**待新建**（第二阶段起）：

```
├── backend/                # FastAPI 服务
└── frontend/               # 金融交易作战室前端（自 marvis-office 改造）
```

### 2.2 TradingAgents 后端核心（已扫描）

#### 2.2.1 执行入口

| 入口 | 文件 | 行为 |
|------|------|------|
| Python API | `tradingagents/graph/trading_graph.py` → `propagate()` | `graph.invoke()` 一次性返回 `(final_state, decision_string)` |
| CLI | `cli/main.py` → `run_analysis()` | `graph.stream()` **实时**消费 chunk，Rich 面板更新 |
| Debug | `TradingAgentsGraph(debug=True)` | 同 CLI，打印 messages |

**关键发现**：`Propagator.get_graph_args()` 已配置 `stream_mode: "values"`，CLI 证明 stream 路径生产可用。**可视化后端应走 stream 路径，而非 invoke 路径**。

#### 2.2.2 LangGraph 节点（`graph/setup.py`）

**分析师链**（动态，默认顺序 market → social → news → fundamentals）：

| Wire Key | 节点名 | 工具节点 | 报告字段 |
|----------|--------|----------|----------|
| market | Market Analyst | tools_market | market_report |
| social | Sentiment Analyst | tools_social | sentiment_report |
| news | News Analyst | tools_news | news_report |
| fundamentals | Fundamentals Analyst | tools_fundamentals | fundamentals_report |

每个分析师：`Agent → (tool_calls?) tools_* → Agent → Msg Clear * → 下一分析师`

**固定后续节点**：

```
Bull Researcher ⇄ Bear Researcher → Research Manager → Trader
→ Aggressive Analyst ⇄ Conservative Analyst ⇄ Neutral Analyst → Portfolio Manager → END
```

#### 2.2.3 AgentState 关键字段（`agents/utils/agent_states.py`）

- 报告：`market_report`, `sentiment_report`, `news_report`, `fundamentals_report`
- 研究：`investment_debate_state`（bull/bear/history/count/judge_decision）, `investment_plan`
- 交易：`trader_investment_plan`
- 风控：`risk_debate_state`（三方 history + latest_speaker + count + judge_decision）
- 决策：`final_trade_decision`
- 上下文：`instrument_context`, `past_context`, `company_of_interest`, `trade_date`

#### 2.2.4 结构化输出（`agents/schemas.py`）

| Agent | Schema | 渲染 |
|-------|--------|------|
| Research Manager | `ResearchPlan` | `render_research_plan()` |
| Trader | `TraderProposal` | `render_trader_proposal()` |
| Portfolio Manager | `PortfolioDecision` | `render_pm_decision()` |
| Sentiment Analyst | `SentimentReport` | `render_sentiment_report()` |

前端 PM 决策卡片可优先解析 markdown 中的 `**Rating**` 等字段；后续可扩展后端结构化 `payload`。

#### 2.2.5 A 股数据源（已改造，禁止删除）

| 模块 | 职责 |
|------|------|
| `dataflows/akshare_stock.py` | OHLCV、行情 |
| `dataflows/akshare_fundamentals.py` | 财报基本面 |
| `dataflows/akshare_news.py` | 新闻 |
| `dataflows/eastmoney_guba.py`, `xueqiu.py` | 舆情 |
| `dataflows/china_macro.py` | 宏观政策 |
| `dataflows/akshare_common.py` | 代码解析 `parse_ashare_symbol()` |
| `agents/utils/agent_utils.py` | `resolve_instrument_identity()` 通过 AkShare 解析公司名 |

`default_config.py` 中 `data_vendors` 已全部指向 akshare/china_macro。

#### 2.2.6 CLI 流式逻辑（可直接复用）

`cli/main.py` 已实现：

- `update_analyst_statuses()` — 根据 report 字段推断分析师进度
- `investment_debate_state` / `risk_debate_state` 差分更新
- `message.tool_calls` → 工具调用记录
- chunk 合并：`final_state.update(chunk)`

**后端 `EventEmitter` 应抽取/镜像此逻辑**，而非重写图结构。

#### 2.2.7 辩论轮数

`conditional_logic.py`：

- 多空：`count >= 2 * max_debate_rounds` → Research Manager
- 风控：`count >= 3 * max_risk_discuss_rounds` → Portfolio Manager

前端 `debate_rounds` / `risk_rounds` 应对应写入 run 配置的 `max_debate_rounds` / `max_risk_discuss_rounds`。

### 2.3 marvis-office 前端核心（已扫描）

#### 2.3.1 技术栈

- Vue 3.5 + TypeScript 6 + Vite 8 + PixiJS 8.18
- `@tweenjs/tween.js` 角色移动
- **无 Pinia**，纯 Hook + 组件局部状态
- **无** WebSocket/SSE

#### 2.3.2 架构分层（值得借鉴）

```
App.vue                    # Pixi 生命周期、加载、resize
├── useScene.ts            # 场景图、布局、资源加载、工位创建
├── useWorkstation.ts      # 工位 = desk + screen + person + effect
├── usePerson.ts           # 角色精灵、移动、视觉锚点
├── useOfficeOrchestrator.ts  # sequence/parallel/wait 编排原语
├── useAnimation.ts        # 固定时间线循环动画（需改为事件驱动）
├── useActionTextures.ts   # spritesheet 纹理加载
├── useSprite.ts           # 精灵工厂
└── assets/agent/roles.ts  # 6 角色配置（需完全替换）
```

#### 2.3.3 与目标差距

| marvis-office | 目标 Trading Floor |
|---------------|-------------------|
| 6 个办公室 Agent | 13+1 金融 Agent（含虚拟协调官） |
| 固定循环动画 | **事件驱动**动画 |
| 全屏 Pixi，无面板 | 三栏 + 顶栏 + 底栏 UI |
| Marvis 办公室场景 / 品牌图 | 原创金融终端风交易大厅；**小马精灵可复用** |
| `#f7f7f7` 浅色背景 | 深色交易屏 `#0a0e17` 系 |

#### 2.3.4 可复用 vs 需重写

| 可复用（改造） | 需重写 |
|----------------|--------|
| `usePerson.ts` 移动/锚点逻辑 | `roles.ts` → `tradingRoles.ts` |
| `useSprite.ts`, `useActionTextures.ts` | `useScene.ts` 场景布局（交易大厅） |
| `useWorkstation.ts` 工位组合模式 | `useAnimation.ts` → `useTradingAnimation.ts` |
| Orchestrator 的 sequence/parallel | `useOfficeOrchestrator.ts` → `useTradingOrchestrator.ts` |
| Pixi Application 初始化模式（App.vue） | 全部 Vue UI 组件 |
| **`assets/agent/*.webp` 小马 spritesheet** | 工位/房间背景（自绘或简化 desk 素材） |
| **`assets/agent/index.ts` 动作定义** | 屏幕特效可简化或保留 `fc_screen_*` 系列 |

#### 2.3.5 美术资源策略（已更正）

**角色形象（PixiJS 场景内）— 优先复用 Marvis 小马**：

- 从 `marvis-office/src/assets/agent/` **复制**小马 body + scarf 精灵图与 JSON 帧数据到 `frontend/src/assets/agent/`。
- 13 个金融 Agent **共用同一套小马骨骼/动作**（`standby`、`working`、`walking_*`、`talking_on_*`、`off_chair` 等），通过 **`scarfColor`（围巾色）** 区分角色，与 marvis-office 现有做法一致。
- 协调官可用 `main` 型较大工位 + 金色/紫色围巾；分析师/交易员等分配不同 `scarfColor`（见 §8）。
- **禁止**在 UI 文案、标题、加载页中出现「Marvis」品牌名；角色展示名一律用中文金融职称（如「行情技术分析师」）。

**仍不复用 / 需原创**：

- `ani-marvis-team.jpg`、办公室饮水机/跑步机等**办公室装饰**sprites。
- Marvis Logo、官方 Slogan、与 Marvis 产品页易混淆的命名（如「Marvis 协调官」）。
- 场景背景：用 PixiJS `Graphics` + 深色金融终端风绘制交易大厅分区，而非办公室贴图。

**侧边栏头像（Vue UI）**：

- Agent 状态面板可用围巾色圆点 + emoji 或小马 `iconFrame` 裁剪头像（复用 `roles.ts` 中 `iconFrame` 思路）。
- 若后续找到更合适的原创卡通素材，可替换 spritesheet，接口（`scarfColor` + 动作名）保持不变。

**兜底策略**：若复制 spritesheet 后体积/加载过慢，MVP 阶段可对非焦点 Agent 降级为几何占位，**焦点 Agent（当前 working/debating）仍用小马**。

---

## 3. 目标架构

### 3.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        frontend/ (Vue 3 + PixiJS)                 │
│  TopControlBar │ AgentStatusPanel │ TradingCanvas │ ReportPanel │
│                │                  │  (PixiJS)     │ Timeline    │
│                └──────── useTradingApi (SSE) ──────────────────┘
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / SSE
┌───────────────────────────────▼─────────────────────────────────┐
│                        backend/ (FastAPI)                         │
│  api/runs.py │ api/agents.py │ api/symbols.py                     │
│  services/tradingagents_runner.py  ← graph.stream()               │
│  services/event_bus.py             ← 订阅/广播                    │
│  services/run_store.py             ← 内存/可选 Redis              │
└───────────────────────────────┬─────────────────────────────────┘
                                │ import
┌───────────────────────────────▼─────────────────────────────────┐
│                   TradingAgents/ (现有包，不破坏)                  │
│  TradingAgentsGraph │ LangGraph │ AkShare 数据源 │ CLI           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 设计原则

1. **零侵入核心图**：不修改 `setup.py` 节点注册；不修改 `propagate()` 签名与行为
2. **Stream 优先**：新建 `TradingAgentsRunner.stream_run()`，内部 `graph.stream()` + 事件翻译
3. **CLI 共存**：`tradingagents analyze` 命令保持可用
4. **密钥后端化**：LLM API Key 仅 `.env` + 后端读取
5. **免责声明**：所有 UI 固定展示「仅供研究演示，不构成投资建议」

### 3.3 目录结构（完整）

```
TradingAgents-Visual-Workspace/
├── TradingAgents/                    # 现有（仅新增可选 utils，不改 propagate）
├── backend/
│   ├── main.py                       # FastAPI 入口、CORS、生命周期
│   ├── api/
│   │   ├── __init__.py
│   │   ├── runs.py                   # POST/GET runs, SSE events
│   │   ├── agents.py                 # GET /api/agents
│   │   └── symbols.py                # GET /api/symbols/search
│   ├── services/
│   │   ├── tradingagents_runner.py   # 包装 TradingAgentsGraph + stream
│   │   ├── event_emitter.py          # chunk → AgentRunEvent
│   │   ├── event_bus.py              # run_id → asyncio.Queue 订阅者
│   │   └── run_store.py              # Run 状态、事件历史、结果缓存
│   ├── schemas/
│   │   ├── run.py                    # CreateRunRequest/RunStatus
│   │   ├── events.py                 # AgentRunEvent Pydantic
│   │   └── agents.py                 # AgentProfileResponse
│   ├── utils/
│   │   ├── json_utils.py
│   │   └── logger.py
│   ├── mock/
│   │   └── mock_event_stream.py      # MVP 模拟事件（第二阶段先用）
│   ├── requirements.txt              # fastapi, uvicorn, sse-starlette...
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── style.css                 # 深色金融终端主题
│   │   ├── types/
│   │   │   ├── agent.ts
│   │   │   ├── events.ts
│   │   │   └── run.ts
│   │   ├── assets/agent/
│   │   │   ├── tradingRoles.ts       # 13+1 角色配置（scarfColor / 位置）
│   │   │   ├── index.ts              # 动作名（自 marvis-office 复制）
│   │   │   └── *.webp + *.json       # 小马 spritesheet（自 marvis-office 复制）
│   │   ├── hooks/
│   │   │   ├── useTradingScene.ts
│   │   │   ├── useTradingAnimation.ts
│   │   │   ├── useTradingOrchestrator.ts
│   │   │   ├── useTradingApi.ts
│   │   │   ├── usePerson.ts          # 自 marvis 复制改造
│   │   │   ├── useWorkstation.ts
│   │   │   └── ...
│   │   ├── stores/
│   │   │   └── runStore.ts           # Pinia 或 reactive store
│   │   └── components/
│   │       ├── TopControlBar.vue
│   │       ├── AgentStatusPanel.vue
│   │       ├── ReportPanel.vue
│   │       ├── TimelinePanel.vue
│   │       ├── FinalDecisionCard.vue
│   │       ├── DebatePanel.vue
│   │       └── TradingCanvas.vue
│   ├── package.json
│   └── vite.config.ts                # proxy → backend:8000
└── docs/
    ├── TradingAgents_可视化前端改造方案.md   # 本文档
    ├── API_事件协议.md                       # 第五阶段拆分（内容见 §4）
    └── 前端动画流程说明.md                   # 第五阶段拆分（内容见 §7）
```

---

## 4. 统一事件协议

### 4.1 TypeScript / Pydantic 共享结构

```typescript
type AgentTeam = 'coordinator' | 'analyst' | 'researcher' | 'trader' | 'risk' | 'pm'

type AgentRunEventType =
  | 'run_started'
  | 'agent_started'
  | 'tool_called'
  | 'tool_finished'
  | 'report_ready'
  | 'handoff'
  | 'debate_message'
  | 'debate_finished'
  | 'risk_debate_message'
  | 'risk_debate_finished'
  | 'trader_proposal_ready'
  | 'pm_decision_ready'
  | 'run_finished'
  | 'run_error'

interface AgentRunEvent {
  event_id: string          // UUID
  run_id: string
  timestamp: string         // ISO 8601 UTC
  event_type: AgentRunEventType
  agent_id?: string         // 前端角色 ID，见 §5.2
  agent_name?: string       // 中文展示名
  team?: AgentTeam
  from_agent?: string
  to_agent?: string
  title?: string
  message?: string          // 短描述 / 工具名 / 辩论摘要
  payload?: Record<string, unknown>
}
```

### 4.2 事件触发映射（LangGraph → 事件）

| 事件类型 | 触发条件（stream chunk 差分） | payload 建议 |
|----------|------------------------------|--------------|
| `run_started` | Runner 启动，初始 state 创建后 | symbol, trade_date, company_name, analysis_depth |
| `agent_started` | 检测到新节点开始* | node_name, phase |
| `tool_called` | `messages[-1].tool_calls` 非空 | tool_name, tool_args |
| `tool_finished` | tools_* 节点完成后（可选，MVP 可省略） | tool_name |
| `report_ready` | `market_report` 等字段首次非空 | report_key, content_preview, full_content |
| `handoff` | 分析师 report 完成 → 研究阶段；RM → Trader 等阶段切换 | from, to, artifact |
| `debate_message` | `investment_debate_state` bull/bear history 增量 | side: bull/bear, content, round |
| `debate_finished` | `investment_plan` 或 judge_decision 出现 | investment_plan |
| `trader_proposal_ready` | `trader_investment_plan` 非空 | proposal markdown / 结构化字段 |
| `risk_debate_message` | risk_debate_state 三方 history 增量 | side: aggressive/neutral/conservative, content |
| `risk_debate_finished` | 风控 count 达上限，PM 开始前 | — |
| `pm_decision_ready` | `final_trade_decision` 非空 | rating, action, confidence, risks... |
| `run_finished` | stream 结束，state 合并完成 | final_state 摘要, decision_string |
| `run_error` | 任意异常 | error_type, error_message, traceback? |

> *`agent_started` 实现选项（按优先级）：
> 1. **`stream_mode=["updates"]`**：chunk 的 key 即节点名 → 最准确
> 2. **report 字段 + 状态机推断**：与 CLI `update_analyst_statuses` 相同 → 改动最小
> 3. **LangGraph callback**：侵入性较高，不推荐 MVP

**推荐 MVP 组合**：`stream_mode=["updates", "values"]` — updates 发 `agent_started`，values 差分发内容与报告事件。

### 4.3 节点名 → agent_id 映射表

| LangGraph 节点名 | agent_id | 中文名 | team |
|------------------|----------|--------|------|
| *(虚拟)* | coordinator | 任务协调官 | coordinator |
| Market Analyst | market_analyst | 行情技术分析师 | analyst |
| Fundamentals Analyst | fundamentals_analyst | 基本面分析师 | analyst |
| Sentiment Analyst | sentiment_analyst | 舆情情绪分析师 | analyst |
| News Analyst | news_analyst | 新闻政策分析师 | analyst |
| Bull Researcher | bullish_researcher | 多头研究员 | researcher |
| Bear Researcher | bearish_researcher | 空头研究员 | researcher |
| Research Manager | research_manager | 研究经理 | researcher |
| Trader | trader | 交易员 | trader |
| Aggressive Analyst | aggressive_risk | 进攻型风控 | risk |
| Neutral Analyst | neutral_risk | 中性风控 | risk |
| Conservative Analyst | conservative_risk | 保守型风控 | risk |
| Portfolio Manager | portfolio_manager | 组合经理 | pm |

工具节点（`tools_market` 等）和 `Msg Clear *` 节点**不映射**为独立 Agent，其事件归入当前活跃分析师的 `tool_called`。

### 4.4 SSE 传输格式

```
GET /api/runs/{run_id}/events
Accept: text/event-stream

event: agent_event
data: {"event_id":"...","run_id":"...","event_type":"agent_started",...}

event: agent_event
data: {"event_id":"...","event_type":"report_ready",...}

event: heartbeat
data: {"timestamp":"..."}

event: run_finished
data: {"run_id":"...","status":"completed"}
```

- 每个业务事件一行 `data:` JSON（单行）
- 30s heartbeat 防止代理断开
- 客户端断开后 Runner **继续执行**（除非收到 cancel），事件写入 `run_store` 可回放

---

## 5. API 设计

### 5.1 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/runs` | 创建分析任务 |
| GET | `/api/runs/{run_id}/events` | SSE 事件流 |
| GET | `/api/runs/{run_id}` | 状态 + 最终报告 + 决策 |
| GET | `/api/runs/{run_id}/timeline` | 完整事件时间线（JSON 数组） |
| DELETE | `/api/runs/{run_id}` | 取消运行（可选，MVP 可 stub） |
| GET | `/api/agents` | Agent 角色配置 |
| GET | `/api/symbols/search?keyword=` | A 股代码/名称搜索 |
| GET | `/api/health` | 健康检查 |

### 5.2 POST /api/runs

**Request**

```json
{
  "symbol": "600519",
  "market": "A股",
  "trade_date": "2026-06-17",
  "company_name": "贵州茅台",
  "analysis_depth": "standard",
  "debate_rounds": 2,
  "risk_rounds": 2,
  "stream": true,
  "selected_analysts": ["market", "social", "news", "fundamentals"]
}
```

| 字段 | 说明 |
|------|------|
| symbol | 6 位代码或 `600519.SS` / `000001.SZ` |
| analysis_depth | `quick` / `standard` / `deep` — 映射 LLM 模型与轮数（见 §5.2.1） |
| stream | true 时后台 asyncio Task 执行并推送事件 |

**Response**

```json
{
  "run_id": "run_20260617_abc123",
  "status": "created"
}
```

#### 5.2.1 analysis_depth 映射（建议）

| depth | max_debate_rounds | max_risk_discuss_rounds | 说明 |
|-------|-------------------|-------------------------|------|
| quick | 1 | 1 | 默认模型 |
| standard | 2 | 2 | 用户默认值 |
| deep | 3 | 3 | 可选切换 deep_think 模型 |

实现：Runner 合并到 `DEFAULT_CONFIG` 副本，**不修改**全局 DEFAULT_CONFIG。

### 5.3 GET /api/runs/{run_id}

```json
{
  "run_id": "...",
  "status": "running | completed | failed | cancelled",
  "symbol": "600519.SS",
  "company_name": "贵州茅台",
  "trade_date": "2026-06-17",
  "progress": {
    "phase": "analyst | research_debate | trader | risk_debate | pm | done",
    "completed_agents": ["market_analyst", "..."],
    "percent": 42
  },
  "reports": {
    "market_report": "...",
    "sentiment_report": "...",
    "news_report": "...",
    "fundamentals_report": "...",
    "investment_plan": "...",
    "trader_investment_plan": "...",
    "final_trade_decision": "..."
  },
  "decision": {
    "rating": "Overweight",
    "action": "Buy",
    "confidence": "medium",
    "summary": "...",
    "risks": ["..."],
    "position_sizing": "5%",
    "time_horizon": "3-6 months",
    "stop_loss_hint": "..."
  },
  "error": null,
  "started_at": "...",
  "finished_at": "..."
}
```

`decision` 字段从 `PortfolioDecision` markdown 或 `SignalProcessor` 输出解析；解析失败时保留原始 markdown。

### 5.4 GET /api/agents

返回前端渲染所需的完整角色配置（与 `tradingRoles.ts` 同源，后端为 SSOT 或双端各一份 + 测试校验一致）。

```json
{
  "agents": [
    {
      "id": "coordinator",
      "name": "任务协调官",
      "name_en": "Coordinator",
      "team": "coordinator",
      "color": "#9B59B6",
      "avatar": "🎯",
      "description": "接收用户任务，协调各 Agent 执行",
      "skills": ["任务分发", "流程编排", "进度监控"],
      "scene": {
        "zone": "command_console",
        "position": { "x": 600, "y": 80 },
        "home_position": { "x": 600, "y": 80 }
      }
    }
  ],
  "zones": [
    { "id": "command_console", "label": "中央控制台" },
    { "id": "market_desk", "label": "行情大屏区" },
    { "id": "analyst_row", "label": "分析师工位" },
    { "id": "research_room", "label": "研究辩论室" },
    { "id": "trading_desk", "label": "交易执行台" },
    { "id": "risk_room", "label": "风控会议室" },
    { "id": "pm_office", "label": "PM 办公室" }
  ]
}
```

### 5.5 GET /api/symbols/search

**实现**：`ak.stock_info_a_code_name()` 加载全量 A 股列表，内存缓存（TTL 24h），按代码前缀 / 名称模糊匹配，返回 top 20。

```json
{
  "items": [
    { "symbol": "600519", "display": "600519.SS", "name": "贵州茅台", "market": "A股" }
  ]
}
```

**不确定项**：AkShare 接口偶发网络失败 → 降级返回空列表 + 允许用户手动输入代码；`company_name` 可由 `resolve_instrument_identity()` 在后端 run 创建时补全。

---

## 6. 后端实现设计

### 6.1 TradingAgentsRunner（核心）

```python
# 伪代码 — 不修改 TradingAgentsGraph.propagate()
class TradingAgentsRunner:
    def __init__(self, config: dict | None = None):
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.graph_wrapper = TradingAgentsGraph(config=self.config)

    async def run_async(self, run_id: str, request: CreateRunRequest, bus: EventBus):
        try:
            await bus.emit(run_started(...))
            init_state = self._build_initial_state(request)
            args = self.graph_wrapper.propagator.get_graph_args()
            # 扩展 stream_mode
            args["stream_mode"] = ["updates", "values"]

            merged_state = {}
            async for mode, chunk in self._iter_stream(init_state, args):
                events = EventEmitter.translate(mode, chunk, merged_state, context)
                for ev in events:
                    await bus.emit(ev)
                if mode == "values":
                    merged_state.update(chunk)

            await bus.emit(run_finished(...))
            run_store.save_result(run_id, merged_state)
        except Exception as exc:
            await bus.emit(run_error(...))
            run_store.mark_failed(run_id, exc)
```

**线程模型**：`asyncio.to_thread()` 或 `run_in_executor` 包装同步 `graph.stream()` 迭代，避免阻塞 FastAPI 事件循环。

**不修改 propagate 的保证**：Runner 直接访问 `graph_wrapper.graph.stream()`，与 CLI 相同；`propagate()` 保持 `invoke()` 路径不变。

### 6.2 EventEmitter

职责：

1. 维护 `{report_key: last_len}` 差分，避免重复 `report_ready`
2. 维护 debate/risk history 长度，提取增量 → `debate_message` / `risk_debate_message`
3. 阶段切换检测 → `handoff`
4. 从 messages 提取 tool_calls

**可抽取来源**：将 `cli/main.py` 中 `update_analyst_statuses`、debate/risk 处理逻辑提取到 `tradingagents/graph/stream_events.py`（可选，第二阶段评估是否 worth 抽公共模块）。

### 6.3 RunStore

MVP：**内存 dict** `{run_id: RunRecord}`

```python
@dataclass
class RunRecord:
    run_id: str
    status: RunStatus
    request: CreateRunRequest
    events: list[AgentRunEvent]      # 时间线
    final_state: dict | None
    task: asyncio.Task | None
```

后续可换 SQLite / Redis，接口不变。

### 6.4 EventBus

```python
class EventBus:
    def subscribe(self, run_id: str) -> asyncio.Queue
    def unsubscribe(self, run_id: str, queue: asyncio.Queue)
    async def emit(self, event: AgentRunEvent)  # 广播 + append run_store.events
```

### 6.5 Mock 模式（第二阶段 Step 5）

`POST /api/runs` + header `X-Mock-Mode: true` 或 env `BACKEND_MOCK=1`：

- 不调用 LLM，按固定脚本推送 30~50 个事件
- 报告内容读 `TradingAgents/reports/600519.SS_*/` 样例
- 用于前端联调与 CI

### 6.6 依赖

```
fastapi>=0.115
uvicorn[standard]>=0.32
sse-starlette>=2.0
pydantic>=2.0
python-dotenv
# TradingAgents 包：pip install -e ../TradingAgents
```

CORS：允许 `http://127.0.0.1:8090`（frontend dev）。

---

## 7. 前端设计与动画流程

### 7.1 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ TopControlBar  [代码] [名称] [日期] [深度] [辩论轮数] [启动][重置]  │
│ ⚠ 仅供研究演示，不构成投资建议                                      │
├──────────┬───────────────────────────────────────┬───────────────┤
│ Agent    │                                       │ ReportPanel   │
│ Status   │         TradingCanvas (PixiJS)        │ - 选中报告    │
│ Panel    │         2D 交易大厅 / 作战室            │ - 辩论记录    │
│          │                                       │ - PM 决策     │
├──────────┴───────────────────────────────────────┴───────────────┤
│ TimelinePanel  事件流 | 阶段进度 | 完成标记                          │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 PixiJS 场景分区（sceneWidth × sceneHeight = 1400 × 900 建议）

```
┌─────────────────────────────────────────────────────────┐
│  [command_console]  任务协调官 + 中央大屏（股票信息）      │
├────────────┬──────────────────────────────┬─────────────┤
│ market_desk│                              │             │
│ 行情大屏   │     analyst_row (4 工位)      │ research    │
│            │  市场|基本面|舆情|新闻政策     │ _room       │
│            │                              │ 辩论室       │
├────────────┴──────────────┬───────────────┴─────────────┤
│     trading_desk          │      risk_room    │ pm_office│
│     交易员                 │      三方风控      │ PM 办公室 │
└───────────────────────────┴───────────────────┴──────────┘
```

各 zone 用 `Graphics` 画半透明矩形 + 标签；工位用简化的 desk 矩形 + 屏幕子容器。

### 7.3 Agent 状态机

```typescript
type AgentVisualStatus =
  | 'idle'       // 待命
  | 'working'    // 工位屏幕亮，工作中
  | 'moving'     // 跑向目标点
  | 'debating'   // 辩论室发言
  | 'waiting'    // 等待上游
  | 'finished'   // 本阶段完成
  | 'error'
```

### 7.4 事件 → 动画映射

| 事件 | 动画 / UI 行为 |
|------|----------------|
| `run_started` | 中央大屏显示 symbol/name/date；协调官 `working`；Timeline 开始 |
| `agent_started` | 对应 Agent → `working`；工位屏幕亮起 |
| `tool_called` | 工位屏幕文字 = 工具中文名（如「获取行情数据」） |
| `report_ready` | 屏幕闪绿；Agent → `finished`；触发 `handoff` 移动动画 |
| `handoff` | Agent `moving` → 目标 zone（如 analyst → research_room） |
| `debate_message` | Bull 左侧气泡 / Bear 右侧气泡；打字机效果；Agent `debating` |
| `debate_finished` | RM 工位亮起；ReportPanel 显示 investment_plan |
| `trader_proposal_ready` | Trader 工位特效；交易单卡片预览 |
| `risk_debate_message` | 风控室三方座位轮流高亮 + DebatePanel |
| `pm_decision_ready` | PM 办公室亮起；FinalDecisionCard 弹出 |
| `run_finished` | 所有 Agent 回 home_position → `idle`；Timeline 标记完成 |
| `run_error` | 出错 Agent → `error`；顶部 toast |

### 7.5 全流程动画脚本（17 步映射）

| 步骤 | 用户描述 | 事件链 |
|------|----------|--------|
| 1 | 用户启动 | `run_started` |
| 2 | 协调官接收 | coordinator `working` + 大屏更新 |
| 3-4 | 四分析师工作 | 串行 `agent_started` → `tool_called`* → `report_ready` |
| 5 | 交付 RM | 每个 analyst `handoff` → research_room |
| 6-7 | 多空辩论 | `debate_message` × N → `debate_finished` |
| 8 | investment_plan | `report_ready` (investment_plan) |
| 9 | 交给 Trader | research_manager `handoff` → trading_desk |
| 10 | 交易提案 | `trader_proposal_ready` |
| 11-13 | 风控辩论 | `risk_debate_message` × N → `risk_debate_finished` |
| 14-15 | PM 决策 | `handoff` → pm_office → `pm_decision_ready` |
| 16 | 决策卡片 | FinalDecisionCard |
| 17 | 结束复盘 | `run_finished` + 全员回位 |

> **注意**：步骤 3 描述为「同时或依次」— 当前后端默认**依次**执行四分析师；前端 MVP 按依次动画；若将来 `analyst_concurrency_limit > 1`，需并行工位动画。

### 7.6 状态管理

**推荐引入 Pinia**（`runStore`）：

```typescript
// runStore 核心 state
{
  runId, runStatus, symbol, companyName, tradeDate,
  agents: Record<AgentId, { status, lastMessage, report? }>,
  events: AgentRunEvent[],
  debates: { bull: Message[], bear: Message[] },
  riskDebates: { aggressive, neutral, conservative },
  selectedAgentId,
  finalDecision,
  phases: { analyst: bool, research: bool, trader: bool, risk: bool, pm: bool }
}
```

`useTradingApi.ts`：创建 run + `EventSource` 订阅 SSE → dispatch 到 store → `useTradingAnimation` watch store 驱动 Pixi。

### 7.7 useTradingAnimation（事件驱动，非循环）

替换 marvis `useAnimation.ts` 的 `runRepeatingAnimation`：

```typescript
export function useTradingAnimation(orchestrator: TradingOrchestrator, store: RunStore) {
  watch(() => store.lastEvent, (event) => {
    if (!event) return
    handleEvent(orchestrator, event)
  })

  async function handleEvent(orch, event: AgentRunEvent) {
    switch (event.event_type) {
      case 'agent_started': await onAgentStarted(orch, event); break
      case 'report_ready': await onReportReady(orch, event); break
      // ...
    }
  }
}
```

动画队列：并发事件用 `AnimationQueue` 串行化同一 Agent 的移动，不同 Agent 可 `parallel`。

---

## 8. 角色配置（tradingRoles.ts 摘要）

PixiJS 场景内：**小马精灵 + 围巾色（`scarfColor`）** 区分角色；侧边栏 UI 可用 emoji 或小马头像裁剪。

| id | 中文名 | scarfColor / 主色 | zone | UI 头像 |
|----|--------|-------------------|------|---------|
| coordinator | 任务协调官 | `#9B59B6` | command_console | 🎯 |
| market_analyst | 行情技术分析师 | `#3498DB` | analyst_row | 📈 |
| fundamentals_analyst | 基本面分析师 | `#2ECC71` | analyst_row | 📊 |
| sentiment_analyst | 舆情情绪分析师 | `#E67E22` | analyst_row | 💬 |
| news_analyst | 新闻政策分析师 | `#1ABC9C` | analyst_row | 📰 |
| bullish_researcher | 多头研究员 | `#E74C3C` | research_room | 🐂 |
| bearish_researcher | 空头研究员 | `#27AE60` | research_room | 🐻 |
| research_manager | 研究经理 | `#1A5276` | research_room | 🎓 |
| trader | 交易员 | `#F1C40F` | trading_desk | ⚡ |
| aggressive_risk | 进攻型风控 | `#E55039` | risk_room | 🔥 |
| neutral_risk | 中性风控 | `#8395A7` | risk_room | ⚖️ |
| conservative_risk | 保守型风控 | `#186A3B` | risk_room | 🛡️ |
| portfolio_manager | 组合经理 | `#8E44AD` | pm_office | 👔 |

中国市场配色：多头红色 `#E74C3C`，空头绿色 `#27AE60`。

**动作映射建议**（事件 → 小马动作，与 marvis-office 一致）：

| 状态 / 事件 | 动作名 |
|-------------|--------|
| idle | `standby` / `standby_scarf` |
| working | `working` / `working_scarf` |
| tool_called | `working` + 工位屏幕 `fc_screen_working_*` |
| moving / handoff | `fc_walking_h` / `fc_walking_up` + `moveTo` |
| debating | `talking_on_stand-*` / `talking_on_seat` |
| report 交付 | `salute` → 移动 |
| run_finished 回位 | `fc_leaving` 反向路径或 `moveTo` home |

---

## 9. 新增 / 修改文件清单

### 9.1 新增文件（后端）

| 文件 | 职责 |
|------|------|
| `backend/main.py` | FastAPI app |
| `backend/api/runs.py` | Runs CRUD + SSE |
| `backend/api/agents.py` | Agent 配置 API |
| `backend/api/symbols.py` | 股票搜索 |
| `backend/services/tradingagents_runner.py` | Graph stream 执行 |
| `backend/services/event_emitter.py` | Chunk → Event |
| `backend/services/event_bus.py` |  pub/sub |
| `backend/services/run_store.py` | 状态存储 |
| `backend/schemas/*.py` | Pydantic 模型 |
| `backend/mock/mock_event_stream.py` | Mock 事件 |
| `backend/requirements.txt` | Python 依赖 |

### 9.2 新增文件（前端）

| 文件 | 职责 |
|------|------|
| `frontend/src/types/*.ts` | TS 类型 |
| `frontend/src/assets/agent/tradingRoles.ts` | 角色配置 |
| `frontend/src/hooks/useTrading*.ts` | 场景/动画/API |
| `frontend/src/stores/runStore.ts` | 全局状态 |
| `frontend/src/components/*.vue` | UI 组件 |
| `frontend/package.json` | 依赖（+ pinia） |

### 9.3 修改文件（TradingAgents — 最小化）

| 文件 | 改动 | 必要性 |
|------|------|--------|
| 无（MVP） | — | **推荐零修改** |
| `tradingagents/graph/stream_events.py` | 可选：从 CLI 抽取公共事件逻辑 | 低，第二阶段视重复度决定 |
| `pyproject.toml` | 可选：增加 `[project.optional-dependencies] api` | 低 |

### 9.4 不修改

- `propagate()` / `_run_graph()` 的 invoke 路径
- `cli/main.py` 行为
- 全部 `dataflows/akshare_*` 与 A 股路由
- `graph/setup.py` 节点拓扑

### 9.5 marvis-office 资源复制范围

**不直接修改** `marvis-office/`；向 `frontend/` **复制**以下内容：

| 复制 | 路径 | 说明 |
|------|------|------|
| ✅ 复制 | `src/assets/agent/*.webp` + `*.json` | 小马精灵与动作帧 |
| ✅ 复制 | `src/assets/agent/index.ts` | 动作名与图层元数据 |
| ✅ 复制/adapt | `src/hooks/usePerson.ts` 等 | Hook 逻辑 |
| ✅ 可选复制 | `src/assets/img/workstation@2x.webp*` | 工位 desk 可简化复用或自绘 |
| ✅ 可选复制 | `src/assets/img/agent_text@2x.webp*` | Agent 名称标签精灵 |
| ❌ 不复制 | `ani-marvis-team.jpg` | 办公室背景 / 品牌图 |
| ❌ 不复制 | 办公室装饰（water_bar、treadmill、toilet 等） | 与金融场景无关 |

复制后在 `frontend` 内改引用路径与角色配置，**不出现 Marvis 品牌文案**。

---

## 10. 分阶段实施计划

### 第二阶段：后端 MVP

1.  scaffold `backend/`，FastAPI 健康检查
2. `POST /api/runs` + 内存 RunStore
3. `GET /api/runs/{id}/events` SSE
4. Mock 事件流跑通
5. 接入真实 `TradingAgentsGraph.stream()`
6. `run_error` 异常捕获
7. `GET /api/runs/{id}` + timeline

### 第三阶段：前端 MVP

1. scaffold `frontend/`，深色主题布局
2. PixiJS 场景 + **Marvis 小马精灵**（复制 spritesheet，`scarfColor` 区分 13 角色）
3. 四面板 UI + 免责声明
4. SSE 接入 + Agent 状态更新
5. 基础 `working` / 屏幕文字 / 简单移动

### 第四阶段：高级动画

1. 报告交付 handoff 路径动画
2. 辩论室双气泡 + 打字机
3. 风控三方轮转
4. Trader 交易单 + PM 决策卡片
5. 完成后全员回位 + 时间线复盘

### 第五阶段：工程优化

1. 错误处理 / loading / 重连
2. Mock 模式开关
3. Demo 数据
4. README + 启动脚本（`start.sh` / `start.ps1`）
5. `npm run build` + 后端生产部署说明
6. 拆分 `docs/API_事件协议.md`、`docs/前端动画流程说明.md`

---

## 11. 启动方式（预览）

```powershell
# 终端 1 — 后端
cd backend
pip install -r requirements.txt
pip install -e ../TradingAgents
uvicorn main:app --reload --port 8000

# 终端 2 — 前端
cd frontend
npm ci
npm run dev   # http://127.0.0.1:8090
```

Vite proxy：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8000',
  },
}
```

---

## 12. 风险与不确定项

| 项 | 说明 | 缓解 |
|----|------|------|
| LLM 耗时长 | 单次分析 5~20 分钟 | SSE 心跳 + 进度条 + 允许后台跑 |
| stream 节点粒度 | tools 节点不产生 report | 用 tool_calls 事件填充工位屏幕 |
| 并发 stream | 多用户同时跑 | MVP 单进程内存；后续任务队列 |
| AkShare 搜索全量加载慢 | 首次 search 延迟 | 启动预热 + 本地 JSON 缓存 |
| 结构化 PM 输出解析 | 部分 provider 降级 free-text | 正则解析 Rating + 原文 fallback |
| 小马精灵使用范围 | 用户确认可复用 Marvis 小马形象 | 仅作 Agent 角色动画；不用品牌 Logo；UI 不出现「Marvis」字样；场景仍为原创交易大厅 |
| spritesheet 体积 | 多分辨率 @2x 资源较大 | 首屏 lazy load + 加载进度条（沿用 marvis App.vue 模式） |
| 分析师并行 | 默认串行 | 文档与动画按串行；配置项暴露后可增强 |
| Windows 代理 | AkShare 东方财富被拦 | 已有 `akshare_no_proxy` 配置 |

---

## 13. 验收标准（第一阶段）

- [x] 完成 TradingAgents 代码结构扫描
- [x] 完成 marvis-office 代码结构扫描
- [x] 输出本改造方案文档
- [x] 明确事件协议、API、组件、动画流程
- [x] 明确新增/修改文件清单
- [x] 选定 stream 方案 A，不修改 propagate
- [ ] **等待确认后进入第二阶段**

---

## 14. 附录：CLI 与可视化后端复用对照

```
cli/main.py                          backend/services/event_emitter.py
─────────────────────────────────────────────────────────────────────
graph.stream(init_state, **args)  →  同左（async 包装）
chunk messages tool_calls         →  tool_called 事件
update_analyst_statuses()         →  agent_started / report_ready
investment_debate_state diff      →  debate_message / debate_finished
risk_debate_state diff            →  risk_debate_message
trader_investment_plan            →  trader_proposal_ready
final_trade_decision              →  pm_decision_ready
trace merge → final_state         →  run_store.save_result()
```

---

**请确认本方案后，我将进入第二阶段：后端 MVP 实现。**
