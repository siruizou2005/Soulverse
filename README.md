# Soulverse

<div align="center">

**A "Parallel Universe" Social Sandbox Powered by Multi-Agent Simulation**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README_zh.md)

</div>

---

## Introduction

**Soulverse** is an innovative "parallel universe" social sandbox built on the **ScrollWeaver** multi-agent engine. Each user generates an AI soul — a digital twin agent — shaped by their interest graph and personality profile. This AI soul lives, socializes, and builds relationships autonomously in a persistent virtual world. Users can observe passively in **Observer Mode**, or take direct control at any moment in **Soul Possession Mode**.

---

## Key Features

- **Observer Mode** — Zero-pressure social interaction: watch your AI break the ice, make friends, and explore the world on your behalf.
- **Soul Possession Mode** — Take control at key moments and rewrite the story yourself.
- **Dynamic Matching** — Find soulmates based on real interaction stories generated between agents, not static profile tags.
- **Three-Layer Personality Model** — Core layer (cognition & traits), surface layer (language & behavior patterns), memory layer (experiences & relationships).
- **Multi-Agent Social System** — A full agent society with NPCs, user agents, locations, and world events.
- **Social Story Generation** — Automatically generates social interaction stories and daily activity reports.
- **Continuous Operation** — Designed for long-term runs (100+ rounds); stories continue even when users are offline.

---

## Architecture

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI + WebSocket |
| Multi-agent Engine | ScrollWeaver |
| LLM Support | OpenAI, Gemini, DeepSeek, Claude, Qwen, Doubao, Ollama, VLLM, OpenRouter |
| Vector Database | ChromaDB (RAG retrieval + long-term memory) |
| Embedding Model | BGE-small (bilingual CN/EN) |
| Session Management | Starlette SessionMiddleware |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 14 + React 18 |
| 3D Rendering | Three.js + React Three Fiber |
| UI | Tailwind CSS + Framer Motion |
| Charts | Chart.js + D3.js |

### Core Modules
| Module | Description |
|--------|-------------|
| `ScrollWeaver.py` | Multi-agent simulation engine |
| `modules/orchestrator.py` | World conductor — scene scheduling and event generation |
| `modules/user_agent.py` | User agent based on interest graph |
| `modules/npc_agent.py` | NPC agent (preset or dynamically created) |
| `modules/personality_model.py` | Three-layer personality model |
| `modules/social_story_generator.py` | Social story generator |
| `modules/daily_report.py` | Daily activity report generator |
| `modules/soulverse_mode.py` | Soulverse-specific simulation logic |
| `modules/profile_extractor.py` | User profile extraction from text/file/QA |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- At least one LLM API key (OpenAI / Gemini / DeepSeek / etc.)

### 1. Clone the Repository

```bash
git clone https://github.com/zousirui2005/Soulverse.git
cd Soulverse
```

### 2. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Configure

Edit `config.json` with your API keys:

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

**Key configuration options:**
- `role_llm_name` — LLM model used by agents
- `world_llm_name` — LLM model used for world simulation
- `embedding_model_name` — Embedding model for vector retrieval
- `preset_path` — Path to the simulation preset file
- `rounds` — Number of simulation rounds (100+ recommended for Soulverse mode)

### 5. Run

**Development mode — start backend:**
```bash
python server.py
# or
uvicorn server:app --host 127.0.0.1 --port 8001
```

**Development mode — start frontend (new terminal):**
```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs

**Production mode:**
```bash
cd frontend && npm run build && cd ..
python server.py
# Access at http://localhost:8001
```

**Docker:**
```bash
docker build -t soulverse .
docker run -p 8001:8001 soulverse
```

---

## Project Structure

```
Soulverse/
├── ScrollWeaver.py              # Multi-agent simulation engine
├── server.py                    # FastAPI server entry point
├── sw_utils.py                  # Shared utility functions
├── config.json                  # Configuration (API keys, model settings)
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Docker deployment
├── data/
│   ├── preset_agents/           # Preset NPC templates + embeddings
│   ├── locations/               # Virtual world locations
│   ├── maps/                    # World map data
│   └── worlds/soulverse_sandbox/ # World configuration
├── experiment_presets/
│   ├── soulverse_sandbox.json   # Sandbox mode preset
│   └── soulverse_1on1.json      # 1-on-1 chat mode preset
├── modules/
│   ├── core/                    # Config loading utilities
│   ├── db/                      # Database adapters (ChromaDB)
│   ├── llm/                     # LLM adapters (OpenAI, Gemini, DeepSeek, etc.)
│   ├── prompt/                  # Prompt templates (EN/ZH)
│   ├── server/                  # WebSocket room manager
│   ├── orchestrator.py          # World conductor
│   ├── user_agent.py            # User agent class
│   ├── npc_agent.py             # NPC agent class
│   ├── personality_model.py     # Three-layer personality model
│   ├── soulverse_mode.py        # Soulverse simulation mode
│   ├── social_story_generator.py
│   ├── daily_report.py
│   └── profile_extractor.py
├── extract_data/                # Tools for extracting world/role data
├── scripts/
│   └── init_preset_npcs.py      # Initialize preset NPC database
└── frontend/                    # Next.js frontend
    ├── app/                     # Next.js App Router pages
    ├── components/              # React components
    ├── services/api.js          # API client
    └── data/questionnaires.js   # Personality questionnaire data
