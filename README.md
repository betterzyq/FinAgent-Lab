# FinAgent-Lab

**A 股多智能体投研可视化实验室** — 将 LangGraph 多 Agent 分析流程实时映射为 SSE 事件，驱动 Vue + PixiJS 交易大厅动画与报告面板。

> 仅供研究与工程演示，**不构成任何投资建议**。

## 特性

- **13 个 Agent 全链路可视化**：分析师 → 研究辩论 → 交易提案 → 风控辩论 → PM 决策
- **SSE 实时事件流**：15 种统一事件驱动状态栏、报告、辩论与时间线
- **PixiJS 交易大厅**：工位 / 辩论室 / 交易台 / 风控室分区动画与任务交接
- **三档演示模式**：纯前端 Mock、后端 Mock（~15s / 0 Token）、真实 LLM 分析
- **前后端分离**：FastAPI + Vue 3 + TypeScript，Mock 与真实运行共用同一协议

前端交互与精灵动画部分受到 [腾讯 Marvis Office](https://github.com/Tencent/marvis-office) 的启发，场景已独立设计为金融投研作战室。

## 仓库结构

```
FinAgent-Lab/
├── backend/          # FastAPI、SSE、LangGraph stream 桥接
├── frontend/         # Vue 3 + PixiJS 可视化
├── docs/             # 使用说明与开发文档
├── .env.example      # LLM 等环境变量模板
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js ^20.19 或 >=22.12
- 真实分析：已安装多智能体 LangGraph 引擎 Python 包 `tradingagents`（见下方说明）

### 1. 后端

```bash
# 克隆后于项目根目录
cp .env.example .env          # 编辑 DEEPSEEK_API_KEY 等

pip install tradingagents     # 多智能体分析引擎（PyPI / 本地 editable 安装均可）
pip install -r backend/requirements.txt

uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

- API 文档：http://127.0.0.1:8000/docs  
- 健康检查：http://127.0.0.1:8000/api/health  

也可将引擎源码置于 `agent-engine/` 后执行 `pip install -e agent-engine`（该目录已 gitignore，不随本仓库发布）。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://127.0.0.1:5173（`/api` 已代理到后端 8000 端口）。

### 3. 体验流程

1. 打开前端，确认右上角「已连接」
2. 输入股票代码（如 `600519`），可先勾选「后端 Mock」体验完整动画
3. 取消 Mock 并配置 `.env` 中的 LLM Key 后可运行真实分析

更详细说明见 [docs/使用文档.md](docs/使用文档.md)。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI · Uvicorn · Pydantic · SSE · asyncio |
| 前端 | Vue 3 · TypeScript · Vite · Pinia · PixiJS |
| Agent | LangGraph · Tool Calling · 多 LLM Provider |
| 数据 | AkShare（A 股行情 / 财报 / 新闻） |

## 文档

- [使用文档](docs/使用文档.md)
- [后端说明](backend/README.md)
- [前端说明](frontend/README.md)

## 免责声明

本仓库输出仅供学术研究、技术演示与工程验证，不构成任何形式的投资建议、荐股或交易指令。股市有风险，投资需谨慎。

## License

MIT（如目录中无 LICENSE 文件，以仓库 Settings 为准。）
