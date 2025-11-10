# Soulverse测试样例

## 测试样例1：基础社交互动

### 场景描述
创建两个兴趣相投的用户Agent，观察它们如何在咖啡馆相遇并建立联系。

### 测试代码

```python
from ScrollWeaver import ScrollWeaver
from modules.soul_api_mock import get_soul_profile

# 初始化Soulverse沙盒
scrollweaver = ScrollWeaver(
    preset_path="./experiment_presets/soulverse_sandbox.json",
    world_llm_name="gpt-4o-mini",
    role_llm_name="gpt-4o-mini",
    embedding_name="bge-small"
)

# 创建Agent 1：喜欢电影和阅读
user1_profile = get_soul_profile(
    user_id="user_001",
    interests=["电影", "阅读", "咖啡"],
    mbti="INFP"
)
agent1 = scrollweaver.server.add_user_agent(
    user_id="user_001",
    role_code="agent_user001",
    soul_profile=user1_profile,
    initial_location="cafe"  # 初始位置：咖啡馆
)

# 创建Agent 2：也喜欢电影和阅读
user2_profile = get_soul_profile(
    user_id="user_002",
    interests=["电影", "阅读", "音乐"],
    mbti="ENFP"
)
agent2 = scrollweaver.server.add_user_agent(
    user_id="user_002",
    role_code="agent_user002",
    soul_profile=user2_profile,
    initial_location="cafe"  # 初始位置：咖啡馆
)

# 运行模拟
scrollweaver.set_generator(rounds=10, mode="free", scene_mode=1)

# 观察互动
for i in range(30):
    try:
        message = scrollweaver.generate_next_message()
        print(f"[{message['type']}] {message['username']}: {message['text'][:100]}")
    except StopIteration:
        break
```

### 预期结果
- 两个Agent在咖啡馆相遇
- 它们发现彼此都喜欢电影和阅读
- 开始交流，分享观影和阅读心得
- 可能约定下次一起看电影或参加读书会

---

## 测试样例2：不同兴趣的Agent探索

### 场景描述
创建三个不同兴趣的Agent，观察它们如何在不同场景中探索和互动。

### 测试代码

```python
from ScrollWeaver import ScrollWeaver
from modules.soul_api_mock import get_soul_profile

scrollweaver = ScrollWeaver(
    preset_path="./experiment_presets/soulverse_sandbox.json",
    world_llm_name="gpt-4o-mini",
    role_llm_name="gpt-4o-mini"
)

# Agent 1：音乐爱好者
agent1 = scrollweaver.server.add_user_agent(
    user_id="user_001",
    role_code="agent_music",
    soul_profile=get_soul_profile(
        user_id="user_001",
        interests=["音乐", "摇滚", "现场演出"],
        mbti="ESFP"
    ),
    initial_location="music_hall"  # 音乐厅
)

# Agent 2：运动爱好者
agent2 = scrollweaver.server.add_user_agent(
    user_id="user_002",
    role_code="agent_sport",
    soul_profile=get_soul_profile(
        user_id="user_002",
        interests=["运动", "健身", "跑步"],
        mbti="ESTJ"
    ),
    initial_location="gym"  # 健身中心
)

# Agent 3：艺术爱好者
agent3 = scrollweaver.server.add_user_agent(
    user_id="user_003",
    role_code="agent_art",
    soul_profile=get_soul_profile(
        user_id="user_003",
        interests=["艺术", "绘画", "摄影"],
        mbti="ISFP"
    ),
    initial_location="art_gallery"  # 艺术画廊
)

# 运行模拟
scrollweaver.set_generator(rounds=15, mode="free", scene_mode=1)

# 观察每个Agent的行为
interaction_log = []
for i in range(50):
    try:
        message = scrollweaver.generate_next_message()
        interaction_log.append(message)
        print(f"[Round {i+1}] [{message['type']}] {message['username']}: {message['text'][:80]}")
    except StopIteration:
        break

# 分析结果
print("\n=== 分析 ===")
print(f"总互动数: {len([m for m in interaction_log if m['type'] == 'role'])}")
print(f"Agent移动次数: {len([m for m in interaction_log if '移动' in m['text']])}")
```

### 预期结果
- Agent 1在音乐厅活动，可能遇到其他音乐爱好者
- Agent 2在健身中心锻炼，可能找到运动伙伴
- Agent 3在艺术画廊欣赏作品，可能遇到艺术同好
- 不同Agent可能会移动到其他场景探索
- 如果兴趣有交集，可能会跨场景互动

---

## 测试样例3：社交故事生成

### 场景描述
运行一段模拟后，为特定Agent生成社交故事和日报。

### 测试代码

```python
from ScrollWeaver import ScrollWeaver
from modules.soul_api_mock import get_soul_profile
from modules.social_story_generator import generate_social_story
from modules.daily_report import generate_daily_report

# 创建并运行模拟（参考样例1或2）
scrollweaver = ScrollWeaver(
    preset_path="./experiment_presets/soulverse_sandbox.json",
    world_llm_name="gpt-4o-mini",
    role_llm_name="gpt-4o-mini"
)

# ... 创建Agent和运行模拟的代码 ...

# 生成Agent 1的社交故事
story = generate_social_story(
    history_manager=scrollweaver.server.history_manager,
    agent_code="agent_user001",
    language="zh",
    time_range_hours=24
)

print("=== 社交故事 ===")
print(f"总事件数: {len(story['key_events'])}")
print(f"互动次数: {story['stats']['total_interactions']}")
print(f"接触的朋友: {story['stats']['unique_contacts']}")
print(f"\n关键事件:")
for event in story['key_events'][:10]:
    print(f"  [{event['time']}] {event['type']}: {event['detail'][:60]}")

# 生成日报
report = generate_daily_report(
    history_manager=scrollweaver.server.history_manager,
    agent_code="agent_user001",
    language="zh"
)

print("\n=== 日报 ===")
print(f"日期: {report['report_date']}")
print(f"摘要: {report['summary']}")
print(f"接触的朋友数: {report['unique_contacts_count']}")
```

### 预期结果
- 生成包含Agent一天活动的社交故事
- 统计互动次数、接触的朋友等
- 生成格式化的日报，总结主要活动

---

## 运行测试

### 方式1：使用测试脚本

```bash
python test_soulverse.py
```

### 方式2：交互式测试

```python
# 在Python交互式环境中
from test_soulverse import *

# 运行测试1
scrollweaver = test_create_user_agents()
scrollweaver = test_social_simulation(scrollweaver, max_rounds=5)
test_social_story(scrollweaver, "agent_user001")
test_daily_report(scrollweaver, "agent_user001")
```

## 验证要点

1. **Soulverse模式检测**：
   - 确认`scrollweaver.server.is_soulverse_mode == True`
   - 确认事件是社交场景而非剧本事件

2. **Motivation生成**：
   - 确认UserAgent的motivation包含社交目标
   - 确认motivation不包含剧本相关内容

3. **Agent行为**：
   - 确认Agent会根据兴趣选择场景
   - 确认Agent会主动与其他Agent互动
   - 确认Agent会分享兴趣和想法

4. **社交故事**：
   - 确认故事聚焦于社交互动
   - 确认统计信息准确

