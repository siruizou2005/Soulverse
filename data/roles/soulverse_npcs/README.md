# 预设NPC Agent目录

此目录用于存储使用**三层人格模型**格式创建的预设NPC Agent。

## 预设模板

系统提供了6个预设模板（定义在 `modules/preset_agents.py`）：

1. **preset_001 - 文艺青年** (INFP)
   - 兴趣：阅读、电影、音乐、旅行、摄影、咖啡
   - 性格：理想主义、富有创造力，喜欢深度思考和独处

2. **preset_002 - 科技极客** (INTP)
   - 兴趣：编程、AI、科技、游戏、动漫、科幻
   - 性格：逻辑思维强，喜欢探索新技术

3. **preset_003 - 运动达人** (ESFP)
   - 兴趣：运动、健身、跑步、旅行、美食、咖啡
   - 性格：外向活跃，充满活力，喜欢户外活动

4. **preset_004 - 艺术创作者** (ENFP)
   - 兴趣：绘画、设计、艺术、摄影、音乐、时尚
   - 性格：富有创造力，热情洋溢，喜欢表达自我

5. **preset_005 - 美食探索家** (ISFP)
   - 兴趣：美食、烹饪、烘焙、咖啡、茶道、旅行
   - 性格：享受生活，注重细节，喜欢尝试新口味

6. **preset_006 - 哲学思考者** (INFJ)
   - 兴趣：哲学、心理学、阅读、历史、文学、思考
   - 性格：深度思考，富有洞察力，喜欢探讨人生意义

## 创建新的预设NPC Agent

### 通过API创建

使用 `/api/add-preset-npc` 接口：

```json
{
  "preset_id": "preset_001",
  "custom_name": "自定义名称（可选）",
  "role_code": "自定义role_code（可选）"
}
```

### 通过代码创建

```python
from modules.npc_agent import NPCAgent
from modules.preset_agents import PresetAgents

# 使用preset_id创建（推荐）
npc_agent = NPCAgent(
    role_code="npc_preset_001",
    role_name="文艺青年",
    world_file_path="data/worlds/soulverse_sandbox/general.json",
    preset_id="preset_001"  # 使用preset_id，自动生成三层人格模型
)
```

## 三层人格模型格式

每个预设Agent都包含完整的三层人格模型：

1. **内核层（CoreTraits）**
   - MBTI类型
   - Big Five人格评分（5个维度0-1评分）
   - 价值观列表
   - 防御机制

2. **表象层（SpeakingStyle）**
   - 句长偏好
   - 词汇等级
   - 标点习惯
   - 表情使用（频率、偏好、避免）
   - 口头禅
   - 语气词

3. **记忆层（DynamicState）**
   - 当前心情
   - 能量值（0-100）
   - 关系映射（亲密度、历史摘要）

## 文件结构

每个预设Agent的目录结构：

```
npc_preset_XXX_YYYY/
├── role_info.json          # 角色信息（包含personality_profile）
└── role_data.jsonl         # 角色数据（可选）
```

`role_info.json` 中包含：
- `personality_profile`: 完整的三层人格模型数据（JSON格式）
- `style_examples`: Few-Shot对话样本
- `style_vector_db_name`: 语言风格向量数据库名称

