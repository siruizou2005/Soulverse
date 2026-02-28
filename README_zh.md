# Soulverse

<div align="center">

**基于多 Agent 模拟的"平行时空"社交沙盒**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README_zh.md)

</div>

---

## 项目概述

**Soulverse** 是一个创新的"平行时空"社交沙盒，基于 **ScrollWeaver** 多智能体引擎构建。每位用户可以依据自己的兴趣图谱和人格画像生成一个"AI 灵魂"（数字孪生 Agent），这个 AI 灵魂能在持续运行的虚拟世界中自主生活、结识同类、建立关系。用户既可以在**观察者模式**下零压力旁观，也可以随时切换**灵魂降临模式**亲自掌控剧情走向。

---

## 核心特性

- **观察者模式** — 零压力社交：看着你的 AI 替你破冰、交友、探索世界
- **灵魂降临模式** — 关键时刻一键接管，亲自改写剧情
- **动态匹配** — 基于 Agent 间真实互动故事寻找灵魂伴侣，而非静态标签
- **三层人格模型** — 内核层（认知与特质）、表象层（语言与行为模式）、记忆层（经历与关系）
- **多 Agent 社会系统** — 包含 NPC、用户 Agent、地点、世界事件的完整 Agent 社会
- **社交故事生成** — 自动生成社交互动故事和每日活动报告
- **持续运行** — 支持长期运行（100+ 轮次），即使用户离线故事也在延续

---

## 技术架构

### 后端
| 组件 | 技术 |
|------|------|
| 框架 | FastAPI + WebSocket |
| 多智能体引擎 | ScrollWeaver |
| LLM 支持 | OpenAI, Gemini, DeepSeek, Claude, Qwen, Doubao, Ollama, VLLM, OpenRouter |
| 向量数据库 | ChromaDB（RAG 检索 + 长期记忆存储）|
| 嵌入模型 | BGE-small（中英文双语）|
| 会话管理 | Starlette SessionMiddleware |

### 前端
| 组件 | 技术 |
|------|------|
| 框架 | Next.js 14 + React 18 |
| 3D 渲染 | Three.js + React Three Fiber |
| UI | Tailwind CSS + Framer Motion |
| 图表 | Chart.js + D3.js |

### 核心模块
| 模块 | 描述 |
|------|------|
| `ScrollWeaver.py` | 多智能体模拟引擎 |
| `modules/orchestrator.py` | 世界指挥家——场景调度与事件生成 |
| `modules/user_agent.py` | 用户 Agent，基于兴趣图谱构建 |
| `modules/npc_agent.py` | NPC Agent（预设模板或动态创建）|
| `modules/personality_model.py` | 三层人格模型 |
| `modules/social_story_generator.py` | 社交故事生成器 |
| `modules/daily_report.py` | 每日活动报告生成器 |
| `modules/soulverse_mode.py` | Soulverse 专属模拟逻辑 |
| `modules/profile_extractor.py` | 从文本/文件/问答提取用户画像 |

---

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- npm 或 yarn
- 至少一个 LLM API Key（OpenAI / Gemini / DeepSeek 等）

### 1. 克隆仓库

```bash
git clone https://github.com/zousirui2005/Soulverse.git
cd Soulverse
```

### 2. 安装 Python 依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 4. 配置

编辑 `config.json`，填入你的 API Key：

```json
{
    "role_llm_name": "gemini-2.5-flash-lite",
    "world_llm_name": "gemini-2.5-flash-lite",
    "embedding_model_name": "bge-small",
    "preset_path": "./experiment_presets/soulverse_sandbox.json",
    "rounds": 100,
    "mode": "free",

    "OPENAI_API_KEY": "your-openai-api-key",
    "GEMINI_API_KEY": "your-gemini-api-key",
    "DEEPSEEK_API_KEY": "your-deepseek-api-key"
}
```

**关键配置说明：**
- `role_llm_name` — Agent 使用的 LLM 模型
- `world_llm_name` — 世界模拟使用的 LLM 模型
- `embedding_model_name` — 向量检索嵌入模型
- `preset_path` — 模拟预设文件路径
- `rounds` — 模拟轮次（Soulverse 模式建议 100+）