```

---

## Usage Guide

### 1. Register / Login

Visit the login page at http://localhost:3000. Supports user registration and guest mode (auto-generates a temporary user ID).

### 2. Create Your Digital Twin Agent

**Via the UI creation wizard** — answer personality questions to generate your agent profile.

**Via API:**
```bash
# From Soul mock API (auto-generates personality profile)
POST /api/create-user-agent
{ "user_id": "user_001", "role_code": "my_agent" }

# From text description
POST /api/create-agent-from-text
{ "user_id": "user_001", "role_code": "my_agent", "text": "..." }

# From file upload
POST /api/create-agent-from-file  (multipart)

# From questionnaire answers
POST /api/create-agent-from-qa
{ "user_id": "user_001", "role_code": "my_agent", "answers": {...} }
```

### 3. Observer Mode

Watch your agent's autonomous social activity:
1. Open the Observer Mode panel in the Soulverse UI
2. Select your agent from the dropdown
3. View **Social Stories** — timestamped interaction logs from the last 24 hours
4. View **Daily Reports** — activity summaries and interaction statistics

### 4. Soul Possession Mode

Take direct control of your agent:
1. Select your agent from the character list
2. The system pauses and waits for your input when your agent needs to act
3. Type your agent's action or dialogue
4. Click "AI Auto-complete" to get AI-suggested options

### 5. Neural Matching

Find the most compatible agents based on interests, MBTI, and social goals:
```bash
POST /api/neural-match
{ "user_id": "user_001" }
```
Returns top 3 highly compatible agents + 2 random encounter suggestions.

### 6. Preset NPCs

Add pre-built NPC agents to the sandbox:
```bash
POST /api/add-preset-npc
{ "preset_id": "preset_001" }
```

Available presets: Literary Soul (INFP), Tech Geek (INTP), Sports Lover (ESFP), Creative Artist (ENFP), Food Explorer (ISFP), Philosopher (INFJ).

---

## API Reference

### User Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | POST | Login (supports guest mode) |
| `/api/register` | POST | Register new user |
| `/api/logout` | POST | Logout |
| `/api/user/me` | GET | Get current user info |

### Agent Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-user-agent` | POST | Create user agent |
| `/api/create-agent-from-text` | POST | Create agent from text |
| `/api/create-agent-from-file` | POST | Create agent from file |
| `/api/create-agent-from-qa` | POST | Create agent from QA |
| `/api/add-preset-npc` | POST | Add preset NPC |
| `/api/toggle-agent-sandbox` | POST | Toggle agent sandbox state |

### Social Features
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/get-social-story/{agent_code}` | GET | Get social story (supports `hours` param) |
| `/api/get-daily-report/{agent_code}` | GET | Get daily report (supports `date` param) |
| `/api/neural-match` | POST | Run neural matching |
| `/api/list-preset-agents` | GET | List all preset agents |

### Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ws/{client_id}` | WebSocket | Real-time chat connection |
| `/api/start-1on1-chat` | POST | Start 1-on-1 chat session |
| `/api/clear-chat-history` | POST | Clear chat history |

### System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reset-sandbox` | POST | Reset sandbox state |
| `/api/save-config` | POST | Save configuration |
| `/api/load-preset` | POST | Load simulation preset |

Full interactive API docs at: http://localhost:8001/docs

---

## Core Concepts

### Three-Layer Personality Model

1. **Core Layer** — MBTI type, Big Five traits, values, defense mechanisms
2. **Surface Layer** — Language style matrix (sentence length, vocabulary level, punctuation, emoji usage), catchphrases, few-shot examples
3. **Memory Layer** — Dynamic state (mood, energy), relationship map, long-term memory (ChromaDB vector store), short-term memory (recent interactions)

### ScrollWeaver Engine

- **Server** — Manages all agents and world state
- **Orchestrator** — World conductor: scene scheduling, event generation
- **Performer** (base class) → **UserAgent** / **NPCAgent**
- **HistoryManager** — Records all interactions
- **TimeSimulator** — Default 60x speed: 1 real minute = 1 virtual hour

### Soulverse Mode

- All agents are added dynamically via API
- Social scenes are generated based on agent interests
- Motivation is interest/goal-driven (not scripted)
- Supports continuous long-term operation

---

## Extending Soulverse

### Add a Custom Preset Agent

Edit `data/preset_agents/preset_agents.json`, then run:
```bash
python scripts/init_preset_npcs.py
```

### Add a New LLM Adapter

1. Create a new file in `modules/llm/`
2. Inherit from `BaseLLM`
3. Register in `sw_utils.py` → `get_models()`

### Customize World Settings

Edit `data/worlds/soulverse_sandbox/general.json` and restart the server.

---

## Contributing

Contributions are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## Citation

If you use this work, please cite:

```bibtex
@inproceedings{ran2025scrollweaver,
  title={BOOKWORLD: From Novels to Interactive Agent Societies for Story Creation},
  author={Ran, Yiting and Wang, Xintao and Qiu, Tian and Liang, Jiaqing and Xiao, Yanghua and Yang, Deqing},
  booktitle={Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)},
  pages={15898--15912},
  year={2025}
}
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

For questions, suggestions, or contributions: **alienet1109@163.com**

---

<div align="center">

**Ready to start your parallel life?**

[Get Started](#quick-start) · [API Docs](#api-reference) · [Contributing](#contributing)

</div>
