# FinAgent-Lab · Backend

FastAPI 服务：为前端提供 Agent 运行 **SSE 事件流**、任务状态与最终决策。

## 安装

```bash
# 项目根目录
cp .env.example .env

pip install tradingagents
pip install -r backend/requirements.txt
```

真实分析需已安装 `tradingagents` Python 包；也可将引擎源码放在 `agent-engine/` 后 `pip install -e agent-engine`。

**DeepSeek**：在 `.env` 中设置 `DEEPSEEK_API_KEY` 即可，后端会自动识别 Provider 与默认模型。

## 启动

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

- http://127.0.0.1:8000/docs  
- http://127.0.0.1:8000/api/health  

## Mock 测试

```bash
curl -X POST "http://127.0.0.1:8000/api/runs?mock=true" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"600519","company_name":"贵州茅台","trade_date":"2026-06-18","debate_rounds":2,"risk_rounds":2}'
```

## 架构要点

- 通过 `graph.stream(updates)` 旁路观测 LangGraph，不侵入引擎 CLI
- `StreamEventTranslator` 将节点增量映射为 15 种 SSE 事件
- `EventBus` 扇出推送；`RunStore` 内存持久化（重启丢失）
- 同步图执行在 `asyncio.to_thread`，经 threadsafe 回调注入 SSE

## 免责声明

输出仅供研究演示，不构成投资建议。
