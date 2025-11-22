## 项目总概
自动从小说文本中提取所需信息，构建一个"活的"虚拟世界。在这个世界里，书中的角色（作为智能体）可以根据自己的目标和性格自主行动、互动，并"续写"出忠实于原作风格的新故事。

## 为什么这样命名

ScrollWeaver (织卷者) 是一个由指挥家 (Orchestrator) 和表演者 (Performer) 协同工作、响应玩家（执灯者）的行动，从而动态"编织"出独特故事（书卷）的魔法机器

## Introduction

ScrollWeaver is a comprehensive system for social simulation in fictional worlds through multi-agent interactions. The system features:

- Scene-based story progression with multiple character agents
- Continuous updating of agent memories, status, and goals
- World agent orchestration of the simulation
- Support for human intervention and control
- LLM-based story generation and refinement

## Setup

### Step 1. Clone the repository
```bash
git clone https://github.com/your-repo/scrollweaver.git
cd scrollweaver
```

### Step 2. Install dependencies

**Python dependencies:**
```bash
conda create -n scrollweaver python=3.10
conda activate scrollweaver
pip install -r requirements.txt
```

**Frontend dependencies:**
```bash
npm install
```

**Docker:**
```bash
docker build -t scrollweaver .
```

### Step 3. Configure Simulation Settings
Fill in the configuration parameters in `config.json`:
  - `role_llm_name`: LLM model for character roles
  - `world_llm_name`: LLM model for world simulation
  - `preset_path`: The path to the experiment preset
  - `if_save`: Enable/disable saving (1/0)
  - `scene_mode`: Scene progression mode
  - `rounds`: Number of simulation rounds
  - `mode`: Simulation mode ("free" or "script")

Then enter the API key of the LLM provider you're using either in `config.json` or through the frontend interface.

## Usage

### Step 1. Start the server
```bash
python server.py
```
or
```bash
uvicorn server:app --host 127.0.0.1 --port 8001  
```
Docker
```bash 
docker run -p 8001:8001 scrollweaver
```

### Step 2. Access the web interface
Open a browser and navigate to:
- Local Python: http://localhost:8001
- Local Docker: http://localhost:8001

### Step 3. Interact with the system
- Start/pause/stop story generation
- View character information and map details
- Monitor story progression and agent interactions
- Edit generated content if needed

### Step 4. Continue from previous simulation
1. Locate the directory of the previous simulation within `/experiment_saves/`
2. Set its path to the `save_dir` field in `config.json`. Ensure that the selected directory directly contains `server_info.json` and `orchestrator.json`.

## Frontend Development

### Development Mode
Start the frontend development server:
```bash
npm run dev
```
Frontend will run at `http://localhost:3000`.

Start the backend server (in another terminal):
```bash
python server.py
```
Backend will run at `http://localhost:8000` (or according to configured port).

### Build Production Version
```bash
npm run build
```
Build output will be in the `dist/` directory.

### Frontend Structure
```
frontend/
  src/
    components/     # React components
    services/       # API services
    App.jsx         # Main application component
    main.jsx        # Entry file
    index.css       # Global styles
```

### Frontend Features
1. **Landing Page**: Welcome page shown on first visit
2. **Login Page**: User login or guest mode
3. **Universe Interface**: Main interface including:
   - Neural matching sidebar (left)
   - Central chat area
   - Digital twin creation wizard
   - User status display

## Soulverse Mode

### Overview
Soulverse is a social sandbox mode that transforms the system from script-based role-playing to user-agent autonomous social interactions. The system supports two modes:

- **Observer Mode**: View your Agent's autonomous activities in the virtual world
- **Soul Possession Mode**: Fully control your Agent and participate in interactions

### Key Features
- **Social Scene Events**: Dynamic social scenarios based on Agent interests (e.g., book sharing sessions, coffee meetups)
- **Social Motivation**: Motivation generation based on social goals and interests (not script-based)
- **Continuous Operation**: Supports long-term running (100+ rounds)
- **Social Story Generation**: Generate social interaction stories and daily reports

