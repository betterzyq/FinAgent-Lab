# FinAgent-Lab · Frontend

A 股智能投研交易室可视化前端（Vue 3 + TypeScript + PixiJS + Pinia）。

精灵角色与事件驱动动画的部分交互思路受到 [腾讯 Marvis Office](https://github.com/Tencent/marvis-office) 启发；场景与业务布局为独立设计的金融投研大厅。

## 安装

```bash
cd frontend
npm install
```

## 开发

```bash
# 终端 1 — 项目根目录
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# 终端 2
cd frontend && npm run dev
```

http://127.0.0.1:5173

## 演示模式

| 模式 | 说明 |
|------|------|
| 纯前端 Mock | 无需后端，本地事件脚本 |
| 后端 Mock | `POST /api/runs?mock=true` |
| 真实分析 | 需后端 + `.env` 中 LLM Key |

## 构建

```bash
npm run typecheck
npm run build
```

## 免责声明

仅供研究与演示，不构成投资建议。
