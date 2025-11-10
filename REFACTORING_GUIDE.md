# Soulverse重构指南

## 重构概述

本次重构将系统从**剧本角色扮演模式**转换为**Soulverse社交沙盒模式**，使系统能够支持用户Agent的自主社交互动。

## 核心变化

### 1. 新增Soulverse专用模式

**文件**: `modules/soulverse_mode.py`

- `SoulverseMode`类：管理Soulverse模式的专用逻辑
- `generate_social_event()`: 生成社交场景事件（而非剧本事件）
- `generate_social_motivation()`: 基于社交目标生成motivation（而非剧本motivation）

### 2. 重构UserAgent类

**文件**: `modules/user_agent.py`

- 重写`set_motivation()`方法，使用Soulverse模式的社交motivation
- 集成`SoulverseMode`，自动生成基于兴趣和社交目标的motivation

### 3. 修改ScrollWeaver核心逻辑

**文件**: `ScrollWeaver.py`

- 添加`is_soulverse_mode`标志，自动检测Soulverse模式
- 修改goal setting逻辑，支持Soulverse模式的社交motivation
- 修改事件生成逻辑，在Soulverse模式下生成社交场景事件

### 4. 创建Soulverse世界配置

**新增文件**:
- `data/worlds/soulverse_sandbox/general.json`: Soulverse世界描述
- `data/locations/soulverse_locations.json`: 社交场景地点（咖啡馆、图书馆、公园等）
- `data/maps/soulverse_map.csv`: 地点之间的连接关系
- `experiment_presets/soulverse_sandbox.json`: Soulverse预设配置

### 5. 修改server.py初始化

**文件**: `server.py`

- 支持自动使用Soulverse预设（如果没有指定preset_path）
- Soulverse模式使用更大的rounds值（100轮）支持持续运行
- 强制使用free模式

## 关键区别

### 剧本模式 vs Soulverse模式

| 特性 | 剧本模式 | Soulverse模式 |
|------|---------|--------------|
| 世界设定 | 小说世界（如冰与火之歌） | 现代社交场景（咖啡馆、图书馆等） |
| 角色来源 | 预设的小说角色 | 用户创建的Agent |
| 事件类型 | 剧本事件（如血色婚礼） | 社交场景事件（如读书分享会） |
| Motivation | 基于剧本和事件 | 基于社交目标和兴趣 |
| 运行方式 | 固定轮次 | 持续运行（100+轮） |
| 目标 | 推进剧本剧情 | 建立社交关系 |

## 使用方式

### 1. 启动Soulverse沙盒

确保`config.json`中：
- `preset_path`为空或指向`soulverse_sandbox.json`
- 或者不设置`preset_path`，系统会自动使用Soulverse预设

### 2. 创建用户Agent

通过API或前端创建用户Agent：

```python
from ScrollWeaver import ScrollWeaver
from modules.soul_api_mock import get_soul_profile

# 创建ScrollWeaver实例（会自动使用Soulverse模式）
scrollweaver = ScrollWeaver(
    preset_path="./experiment_presets/soulverse_sandbox.json",
    world_llm_name="gpt-4o-mini",
    role_llm_name="gpt-4o-mini"
)

# 创建用户Agent
user_profile = get_soul_profile(user_id="user_001", 
                                interests=["电影", "音乐", "阅读"], 
                                mbti="ENFP")
agent = scrollweaver.server.add_user_agent(
    user_id="user_001",
    role_code="agent_user001",
    soul_profile=user_profile
)
```

### 3. 运行模拟

```python
# 设置生成器（Soulverse模式会自动使用更大的rounds）
scrollweaver.set_generator(
    rounds=100,  # Soulverse模式建议使用大值
    mode="free",
    scene_mode=1
)

# 开始模拟
for i in range(50):
    message = scrollweaver.generate_next_message()
    print(f"[{message['type']}] {message['username']}: {message['text']}")
```

## 测试

运行测试脚本：

```bash
python test_soulverse.py
```

测试包括：
1. 创建多个用户Agent
2. 运行社交模拟
3. 生成社交故事
4. 生成日报

## 注意事项

1. **Soulverse模式检测**：系统通过以下方式检测Soulverse模式：
   - `source == "soulverse"`
   - `performer_codes`为空列表（表示只有用户Agent）

2. **Motivation生成**：
   - UserAgent使用`SoulverseMode.generate_social_motivation()`
   - 普通Agent仍使用原有的motivation生成逻辑

3. **事件生成**：
   - Soulverse模式下，事件是基于Agent兴趣动态生成的社交场景
   - 不再使用预设的剧本事件

4. **持续运行**：
   - Soulverse模式默认使用100轮，支持长时间运行
   - 可以通过`should_continue_simulation()`判断是否继续

## 后续改进

1. 优化社交场景事件生成，使其更动态和有趣
2. 增强Agent之间的社交关系追踪
3. 添加更多社交场景和活动
4. 实现真实的Soul API集成（目前使用模拟数据）