### Creating User Agents

1. **Open Soulverse Panel**
   - Click the "Soulverse" tab in the right toolbar

2. **Fill Information**
   - User ID: Enter your user identifier (e.g., `user_001`)
   - Agent Code: Enter unique Agent code (e.g., `my_agent_001`)

3. **Create Agent**
   - Click "Create Agent" button
   - System automatically fetches your interest profile from Soul mock API (interests, MBTI, personality)
   - Agent is automatically added to sandbox after creation

### Observer Mode
**Function**: View your Agent's autonomous activities in the virtual world

**Usage Steps**:
1. In the "Observer Mode" area of Soulverse panel
2. Select your Agent from dropdown
3. Click "View Social Story" to see recent 24-hour interaction records
4. Click "View Daily Report" to see daily activity summary

**View Content**:
- Social Story: All interaction records of Agent, sorted chronologically
- Social Daily Report: Contains summary, highlight events, interaction statistics, etc.

### Soul Possession Mode
**Function**: Fully control your Agent and participate in interactions

**Usage Steps**:
1. Select your Agent from left character list (or via "Select Character" button)
2. System automatically detects this is a user Agent and enters Soul Possession mode
3. When Agent needs action, system pauses and waits for your input
4. Enter Agent's action/dialogue in input box
5. Click "AI Auto Complete" button to get AI-suggested action options

**Mode Switching**:
- Click "Enter Soul Possession" button to manually switch mode
- In Observer Mode, Agent acts autonomously, you can only view
- In Soul Possession Mode, all Agent actions require your input

### API Endpoints

**Create User Agent:**
```bash
POST /api/create-user-agent
Body: {
  "user_id": "user_001",
  "role_code": "my_agent_001",
  "soul_profile": {...}  # Optional, auto-generated if not provided
}
```

**Get Social Story:**
```bash
GET /api/get-social-story/{agent_code}?hours=24
```

**Get Daily Report:**
```bash
GET /api/get-daily-report/{agent_code}?date=2024-01-01
```

### Soulverse Mode Detection
System detects Soulverse mode through:
- `source == "soulverse"`
- `performer_codes` is empty list (indicating only user Agents)

### Differences: Script Mode vs Soulverse Mode

| Feature | Script Mode | Soulverse Mode |
|---------|-------------|----------------|
| World Setting | Novel world (e.g., Game of Thrones) | Modern social scenes (cafes, libraries, etc.) |
| Character Source | Preset novel characters | User-created Agents |
| Event Type | Script events (e.g., Red Wedding) | Social scene events (e.g., book sharing) |
| Motivation | Based on script and events | Based on social goals and interests |
| Operation | Fixed rounds | Continuous operation (100+ rounds) |
| Goal | Advance script plot | Build social relationships |

## Customization

### Construct Your Virtual World Manually
1. Create the roles, map, worldbuilding following the examples given in `/data/`. Additionally, you can place an image named `icon.(png/jpg)` inside the character's folder — this will be used as the avatar displayed in the interface.
2. You can improve the simulation quality by providing background settings about the world in `world_details/` or put character dialogue lines in `role_lines.jsonl`. 
3. Enter the preset path to `preset_path` in `config.json`.

### Extract Role, Location, and Setting Data Automatically

Utilize the script provided in `/extract_data/` to extract key story elements using LLMs.

<font color="red">
⚠️ Note: We are sorry that the extraction code is currently unstable and may not produce reliable results. We recommend manually entering the character profiles and descriptions, or using data from sources such as Wikipedia. You can quickly generate a template for location and character information by setting <code>if_auto_extract</code> to 0 in <code>extract_config.json</code>.
</font>
<br><br>

**1. Configure the extraction model and API key in `extract_config.json`:**