### 5. 运行

**开发模式——启动后端：**
```bash
python server.py
# 或
uvicorn server:app --host 127.0.0.1 --port 8001
```

**开发模式——启动前端（新终端）：**
```bash
cd frontend
npm run dev
```

访问地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8001
- API 文档：http://localhost:8001/docs

**生产模式：**
```bash
cd frontend && npm run build && cd ..
python server.py
# 访问：http://localhost:8001
```

**Docker 部署：**
```bash
docker build -t soulverse .
docker run -p 8001:8001 soulverse
```

---

## 项目结构

```
Soulverse/
├── ScrollWeaver.py              # 多智能体模拟引擎
├── server.py                    # FastAPI 服务器入口
├── sw_utils.py                  # 通用工具函数
├── config.json                  # 配置文件（API Key、模型设置）
├── requirements.txt             # Python 依赖
├── Dockerfile                   # Docker 部署配置
├── data/
│   ├── preset_agents/           # 预设 NPC 模板及嵌入向量
│   ├── locations/               # 虚拟世界地点数据
│   ├── maps/                    # 世界地图数据
│   └── worlds/soulverse_sandbox/ # 世界配置
├── experiment_presets/
│   ├── soulverse_sandbox.json   # 沙盒模式预设
│   └── soulverse_1on1.json      # 一对一聊天模式预设
├── modules/
│   ├── core/                    # 配置加载工具
│   ├── db/                      # 数据库适配器（ChromaDB）
│   ├── llm/                     # LLM 适配器（OpenAI、Gemini、DeepSeek 等）
│   ├── prompt/                  # 提示词模板（中英文）
│   ├── server/                  # WebSocket 房间管理器
│   ├── orchestrator.py          # 世界指挥家
│   ├── user_agent.py            # 用户 Agent 类
│   ├── npc_agent.py             # NPC Agent 类
│   ├── personality_model.py     # 三层人格模型
│   ├── soulverse_mode.py        # Soulverse 模拟模式
│   ├── social_story_generator.py
│   ├── daily_report.py
│   └── profile_extractor.py
├── extract_data/                # 世界/角色数据提取工具
├── scripts/
│   └── init_preset_npcs.py      # 初始化预设 NPC 数据库
└── frontend/                    # Next.js 前端
    ├── app/                     # Next.js App Router 页面
    ├── components/              # React 组件
    ├── services/api.js          # API 客户端
    └── data/questionnaires.js   # 人格问卷数据
```

---

## 使用指南

### 1. 注册 / 登录

访问 http://localhost:3000，支持用户注册和访客模式（自动生成临时用户 ID）。

### 2. 创建数字孪生 Agent

**通过 UI 创建向导** — 回答人格问卷，自动生成 Agent 画像。

**通过 API：**
```bash
# 从 Soul mock API（自动生成人格画像）
POST /api/create-user-agent
{ "user_id": "user_001", "role_code": "my_agent" }

# 从文本描述
POST /api/create-agent-from-text
{ "user_id": "user_001", "role_code": "my_agent", "text": "..." }

# 从文件上传
POST /api/create-agent-from-file  (multipart)

# 从问卷答案
POST /api/create-agent-from-qa
{ "user_id": "user_001", "role_code": "my_agent", "answers": {...} }
```

### 3. 观察者模式

查看你的 Agent 在虚拟世界中的自主社交活动：
1. 打开 Soulverse 界面中的"观察者模式"面板
2. 从下拉菜单选择你的 Agent
3. 查看**社交故事** — 最近 24 小时的互动记录（按时间排序）
4. 查看**每日报告** — 活动摘要和互动统计

### 4. 灵魂降临模式

直接控制你的 Agent：
1. 从角色列表选择你的 Agent
2. 当 Agent 需要行动时，系统暂停并等待你的输入
3. 在输入框中填写 Agent 的行动或对话
4. 点击"AI 自动补全"获取 AI 建议的行动选项

### 5. 神经匹配

基于兴趣、MBTI 和社交目标匹配最适合的 Agent：
```bash
POST /api/neural-match
{ "user_id": "user_001" }
```
返回 Top 3 高度契合 Agent + 2 个随机邂逅建议。

