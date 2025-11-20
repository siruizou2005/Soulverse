# 预设Agent迁移完成

## 已完成的工作

### 1. 删除旧的预设Agent
- ✅ 已删除 `data/roles/soulverse_npcs/` 目录下的所有旧预设Agent实例
- ✅ 旧格式的预设Agent已完全清理

### 2. 代码更新
- ✅ `ScrollWeaver.py`: `add_npc_agent()` 方法已更新，支持 `preset_id` 参数
- ✅ `server.py`: `/api/add-preset-npc` 接口已更新，使用 `preset_id` 创建Agent
- ✅ `NPCAgent`: 已支持使用 `preset_id` 自动生成三层人格模型

### 3. 预设模板
所有预设模板（`modules/preset_agents.py`）已更新为使用新的三层人格模型格式：

1. **preset_001 - 文艺青年** (INFP)
2. **preset_002 - 科技极客** (INTP)
3. **preset_003 - 运动达人** (ESFP)
4. **preset_004 - 艺术创作者** (ENFP)
5. **preset_005 - 美食探索家** (ISFP)
6. **preset_006 - 哲学思考者** (INFJ)

## 创建新的预设Agent

### 方式1: 通过API（推荐）

```bash
POST /api/add-preset-npc
{
  "preset_id": "preset_001",
  "custom_name": "自定义名称（可选）",
  "role_code": "自定义role_code（可选）"
}
```

### 方式2: 通过代码

```python
from modules.npc_agent import NPCAgent

npc_agent = NPCAgent(
    role_code="npc_preset_001",
    role_name="文艺青年",
    world_file_path="data/worlds/soulverse_sandbox/general.json",
    preset_id="preset_001"  # 使用preset_id，自动生成三层人格模型
)
```

## 新格式特性

每个新创建的预设Agent都包含：

1. **三层人格模型数据** (`personality_profile`)
   - 内核层：MBTI、Big Five、价值观、防御机制
   - 表象层：语言风格矩阵（句长、词汇、标点、表情、口头禅等）
   - 记忆层：动态状态（心情、能量值、关系映射）

2. **Few-Shot样本** (`style_examples`)
   - 用于风格学习的对话样本

3. **语言风格向量数据库** (`style_vector_db_name`)
   - 用于检索历史发言风格

## 注意事项

- 旧的预设Agent已全部删除，不会影响新Agent的创建
- 新创建的Agent会自动使用三层人格模型格式
- 系统会在关键交互时自动启用双重思维链
- 动态状态会在每次交互后自动更新

## 验证

创建新的预设Agent后，可以检查 `role_info.json` 文件，确认包含：
- `personality_profile`: 完整的三层人格模型数据
- `style_examples`: Few-Shot样本列表
- `style_vector_db_name`: 风格向量库名称