* `book_path`: Path to the input book file. We currently support `.epub` (recommended), `.pdf`, and `.txt` formats.
* `language`: The language of the book (e.g., `en`, `zh`). If not specified, the program will attempt to detect it automatically.
* `book_source`: The title or name of the book. If omitted, the program will try to infer it from the file.
* `target_character_names`: A list of characters to extract information about. It's best to use names or nicknames that appear most frequently in the text, rather than full formal names. If not provided, the program will attempt to extract them automatically. **For higher-quality results, we strongly recommend specifying this field.**
* `target_location_names`: A list of important locations. Again, using the most frequently occurring name or common synonym improves accuracy. If omitted, locations will be extracted automatically. **For higher-quality results, we strongly recommend specifying this field.**

**2. Run the script**

  Characters and Locations

  ```bash
  python extract_data.py
  ``` 

  Settings

  ```bash
  python extract_settings.py
  ```

### Convert SillyTavern Character Cards to Role Data

1. Put your character cards in `/data/sillytavern_cards/`.
2. Run the script. It will convert all the cards into the role data that ScrollWeaver needs.
```bash
python convert_sillytavern_cards_to_data.py
```
3. Input role codes of all the characters participating in this simulation to `performer_codes` in the preset file.

### Preset Agents Migration

All preset templates (`modules/preset_agents.py`) use the new three-layer personality model format:

1. **preset_001 - Literary Youth** (INFP)
2. **preset_002 - Tech Geek** (INTP)
3. **preset_003 - Sports Enthusiast** (ESFP)
4. **preset_004 - Artistic Creator** (ENFP)
5. **preset_005 - Food Explorer** (ISFP)
6. **preset_006 - Philosophical Thinker** (INFJ)

**Create Preset Agent via API:**
```bash
POST /api/add-preset-npc
{
  "preset_id": "preset_001",
  "custom_name": "Custom Name (optional)",
  "role_code": "Custom role_code (optional)"
}
```

**New Format Features:**
Each newly created preset Agent includes:
1. **Three-layer personality model data** (`personality_profile`)
   - Core layer: MBTI, Big Five, values, defense mechanisms
   - Surface layer: Language style matrix (sentence length, vocabulary, punctuation, expressions, catchphrases, etc.)
   - Memory layer: Dynamic state (mood, energy value, relationship mapping)
2. **Few-Shot samples** (`style_examples`) - Dialogue samples for style learning
3. **Language style vector database** (`style_vector_db_name`) - For retrieving historical speech styles

## Testing

### Test Examples

**Basic Social Interaction:**
Create two user Agents with similar interests, observe how they meet in a cafe and establish connections.

**Different Interest Agent Exploration:**
Create three Agents with different interests, observe how they explore and interact in different scenarios.

**Social Story Generation:**
After running a simulation, generate social stories and daily reports for specific Agents.

Run test script:
```bash
python test_soulverse.py
```

### Verification Points

1. **Soulverse Mode Detection**: Confirm `scrollweaver.server.is_soulverse_mode == True`
2. **Motivation Generation**: Confirm UserAgent's motivation contains social goals
3. **Agent Behavior**: Confirm Agents choose scenes based on interests and actively interact
4. **Social Stories**: Confirm stories focus on social interactions with accurate statistics

## Implementation Summary

### Completed Work

1. **Project Infrastructure Setup** ✅
   - Created `package.json` for React project configuration
   - Configured Vite as build tool
   - Set up Tailwind CSS and PostCSS
   - Created frontend entry files and style files

2. **Preset Agents Extraction** ✅
   - Extracted preset data from `modules/preset_agents.py` to `data/preset_agents/preset_agents.json`
   - Modified `modules/preset_agents.py` to load presets from JSON file (backward compatible)

3. **User Session Management System** ✅
   - Created `data/users/` directory for storing user data
   - Implemented API endpoints: login, register, user info, digital twin management
   - Used Starlette SessionMiddleware for session management
   - User data stored as JSON in `data/users/{user_id}.json`