### 6. 预设 NPC

向沙盒添加预置 NPC Agent：
```bash
POST /api/add-preset-npc
{ "preset_id": "preset_001" }
```

可用预设：文艺青年 (INFP)、科技极客 (INTP)、运动爱好者 (ESFP)、艺术创作者 (ENFP)、美食探索家 (ISFP)、哲学思考者 (INFJ)。

---

## API 文档

### 用户管理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/login` | POST | 用户登录（支持访客模式）|
| `/api/register` | POST | 注册新用户 |
| `/api/logout` | POST | 退出登录 |
| `/api/user/me` | GET | 获取当前用户信息 |

### Agent 管理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/create-user-agent` | POST | 创建用户 Agent |
| `/api/create-agent-from-text` | POST | 从文本创建 Agent |
| `/api/create-agent-from-file` | POST | 从文件创建 Agent |
| `/api/create-agent-from-qa` | POST | 通过问答创建 Agent |
| `/api/add-preset-npc` | POST | 添加预设 NPC |
| `/api/toggle-agent-sandbox` | POST | 切换 Agent 沙盒状态 |

### 社交功能
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/get-social-story/{agent_code}` | GET | 获取社交故事（支持 `hours` 参数）|
| `/api/get-daily-report/{agent_code}` | GET | 获取每日报告（支持 `date` 参数）|
| `/api/neural-match` | POST | 运行神经匹配 |
| `/api/list-preset-agents` | GET | 列出所有预设 Agent |

### 聊天功能
| 端点 | 方法 | 说明 |
|------|------|------|
| `/ws/{client_id}` | WebSocket | 实时聊天连接 |
| `/api/start-1on1-chat` | POST | 启动一对一聊天 |
| `/api/clear-chat-history` | POST | 清空聊天历史 |

### 系统管理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/reset-sandbox` | POST | 重置沙盒状态 |
| `/api/save-config` | POST | 保存配置 |
| `/api/load-preset` | POST | 加载模拟预设 |

完整交互式 API 文档请访问：http://localhost:8001/docs

---

## 核心概念

### 三层人格模型

1. **内核层** — MBTI 类型、大五人格（Big Five）、价值观、防御机制
2. **表象层** — 语言风格矩阵（句长偏好、词汇等级、标点习惯、表情使用频率）、口头禅、Few-Shot 样本
3. **记忆层** — 动态状态（心情、能量值）、关系映射、长期记忆（ChromaDB 向量存储）、短期记忆（近期互动）

### ScrollWeaver 引擎

- **Server** — 管理所有 Agent 和世界状态
- **Orchestrator** — 世界指挥家：场景调度、事件生成
- **Performer**（基类）→ **UserAgent** / **NPCAgent**
- **HistoryManager** — 记录所有互动历史
- **TimeSimulator** — 默认 60 倍速：1 实际分钟 = 1 虚拟小时

### Soulverse 模式

- 所有 Agent 通过 API 动态添加
- 社交场景基于 Agent 兴趣动态生成
- 行动动机由兴趣与目标驱动（非脚本）
- 支持长期持续运行

---

## 自定义与扩展

### 添加自定义预设 Agent

编辑 `data/preset_agents/preset_agents.json`，然后运行：
```bash
python scripts/init_preset_npcs.py
```

### 添加新的 LLM 适配器

1. 在 `modules/llm/` 目录创建新文件
2. 继承 `BaseLLM` 基类
3. 在 `sw_utils.py` 的 `get_models()` 函数中注册

### 自定义世界设定

编辑 `data/worlds/soulverse_sandbox/general.json`，重启服务器生效。

---

## 贡献指南

欢迎任何形式的贡献！

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/your-feature`）
3. 提交更改（`git commit -m 'Add some feature'`）
4. 推送分支（`git push origin feature/your-feature`）
5. 开启 Pull Request

---

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

---

## 联系方式

如有任何问题、建议或想要贡献，请联系：**siruizou2005@gmail.com**

---

<div align="center">

**准备好开启你的平行人生了吗？**

[快速开始](#快速开始) · [API 文档](#api-文档) · [贡献指南](#贡献指南)

</div>