4. **Neural Matching API** ✅
   - Implemented `POST /api/neural-match` endpoint
   - Uses simplified matching algorithm to calculate compatibility between user digital twin and preset agents
   - Returns Top 3 perfect resonance and 2 random encounters
   - Matching algorithm based on interest similarity, MBTI compatibility, and social goal matching

5. **React Frontend Components** ✅
   - Created components: CosmicBackground, CreationWizard, LandingPage, LoginPage, UniverseView, NeuralMatching, ChatInterface, UserAgentStatus, App

6. **API Services** ✅
   - Created `frontend/src/services/api.js` to manage all API calls
   - Includes user authentication, digital twin management, neural matching, Agent creation, etc.

7. **Soulverse Mode Implementation** ✅
   - Created `modules/soulverse_mode.py` for Soulverse-specific logic
   - Refactored UserAgent class to use Soulverse mode social motivation
   - Modified ScrollWeaver core logic to support Soulverse mode
   - Created Soulverse world configuration files

## Directory Structure

```
.
├── data/
│   ├── preset_agents/     # Preset agent data
│   ├── users/             # User data directory
│   ├── roles/             # Character roles
│   ├── locations/         # Location data
│   ├── maps/              # Map data
│   └── worlds/            # World configurations
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── src/
│       ├── components/    # React components
│       ├── services/      # API services
│       ├── App.jsx
│       └── main.jsx
├── modules/
│   ├── db/
│   ├── llm/
│   ├── prompt/
│   ├── soulverse_mode.py  # Soulverse mode logic
│   ├── user_agent.py      # User agent implementation
│   ├── main_performer.py
│   └── orchestrator.py
├── experiment_presets/     # Experiment preset configurations
├── ScrollWeaver.py
├── server.py
├── config.json
└── index.html
```

## Known Issues & Improvements

### High Priority Improvements
1. **Mode Status Display**: Show current mode (Observer/Soul Possession) at top of interface
2. **Auto-refresh After Agent Creation**: Character list automatically updates
3. **Time Control Panel**: Add time acceleration and pause functionality

### Medium Priority Improvements
4. **Social Story Timeline View**: More user-friendly display
5. **Mode Switching Optimization**: Smoother switching experience
6. **Agent Creation Flow Optimization**: Auto-generate codes and preview

### Low Priority Improvements
7. **Relationship Network Visualization**: Social network graph
8. **Real-time Notification System**: Push important events
9. **Data Analysis Panel**: Deeper statistics and analysis

## Notes

1. **Agent Code Must Be Unique**: Creation will fail if Agent code already exists
2. **Time Acceleration**: System default is 1 real minute = 1 virtual hour (60x speed)
3. **Multi-user Support**: Multiple user Agents can interact in the same sandbox
4. **Data Persistence**: Currently demo version, data is not persistently saved
5. **WebSocket Connection**: Requires backend support
6. **Soulverse Mode**: System automatically detects Soulverse mode through `source == "soulverse"` or empty `performer_codes`

## Authors and Citation
**Authors:** Yiting Ran, Xintao Wang, Tian Qiu,
Jiaqing Liang, Yanghua Xiao, Deqing Yang.

```bibtex
@inproceedings{ran2025scrollweaver,
  title={BOOKWORLD: From Novels to Interactive Agent Societies for Story Creation},
  author={Ran, Yiting and Wang, Xintao and Qiu, Tian and Liang, Jiaqing and Xiao, Yanghua and Yang, Deqing},
  booktitle={Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)},
  pages={15898--15912},
  year={2025}
}
```

## Contact

ScrollWeaver is a foundational framework that we aim to continuously optimize and enrich with custom modules. We welcome and greatly appreciate your suggestions and contributions!

If you have any suggestions or would like to contribute, please contact us at: alienet1109@163.com
