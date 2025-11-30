from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from starlette.middleware.sessions import SessionMiddleware
import uvicorn
import json
import asyncio
import os
import secrets
from pathlib import Path
from datetime import datetime
from typing import Optional
from sw_utils import is_image, load_json_file, get_models, json_parser
from ScrollWeaver import ScrollWeaver
from modules.social_story_generator import SocialStoryGenerator, generate_social_story
from modules.daily_report import DailyReportGenerator, generate_daily_report
from modules.soul_api_mock import get_soul_profile
from modules.profile_extractor import ProfileExtractor, extract_profile_from_text, extract_profile_from_qa
from modules.preset_agents import PresetAgents
from fastapi import UploadFile, File, Form

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境应限制为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加会话中间件
app.add_middleware(SessionMiddleware, secret_key=secrets.token_urlsafe(32))

default_icon_path = './frontend/assets/images/default-icon.jpg'
config = load_json_file('config.json')
for key in config:
    if "API_KEY" in key and config[key]:
        os.environ[key] = config[key]
# Also allow setting API base URLs (mirrors) from config.json, e.g. OPENAI_API_BASE
for key in ['OPENAI_API_BASE', 'GEMINI_API_BASE', 'OPENROUTER_BASE_URL']:
    if key in config and config[key]:
        os.environ[key] = config[key]



# 预设文件目录
PRESETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'experiment_presets')

# 用户数据目录
USERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'users')
os.makedirs(USERS_DIR, exist_ok=True)

# 简单的用户会话存储（内存中，实际生产环境应使用数据库或Redis）
user_sessions: dict[str, dict] = {}  # session_id -> user_data

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}  
        self.story_tasks: dict[str, asyncio.Task] = {}
        self.user_selected_roles: dict[str, str] = {}  # client_id -> role_code
        self.waiting_for_input: dict[str, bool] = {}  # client_id -> bool
        self.pending_user_inputs: dict[str, asyncio.Future] = {}  # client_id -> Future  
        self.possession_mode: dict[str, bool] = {}  # client_id -> bool (是否处于灵魂降临模式)
        self.user_agents: dict[str, str] = {}  # user_id -> role_code (用户ID到Agent代码的映射)  
        # 待显示的用户消息（不立即显示，等下一条agent消息前一并发送）
        self.pending_display_message: dict[str, dict] = {}  # client_id -> message dict
        if True:
            if "preset_path" in config and config["preset_path"]:
                if os.path.exists(config["preset_path"]):
                    preset_path = config["preset_path"]
                else:
                    raise ValueError(f"The preset path {config['preset_path']} does not exist.")
            elif "genre" in config and config["genre"]:
                genre = config["genre"]
                preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),f"./config/experiment_{genre}.json")
            else:
                # 如果没有预设路径，使用Soulverse默认配置
                preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                          'experiment_presets/soulverse_sandbox.json')
                if not os.path.exists(preset_path):
                    # 如果Soulverse预设不存在，创建一个
                    print(f"Warning: Soulverse preset not found, using default.")
            
            self.scrollweaver = ScrollWeaver(preset_path = preset_path,
                    world_llm_name = config["world_llm_name"],
                    role_llm_name = config["role_llm_name"],
                    embedding_name = config["embedding_model_name"])
            
            # 保存配置参数，延迟初始化生成器
            self.generator_config = {
                "rounds": config.get("rounds", 100) if self.scrollweaver.server.is_soulverse_mode else config.get("rounds", 10),
                "save_dir": config.get("save_dir", ""),
                "if_save": config.get("if_save", 0),
                "mode": "free",  # Soulverse模式强制使用free模式
                "scene_mode": 1,  # Soulverse模式使用scene_mode=1让orchestrator调度所有角色
            }
            self.generator_initialized = False
            print(f"Soulverse模式已启用，scene_mode=1（orchestrator统一调度所有角色）")
            
            # Soulverse模式不再自动创建预设Agent，用户需要自己创建
            # if self.scrollweaver.server.is_soulverse_mode:
            #     self._init_default_agents()
        else:
            from ScrollWeaver_test import ScrollWeaver_test
            self.scrollweaver = ScrollWeaver_test()
    
    def _init_default_agents(self):
        """初始化预设的示例Agent"""
        try:
            # 预设Agent配置
            default_agents = [
                {
                    "user_id": "demo_user_001",
                    "role_code": "demo_agent_001",
                    "interests": ["电影", "音乐", "阅读", "旅行", "摄影"],
                    "mbti": "INFP",
                    "social_goals": ["寻找志同道合的朋友", "讨论电影和文学"]
                },
                {
                    "user_id": "demo_user_002",
                    "role_code": "demo_agent_002",
                    "interests": ["游戏", "动漫", "科技", "编程", "AI"],
                    "mbti": "INTP",
                    "social_goals": ["寻找游戏搭子", "讨论科技话题"]
                },
                {
                    "user_id": "demo_user_003",
                    "role_code": "demo_agent_003",
                    "interests": ["运动", "健身", "旅行", "美食", "咖啡"],
                    "mbti": "ESFP",
                    "social_goals": ["寻找运动伙伴", "寻找旅行伙伴"]
                }
            ]
            
            for agent_config in default_agents:
                try:
                    soul_profile = get_soul_profile(
                        user_id=agent_config["user_id"],
                        interests=agent_config["interests"],
                        mbti=agent_config["mbti"]
                    )
                    # 覆盖社交目标
                    soul_profile["social_goals"] = agent_config["social_goals"]
                    
                    user_agent = self.scrollweaver.server.add_user_agent(
                        user_id=agent_config["user_id"],
                        role_code=agent_config["role_code"],
                        soul_profile=soul_profile
                    )
                    self.user_agents[agent_config["user_id"]] = agent_config["role_code"]
                    print(f"预设Agent已创建: {user_agent.nickname} ({agent_config['role_code']})")
                except Exception as e:
                    print(f"创建预设Agent失败 {agent_config['role_code']}: {e}")
        except Exception as e:
            print(f"初始化预设Agent时出错: {e}")
            import traceback
            traceback.print_exc()
          
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        self.stop_story(client_id)
        # 清理用户选择的状态
        if client_id in self.user_selected_roles:
            del self.user_selected_roles[client_id]
        if client_id in self.waiting_for_input:
            del self.waiting_for_input[client_id]
        if client_id in self.pending_user_inputs:
            # 如果Future还在等待，取消它
            if not self.pending_user_inputs[client_id].done():
                self.pending_user_inputs[client_id].cancel()
            del self.pending_user_inputs[client_id]
            
    def stop_story(self, client_id: str):
        if client_id in self.story_tasks:
            self.story_tasks[client_id].cancel()
            del self.story_tasks[client_id]

    async def start_story(self, client_id: str):
        if client_id in self.story_tasks:
            # 如果已经有任务在运行，先停止它
            self.stop_story(client_id)
        
        # 创建新的故事任务
        self.story_tasks[client_id] = asyncio.create_task(
            self.generate_story(client_id)
        )

    async def generate_story(self, client_id: str):
        """持续生成故事的协程"""
        try:
            # 检查是否有角色，如果没有角色就不启动生成
            if len(self.scrollweaver.server.role_codes) == 0:
                await self.active_connections[client_id].send_json({
                    'type': 'error',
                    'data': {'message': '没有角色，无法生成故事。请先创建Agent。'}
                })
                return
            
            while True:
                if client_id in self.active_connections:
                    # 获取用户选择的角色（如果用户选择了角色，用于后续检查）
                    user_role_code = self.user_selected_roles.get(client_id)
                    
                    # 如果用户选择了角色，设置标志供生成器使用
                    # 生成器会根据这个标志判断：当系统决定用户角色行动时，跳过plan()调用，等待用户输入
                    # 注意：这个标志在Goal Setting阶段也会被使用，但Goal Setting阶段用户角色的消息不会yield
                    if user_role_code:
                        self.scrollweaver.server._user_role_code = user_role_code
                        # 同时传递 possession_mode 状态
                        self.scrollweaver.server._possession_mode = self.possession_mode.get(client_id, True)
                    else:
                        # 如果用户没有选择角色，清除标志
                        if hasattr(self.scrollweaver.server, '_user_role_code'):
                            delattr(self.scrollweaver.server, '_user_role_code')
                        if hasattr(self.scrollweaver.server, '_possession_mode'):
                            delattr(self.scrollweaver.server, '_possession_mode')
                    
                    # 从生成器获取下一条消息
                    # 生成器会正常调用decide_next_actor决定下一个角色
                    # 如果决定的是用户角色，生成器会返回占位消息（跳过plan()调用）
                    # 如果决定的是其他角色，生成器会正常调用plan()生成计划
                    # 注意：在Goal Setting阶段，用户角色的消息不会yield，所以不会触发用户输入
                    message,status = await self.get_next_message()
                    
                    # 检查生成器是否已结束或没有角色
                    if message is None:
                        # 检查是否因为没有角色而返回None
                        if len(self.scrollweaver.server.role_codes) == 0:
                            await self.active_connections[client_id].send_json({
                                'type': 'error',
                                'data': {'message': '没有角色，无法生成故事。请先创建Agent。'}
                            })
                        else:
                            await self.active_connections[client_id].send_json({
                                'type': 'story_ended',
                                'data': {'message': '故事已结束'}
                            })
                        break
                    
                    # 检查是否轮到用户选择的角色（观察者模式或灵魂降临模式）
                    is_possession_mode = self.possession_mode.get(client_id, True)  # 默认True（用户控制模式）
                    
                    # 检查是否是占位消息（占位消息不应该发送到前端）
                    is_placeholder = message.get('is_placeholder', False) or message.get('text', '').strip().startswith('__USER_INPUT_PLACEHOLDER__')
                    
                    if user_role_code and message.get('type') == 'role':
                        # 检查当前消息的角色代码是否匹配用户选择的角色
                        # 需要通过角色名称找到角色代码
                        current_role_code = self._get_role_code_by_name(message.get('username', ''))
                        
                        print(f"[DEBUG] 检查消息: username={message.get('username')}, current_role_code={current_role_code}, user_role_code={user_role_code}, is_placeholder={is_placeholder}, is_possession_mode={is_possession_mode}")
                        
                        if current_role_code and current_role_code == user_role_code:
                            # 如果是占位消息
                            if is_placeholder:
                                # 检查是否处于用户控制模式
                                if not is_possession_mode:
                                    # AI自由行动模式：跳过占位消息，不等待用户输入
                                    # 占位消息已经在生成器中被跳过，这里不需要额外处理
                                    continue
                                
                                # 用户控制模式：等待用户输入
                                original_uuid = message.get('uuid')
                                
                                # 暂停生成，等待用户输入（不发送占位消息到前端）
                                self.waiting_for_input[client_id] = True
                                await self.active_connections[client_id].send_json({
                                    'type': 'waiting_for_user_input',
                                    'data': {
                                        'role_name': message.get('username'),
                                        'message': '请为角色输入内容'
                                    }
                                })
                                
                                # 等待用户输入
                                if client_id not in self.pending_user_inputs:
                                    self.pending_user_inputs[client_id] = asyncio.Future()
                                
                                try:
                                    # 获取用户输入
                                    user_input_result = await asyncio.wait_for(
                                        self.pending_user_inputs[client_id], 
                                        timeout=None
                                    )
                                    
                                    # 解析输入结果（可能是字符串或元组）
                                    if isinstance(user_input_result, tuple):
                                        user_text, is_echoed = user_input_result
                                    else:
                                        user_text = user_input_result
                                        is_echoed = False
                                    
                                    # 清除Future
                                    del self.pending_user_inputs[client_id]
                                    
                                    # 用户输入已收到，用用户输入替换消息内容
                                    if not user_text.strip():
                                        # 空输入，继续等待
                                        await self.active_connections[client_id].send_json({
                                            'type': 'error',
                                            'data': {'message': '输入不能为空，请重新输入'}
                                        })
                                        # 重新创建Future继续等待
                                        self.pending_user_inputs[client_id] = asyncio.Future()
                                        continue
                                    
                                    # 长度补强：用于LLM上下文，增强可见度；前端仍显示原文
                                    def _augment_for_context(text: str, min_len: int = 40) -> str:
                                        t = text.strip()
                                        if len(t) >= min_len:
                                            return t
                                        # 简单语义补全：复述+展开意图
                                        return f"{t}\n（解释：以上是用户的核心意图描述。请围绕其意图、对象与期望回应进行具体、直接的回应与推进。）"
                                    
                                    augmented_text = _augment_for_context(user_text)

                                    # 修改占位记录（写入增强文本以提升LLM权重）
                                    if original_uuid:
                                        try:
                                            # 修改占位记录
                                            modified_group = self.scrollweaver.server.history_manager.modify_record(original_uuid, augmented_text)
                                            
                                            # 同时更新 act_type 为 user_input（从 user_input_placeholder 改为 user_input）
                                            for record in self.scrollweaver.server.history_manager.detailed_history:
                                                if record.get("record_id") == original_uuid:
                                                    record["act_type"] = "user_input"
                                                    print(f"[DEBUG] 已更新记录 {original_uuid} 的 act_type 为 user_input")
                                                    break

                                            # 立即回显用户消息到前端（显示原文）- 除非已经回显过
                                            if not is_echoed:
                                                # 从user_role_code获取正确的用户名
                                                user_agent = self.scrollweaver.server.performers.get(user_role_code)
                                                username = user_agent.nickname if user_agent and hasattr(user_agent, 'nickname') else (user_agent.role_name if user_agent and hasattr(user_agent, 'role_name') else message.get('username', '用户'))
                                                
                                                echo_msg = {
                                                    'type': 'role',
                                                    'username': username,
                                                    'text': user_text,
                                                    'is_user': True,
                                                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                                    'uuid': original_uuid
                                                }
                                                await self.active_connections[client_id].send_json({
                                                    'type': 'message',
                                                    'data': echo_msg
                                                })
                                                print(f"[DEBUG] 已立即发送用户消息到前端: {username}: {user_text[:50]}...")
                                            else:
                                                print(f"[DEBUG] 跳过回显（消息已在select_auto_option中发送）: {user_text[:50]}...")

                                            # 清除future和等待状态（继续推进生成，下一条将是其他Agent响应）
                                            if client_id in self.pending_user_inputs:
                                                del self.pending_user_inputs[client_id]
                                            self.waiting_for_input[client_id] = False
                                            
                                            print(f"[DEBUG] 用户输入已处理: {user_text[:50]}... 等待下一个agent响应")
                                            
                                            # 继续循环，获取下一条消息（下一个agent的响应）
                                            continue
                                        except Exception as e:
                                            print(f"Error modifying placeholder record {original_uuid}: {e}")
                                            # 如果修改失败，创建新记录（立即显示）
                                            await self.handle_user_role_input(client_id, user_role_code, user_text, delay_display=False, skip_broadcast=is_echoed)
                                            continue
                                    else:
                                        # 如果没有uuid，创建新记录（立即显示）
                                        await self.handle_user_role_input(client_id, user_role_code, user_text, delay_display=False, skip_broadcast=is_echoed)
                                        continue
                                    
                                except asyncio.CancelledError:
                                    break
                                except Exception as e:
                                    print(f"Error waiting for user input: {e}")
                                    import traceback
                                    traceback.print_exc()
                                    # 清理状态并继续
                                    if client_id in self.pending_user_inputs:
                                        del self.pending_user_inputs[client_id]
                                    self.waiting_for_input[client_id] = False
                            else:
                                # 不是占位消息，但用户角色被选中，这不应该发生
                                # 正常发送消息（这种情况理论上不应该出现）
                                await self.active_connections[client_id].send_json({
                                    'type': 'message',
                                    'data': message
                                })
                                if status is not None:
                                    await self.active_connections[client_id].send_json({
                                        'type': 'status_update',
                                        'data': status
                                    })
                                await asyncio.sleep(0.2)
                                continue
                    
                    # 如果是占位消息但不在用户角色处理中，跳过（不应该发生）
                    if is_placeholder:
                        # 占位消息不应该发送到前端，直接跳过
                        continue
                    
                    # 正常发送消息（非占位消息，非用户角色）

                    await self.active_connections[client_id].send_json({
                        'type': 'message',
                        'data': message
                    })
                    if status is not None:
                        await self.active_connections[client_id].send_json({
                            'type': 'status_update',
                            'data': status
                        })
                    # 添加延迟，控制消息发送频率
                    await asyncio.sleep(0.2)  # 可以调整这个值
                else:
                    break
        except asyncio.CancelledError:
            # 任务被取消时的处理
            print(f"Story generation cancelled for client {client_id}")
        except Exception as e:
            print(f"Error in generate_story: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # 清理状态
            if client_id in self.waiting_for_input:
                del self.waiting_for_input[client_id]
            if client_id in self.pending_user_inputs:
                del self.pending_user_inputs[client_id]

    async def get_initial_data(self):
        """获取初始化数据"""
        return {
            'characters': self.scrollweaver.get_characters_info(),
            'map': self.scrollweaver.get_map_info(),
            'settings': self.scrollweaver.get_settings_info(),
            'status': self.scrollweaver.get_current_status(),
            'history_messages':self.scrollweaver.get_history_messages(save_dir = config["save_dir"]),
        }
    
    def _ensure_generator_initialized(self):
        """确保生成器已初始化（延迟初始化）"""
        if not self.generator_initialized:
            # 检查是否有角色，如果没有角色就不初始化生成器
            if len(self.scrollweaver.server.role_codes) == 0:
                return False
            
            # 初始化生成器
            self.scrollweaver.set_generator(
                rounds=self.generator_config["rounds"],
                save_dir=self.generator_config["save_dir"],
                if_save=self.generator_config["if_save"],
                mode=self.generator_config["mode"],
                scene_mode=self.generator_config["scene_mode"]
            )
            self.generator_initialized = True
            return True
        return True
    
    async def get_next_message(self):
        """从ScrollWeaver获取下一条消息"""
        # 确保生成器已初始化
        if not self._ensure_generator_initialized():
            # 没有角色，返回None表示无法生成消息
            return None, None
        
        # 循环直到获取到有效消息
        max_attempts = 10  # 最多尝试10次
        attempts = 0
        
        while attempts < max_attempts:
            try:
                message = self.scrollweaver.generate_next_message()
            except StopIteration:
                # 生成器已结束
                return None, None
            except AttributeError as e:
                # 生成器未初始化
                if "generator" in str(e):
                    return None, None
                raise
            
            if message is None:
                attempts += 1
                continue
            
            # 检查是否是占位消息（占位消息需要特殊处理，不应该被过滤）
            text = message.get("text", "").strip()
            if text == "__USER_INPUT_PLACEHOLDER__":
                # 占位消息：返回特殊标记，让 generate_story 处理
                message["is_placeholder"] = True
                status = self.scrollweaver.get_current_status()
                return message, status
            
            # 过滤空消息
            if not text:
                attempts += 1
                continue
            
            # 检查图标路径
            if not os.path.exists(message.get("icon", "")) or not is_image(message.get("icon", "")):
                message["icon"] = default_icon_path
            
            status = self.scrollweaver.get_current_status()
            return message, status
        
        # 如果尝试多次仍未获取到有效消息，返回None
        return None, None
    
    def _get_role_code_by_name(self, role_name: str) -> str:
        """通过角色名称找到角色代码（支持role_name和nickname匹配）"""
        if not role_name:
            return None
        try:
            # 遍历所有角色，查找匹配的名称或昵称（不区分大小写）
            role_name_lower = role_name.lower().strip()
            for role_code in self.scrollweaver.server.role_codes:
                performer = self.scrollweaver.server.performers[role_code]
                if (performer.role_name and performer.role_name.lower().strip() == role_name_lower) or \
                   (performer.nickname and performer.nickname.lower().strip() == role_name_lower):
                    return role_code
        except Exception as e:
            print(f"Error finding role code for {role_name}: {e}")
            import traceback
            traceback.print_exc()
        return None
    
    async def generate_auto_action(self, client_id: str, role_code: str) -> str:
        """使用AI自动生成角色的行动（单个选项，保持向后兼容）"""
        options = await self.generate_auto_action_options(client_id, role_code, num_options=1)
        return options[0]['text'] if options and len(options) > 0 else None
    
    async def generate_auto_action_options(self, client_id: str, role_code: str, num_options: int = 3) -> list:
        """使用AI自动生成角色的多个行动选项"""
        try:
            performer = self.scrollweaver.server.performers[role_code]
            current_status = self.scrollweaver.server.current_status
            group = current_status.get('group', [])
            
            # 将group中的名称/代码转换为角色代码列表
            group_codes = []
            for item in group:
                # 如果已经是角色代码，直接使用
                if item in self.scrollweaver.server.role_codes:
                    group_codes.append(item)
                else:
                    # 否则尝试通过名称查找角色代码
                    code = self._get_role_code_by_name(item)
                    if code:
                        group_codes.append(code)
            
            # 确保当前角色在group中
            if role_code not in group_codes:
                group_codes.append(role_code)
            
            # 获取同组其他角色信息
            other_roles_info = self.scrollweaver.server._get_group_members_info_dict(group_codes)
            
            # 定义不同风格的选项配置
            style_configs = [
                {
                    'style': 'aggressive',
                    'name': '激进',
                    'description': '采取更直接、大胆的行动',
                    'temperature': 1.2,
                    'style_hint': '采取更直接、大胆、果断的行动方式。不要过于谨慎，可以承担一定风险。'
                },
                {
                    'style': 'balanced',
                    'name': '平衡',
                    'description': '采取平衡、理性的行动',
                    'temperature': 0.8,
                    'style_hint': '采取平衡、理性的行动方式。综合考虑各种因素，做出合理的决策。'
                },
                {
                    'style': 'conservative',
                    'name': '保守',
                    'description': '采取谨慎、稳妥的行动',
                    'temperature': 0.5,
                    'style_hint': '采取谨慎、稳妥、保守的行动方式。优先考虑安全，避免不必要的风险。'
                }
            ]
            
            # 生成多个选项
            options = []
            for i, config in enumerate(style_configs[:num_options]):
                max_retries = 3  # 每个选项最多重试3次
                retry_count = 0
                success = False
                
                while retry_count < max_retries and not success:
                    try:
                        # 调用Performer的plan方法生成行动，传入风格提示和温度
                        plan = performer.plan_with_style(
                            other_roles_info=other_roles_info,
                            available_locations=self.scrollweaver.server.orchestrator.locations,
                            world_description=self.scrollweaver.server.orchestrator.description,
                            intervention=self.scrollweaver.server.event,
                            style_hint=config['style_hint'],
                            temperature=config['temperature']
                        )
                        
                        detail = plan.get("detail", "")
                        # 检查detail是否为空或只包含空白字符
                        if detail and detail.strip():
                            options.append({
                                'index': i + 1,
                                'style': config['style'],
                                'name': config['name'],
                                'description': config['description'],
                                'text': detail
                            })
                            success = True
                        else:
                            retry_count += 1
                            if retry_count < max_retries:
                                print(f"Warning: Option {i+1} ({config['style']}) returned empty detail, retrying ({retry_count}/{max_retries-1})...")
                            else:
                                print(f"Error: Option {i+1} ({config['style']}) failed after {max_retries} attempts: detail is empty")
                    except Exception as e:
                        retry_count += 1
                        if retry_count < max_retries:
                            print(f"Error generating option {i+1} ({config['style']}), retrying ({retry_count}/{max_retries-1}): {e}")
                        else:
                            print(f"Error generating option {i+1} ({config['style']}) after {max_retries} attempts: {e}")
                            import traceback
                            traceback.print_exc()
            
            return options if options else None
        except Exception as e:
            print(f"Error in generate_auto_action_options: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def handle_user_role_input(self, client_id: str, role_code: str, user_text: str, delay_display: bool = False, skip_broadcast: bool = False):
        """处理用户输入作为角色消息（当消息没有uuid时使用）
        如果 delay_display=True，则不立即发送消息到前端，交给generate_story在下条Agent消息前发送
        如果 skip_broadcast=True，则不向前端发送消息（用于避免重复回显）
        """
        try:
            # 生成record_id
            import uuid
            record_id = str(uuid.uuid4())
            
            # 记录用户输入到历史
            self.scrollweaver.server.record(
                role_code=role_code,
                detail=user_text,
                actor=role_code,
                group=self.scrollweaver.server.current_status.get('group', [role_code]),
                actor_type='role',
                act_type="user_input",
                record_id=record_id
            )
            
            # 构造消息格式
            performer = self.scrollweaver.server.performers[role_code]
            # 优先使用nickname，如果没有则使用role_name
            username = performer.nickname if hasattr(performer, 'nickname') and performer.nickname else (performer.role_name if hasattr(performer, 'role_name') else role_code)
            message = {
                'username': username,
                'type': 'role',
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'text': user_text,
                'icon': performer.icon_path if hasattr(performer, 'icon_path') and os.path.exists(performer.icon_path) and is_image(performer.icon_path) else default_icon_path,
                'uuid': record_id,
                'scene': self.scrollweaver.server.cur_round,
                'is_user': True  # 标记为用户输入
            }
            
            # 若设置延迟显示，则缓存；否则立即发送
            if delay_display:
                self.pending_display_message[client_id] = message
            elif not skip_broadcast:
                await self.active_connections[client_id].send_json({
                    'type': 'message',
                    'data': message
                })
                # 发送状态更新
                status = self.scrollweaver.get_current_status()
                await self.active_connections[client_id].send_json({
                    'type': 'status_update',
                    'data': status
                })
            
        except Exception as e:
            print(f"Error handling user role input: {e}")
            import traceback
            traceback.print_exc()

manager = ConnectionManager()



@app.get("/data/{full_path:path}")
async def get_file(full_path: str):
    # 可以设置多个基础路径
    base_paths = [
        Path("/data/")
    ]
    
    for base_path in base_paths:
        file_path = base_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        else:
            return FileResponse(default_icon_path)
    
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/list-presets")
async def list_presets():
    try:
        # 获取所有json文件
        presets = [f for f in os.listdir(PRESETS_DIR) if f.endswith('.json')]
        return {"presets": presets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/load-preset")
async def load_preset(request: Request):
    try:
        data = await request.json()
        preset_name = data.get('preset')
        
        if not preset_name:
            raise HTTPException(status_code=400, detail="No preset specified")
            
        preset_path = os.path.join(PRESETS_DIR, preset_name)
        print(f"Loading preset from: {preset_path}")
        
        if not os.path.exists(preset_path):
            raise HTTPException(status_code=404, detail=f"Preset not found: {preset_path}")
            
        try:
            # 更新ScrollWeaver实例的预设
            manager.scrollweaver = ScrollWeaver(
                preset_path=preset_path,
                world_llm_name=config["world_llm_name"],
                role_llm_name=config["role_llm_name"],
                embedding_name=config["embedding_model_name"]
            )
            manager.scrollweaver.set_generator(
                rounds=config["rounds"],
                save_dir=config["save_dir"],
                if_save=config["if_save"],
                mode=config["mode"],
                scene_mode=config["scene_mode"]
            )
            
            # 获取初始数据
            initial_data = await manager.get_initial_data()
            
            return {
                "success": True,
                "data": initial_data
            }
        except Exception as e:
            print(f"Error initializing ScrollWeaver: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error initializing ScrollWeaver: {str(e)}")
            
    except Exception as e:
        print(f"Error in load_preset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        initial_data = await manager.get_initial_data()
        await websocket.send_json({
            'type': 'initial_data',
            'data': initial_data
        })
        
        print(f"WebSocket 已连接: client_id={client_id}, 等待用户身份确认...")
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message['type'] == 'identify_user':
                # 处理用户身份确认（由前端发送，包含 user_id）
                user_id = message.get('user_id')
                print(f"收到用户身份确认: user_id={user_id}")
                
                if user_id and user_id in manager.user_agents:
                    # 自动选择用户的 agent
                    user_role_code = manager.user_agents[user_id]
                    manager.user_selected_roles[client_id] = user_role_code
                    manager.possession_mode[client_id] = True  # 默认开启用户控制模式
                    print(f"✓ 已自动选择用户Agent: {user_role_code} (user_id={user_id})")
                    
                    await websocket.send_json({
                        'type': 'user_agent_selected',
                        'data': {
                            'role_code': user_role_code,
                            'possession_mode': True,
                            'message': '已自动选择您的数字孪生'
                        }
                    })
                else:
                    print(f"✗ 未找到用户Agent (user_id={user_id})")
            
            elif message['type'] == 'user_message':
                # 处理用户消息
                user_text_incoming = message.get('text', '').strip()

                # 优先处理“正在等待用户输入”的情况（即使近期记录仍显示为goal setting也应接收）
                if client_id in manager.waiting_for_input and manager.waiting_for_input[client_id]:
                    # 正常等待用户输入，处理用户输入
                    if client_id in manager.pending_user_inputs:
                        if not manager.pending_user_inputs[client_id].done():
                            if user_text_incoming:
                                # 获取用户角色信息用于回显
                                user_role_code = manager.user_selected_roles.get(client_id)
                                if user_role_code:
                                    user_agent = manager.scrollweaver.server.performers.get(user_role_code)
                                    username = user_agent.nickname if user_agent and hasattr(user_agent, 'nickname') else (user_agent.role_name if user_agent and hasattr(user_agent, 'role_name') else '你')
                                else:
                                    username = '你'
                                
                                # 立即回显消息给前端，确保用户能马上看到自己的回复
                                await websocket.send_json({
                                    'type': 'message',
                                    'data': {
                                        'username': username,
                                        'text': user_text_incoming,
                                        'timestamp': datetime.now().strftime("%H:%M"),
                                        'is_user': True
                                    }
                                })
                                
                                # 设置结果为元组，标记为已回显
                                manager.pending_user_inputs[client_id].set_result((user_text_incoming, True))
                            else:
                                # 空输入，提示用户
                                await websocket.send_json({
                                    'type': 'error',
                                    'data': {'message': '输入不能为空，请重新输入'}
                                })
                else:
                    # 非等待态下再检查是否仍处于设置阶段
                    recent_records = manager.scrollweaver.server.history_manager.detailed_history[-5:] if len(manager.scrollweaver.server.history_manager.detailed_history) >= 5 else manager.scrollweaver.server.history_manager.detailed_history
                    is_goal_setting_phase = any(
                        r.get('act_type') == 'goal setting' 
                        for r in recent_records[-3:]  # 检查最近3条记录
                    )
                    if is_goal_setting_phase:
                        # 处于设置阶段：不缓存，不等待，直接告知设置进行中（用户目标将自动生成）
                        await websocket.send_json({
                            'type': 'info',
                            'data': {'message': '正在设置阶段，系统将自动生成角色目标，请稍候'}
                        })
                    else:
                        # 不在等待输入状态：提示等待轮到你再发送
                        await websocket.send_json({
                            'type': 'error',
                            'data': {'message': '请先选择角色并等待轮到您行动时再发送消息'}
                        })
            
            elif message['type'] == 'select_role':
                # 处理角色选择
                role_name = message.get('role_name')
                if role_name:
                    role_code = manager._get_role_code_by_name(role_name)
                    if role_code:
                        manager.user_selected_roles[client_id] = role_code
                        # 检查是否是用户Agent（灵魂降临模式）
                        is_user_agent = role_code in manager.user_agents.values()
                        manager.possession_mode[client_id] = is_user_agent
                        
                        await websocket.send_json({
                            'type': 'role_selected',
                            'data': {
                                'role_name': role_name,
                                'role_code': role_code,
                                'message': f'已选择角色: {role_name}',
                                'possession_mode': is_user_agent
                            }
                        })
                    else:
                        await websocket.send_json({
                            'type': 'error',
                            'data': {
                                'message': f'未找到角色: {role_name}'
                            }
                        })
            
            elif message['type'] == 'set_possession_mode':
                # 设置灵魂降临模式（用户控制 vs AI 自由行动）
                enabled = message.get('enabled', True)
                manager.possession_mode[client_id] = enabled
                mode_text = "用户控制" if enabled else "AI自由行动"
                print(f"Client {client_id} 设置possession_mode为: {mode_text}")
                await websocket.send_json({
                    'type': 'possession_mode_updated',
                    'data': {
                        'enabled': enabled,
                        'message': f'已切换到{mode_text}模式'
                            }
                        })
            
            elif message['type'] == 'clear_role_selection':
                # 清除角色选择
                if client_id in manager.user_selected_roles:
                    del manager.user_selected_roles[client_id]
                if client_id in manager.possession_mode:
                    del manager.possession_mode[client_id]
                await websocket.send_json({
                    'type': 'role_selection_cleared',
                    'data': {
                        'message': '已取消角色选择'
                    }
                })
            
            elif message['type'] == 'toggle_possession':
                # 切换灵魂降临模式（已废弃，模式由角色选择自动决定）
                # 保留此消息类型以兼容旧代码，但不执行实际操作
                await websocket.send_json({
                    'type': 'error',
                    'data': {
                        'message': '模式切换已废弃，请通过选择/取消选择角色来切换模式'
                            }
                        })
            
            elif message['type'] == 'request_characters':
                # 请求角色列表
                characters = manager.scrollweaver.get_characters_info()
                await websocket.send_json({
                    'type': 'characters_list',
                    'data': {
                        'characters': characters
                    }
                })
                
            elif message['type'] == 'control':
                # 处理控制命令
                if message['action'] == 'start':
                    await manager.start_story(client_id)
                elif message['action'] == 'pause':
                    manager.stop_story(client_id)
                elif message['action'] == 'stop':
                    manager.stop_story(client_id)
                    # 可以在这里添加额外的停止逻辑
                    
            elif message['type'] == 'edit_message':
                # 处理消息编辑
                edit_data = message['data']
                # 假设 ScrollWeaver 类有一个处理编辑的方法
                manager.scrollweaver.handle_message_edit(
                    record_id=edit_data['uuid'],
                    new_text=edit_data['text']
                )
                
            elif message['type'] == 'auto_complete':
                # 处理AI自动完成请求
                if client_id in manager.waiting_for_input and manager.waiting_for_input[client_id]:
                    user_role_code = manager.user_selected_roles.get(client_id)
                    if user_role_code and client_id in manager.pending_user_inputs:
                        if not manager.pending_user_inputs[client_id].done():
                            try:
                                # 调用AI生成多个行动选项
                                options = await manager.generate_auto_action_options(client_id, user_role_code, num_options=3)
                                if options and len(options) > 0:
                                    # 发送多个选项给前端
                                    await websocket.send_json({
                                        'type': 'auto_complete_options',
                                        'data': {
                                            'options': options,
                                            'message': 'AI已生成多个行动选项，请选择'
                                        }
                                    })
                                else:
                                    await websocket.send_json({
                                        'type': 'error',
                                        'data': {'message': 'AI生成行动失败，请重试'}
                                    })
                            except Exception as e:
                                print(f"Error generating auto action options: {e}")
                                import traceback
                                traceback.print_exc()
                                await websocket.send_json({
                                    'type': 'error',
                                    'data': {'message': f'生成行动时出错: {str(e)}'}
                                })
                    else:
                        await websocket.send_json({
                            'type': 'error',
                            'data': {'message': '未选择角色或不在等待输入状态'}
                        })
                else:
                    await websocket.send_json({
                        'type': 'error',
                        'data': {'message': '当前不在等待输入状态'}
                    })
            
            elif message['type'] == 'select_auto_option':
                # 处理用户选择的AI选项
                if client_id in manager.waiting_for_input and manager.waiting_for_input[client_id]:
                    user_role_code = manager.user_selected_roles.get(client_id)
                    if user_role_code and client_id in manager.pending_user_inputs:
                        if not manager.pending_user_inputs[client_id].done():
                            selected_text = message.get('selected_text', '')
                            if selected_text:
                                # 将选中的选项作为用户输入，并标记为已回显
                                manager.pending_user_inputs[client_id].set_result((selected_text, True))
                                
                                # 立即回显消息给前端，确保用户能马上看到自己的回复
                                await websocket.send_json({
                                    'type': 'message',
                                    'data': {
                                        'username': '你',  # 或者使用实际的角色名
                                        'text': selected_text,
                                        'timestamp': datetime.now().strftime("%H:%M"),
                                        'is_user': True
                                    }
                                })
                                
                                await websocket.send_json({
                                    'type': 'auto_complete_success',
                                    'data': {'message': '已选择AI生成的行动'}
                                })
                            else:
                                await websocket.send_json({
                                    'type': 'error',
                                    'data': {'message': '无效的选项'}
                                })
                    else:
                        await websocket.send_json({
                            'type': 'error',
                            'data': {'message': '未选择角色或不在等待输入状态'}
                        })
                else:
                    await websocket.send_json({
                        'type': 'error',
                        'data': {'message': '当前不在等待输入状态'}
                    })
            
            elif message['type'] == 'generate_story' or message['type'] == 'generate_social_report':
                # 生成社交报告（Soulverse模式）或故事（传统模式）
                try:
                    agent_code = message.get('agent_code')  # 可选，指定Agent
                    format_type = message.get('format', 'json')  # 默认使用json格式，简化报告
                    
                    # 简化报告：只生成文本格式，不包含复杂的图表数据
                    report_text = manager.scrollweaver.generate_social_report(agent_code=agent_code, format='text')
                    
                    # 构建简化的报告数据
                    report_data = {
                        'report_text': report_text,
                        'agent_name': agent_code or '所有Agent',
                        'agent_code': agent_code,
                        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    
                    await websocket.send_json({
                        'type': 'social_report_exported',
                        'data': {
                            'report': report_text,
                            'report_data': report_data,  # 简化的结构化数据
                            'timestamp': report_data['timestamp'],
                            'agent_code': agent_code,
                            'format': 'json'
                        }
                    })
                except Exception as e:
                    print(f"Error generating social report: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        'type': 'error',
                        'data': {
                            'message': f'生成社交报告时出错: {str(e)}'
                        }
                    })
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(client_id)

@app.post("/api/save-config")
async def save_config(request: Request):
    # Disabled: front-end configuration is no longer supported for security reasons.
    # All configuration should be edited in the server-side config.json file and the service restarted.
    raise HTTPException(status_code=403, detail="前端配置已禁用。请在服务器上编辑 config.json 并重启服务以更改配置。")

@app.post("/api/create-user-agent")
async def create_user_agent(request: Request):
    """创建用户Agent"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        role_code = data.get('role_code')
        soul_profile_data = data.get('soul_profile')  # 可选，如果提供则使用
        
        if not user_id or not role_code:
            raise HTTPException(status_code=400, detail="user_id and role_code are required")
        
        # 获取Soul画像（如果未提供）
        if soul_profile_data is None:
            soul_profile_data = get_soul_profile(user_id=user_id)
        
        # 创建用户Agent
        user_agent = manager.scrollweaver.server.add_user_agent(
            user_id=user_id,
            role_code=role_code,
            soul_profile=soul_profile_data
        )
        
        # 记录用户Agent映射
        manager.user_agents[user_id] = role_code
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        # 获取最新的角色列表（包含新创建的Agent）
        characters_info = manager.scrollweaver.get_characters_info()
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": user_agent.role_name,
                "nickname": user_agent.nickname,
                "location": user_agent.location_name,
                "profile": user_agent.role_profile[:200] + "..." if len(user_agent.role_profile) > 200 else user_agent.role_profile
            },
            "characters": characters_info  # 返回最新的角色列表
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating user agent: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-agent-from-text")
async def create_agent_from_text(request: Request):
    """从文本（聊天记录、自述等）创建用户Agent"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        text = data.get('text')
        role_code = data.get('role_code')
        
        if not user_id or not text:
            raise HTTPException(status_code=400, detail="user_id and text are required")
        
        if not role_code:
            # 自动生成role_code
            role_code = f"user_agent_{user_id}_{int(datetime.now().timestamp())}"
        
        # 从文本提取用户画像
        extractor = ProfileExtractor(
            llm_name=config.get("role_llm_name", "gpt-4o-mini"),
            language=config.get("language", "zh")
        )
        soul_profile = extractor.extract_profile_from_text(text)
        soul_profile["user_id"] = user_id
        
        # 创建用户Agent
        user_agent = manager.scrollweaver.server.add_user_agent(
            user_id=user_id,
            role_code=role_code,
            soul_profile=soul_profile
        )
        
        # 记录用户Agent映射
        manager.user_agents[user_id] = role_code
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        # 获取最新的角色列表（包含新创建的Agent）
        characters_info = manager.scrollweaver.get_characters_info()
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": user_agent.role_name,
                "nickname": user_agent.nickname,
                "location": user_agent.location_name,
                "profile": user_agent.role_profile[:200] + "..." if len(user_agent.role_profile) > 200 else user_agent.role_profile,
                "extracted_profile": soul_profile
            },
            "characters": characters_info  # 返回最新的角色列表
        }
    except Exception as e:
        print(f"Error creating agent from text: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-agent-from-file")
async def create_agent_from_file(
    file: UploadFile = File(...),
    user_id: str = Form(None),
    role_code: str = Form(None)
):
    """从上传的文件（聊天记录、自述等）创建用户Agent"""
    try:
        if not user_id:
            # 从文件名生成user_id
            user_id = f"user_{int(datetime.now().timestamp())}"
        
        if not role_code:
            role_code = f"user_agent_{user_id}_{int(datetime.now().timestamp())}"
        
        # 读取文件内容
        content = await file.read()
        text = content.decode('utf-8')
        
        # 从文本提取用户画像
        extractor = ProfileExtractor(
            llm_name=config.get("role_llm_name", "gpt-4o-mini"),
            language=config.get("language", "zh")
        )
        soul_profile = extractor.extract_profile_from_text(text)
        soul_profile["user_id"] = user_id
        
        # 创建用户Agent
        user_agent = manager.scrollweaver.server.add_user_agent(
            user_id=user_id,
            role_code=role_code,
            soul_profile=soul_profile
        )
        
        # 记录用户Agent映射
        manager.user_agents[user_id] = role_code
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        # 获取最新的角色列表（包含新创建的Agent）
        characters_info = manager.scrollweaver.get_characters_info()
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": user_agent.role_name,
                "nickname": user_agent.nickname,
                "location": user_agent.location_name,
                "profile": user_agent.role_profile[:200] + "..." if len(user_agent.role_profile) > 200 else user_agent.role_profile,
                "extracted_profile": soul_profile
            },
            "characters": characters_info  # 返回最新的角色列表
        }
    except Exception as e:
        print(f"Error creating agent from file: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-agent-from-qa")
async def create_agent_from_qa(request: Request):
    """通过问答方式创建用户Agent"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        answers = data.get('answers')  # 问答字典
        role_code = data.get('role_code')
        
        if not user_id or not answers:
            raise HTTPException(status_code=400, detail="user_id and answers are required")
        
        if not role_code:
            role_code = f"user_agent_{user_id}_{int(datetime.now().timestamp())}"
        
        # 从问答结果提取用户画像
        extractor = ProfileExtractor(
            llm_name=config.get("role_llm_name", "gpt-4o-mini"),
            language=config.get("language", "zh")
        )
        soul_profile = extractor.extract_profile_from_qa(answers)
        soul_profile["user_id"] = user_id
        
        # 创建用户Agent
        user_agent = manager.scrollweaver.server.add_user_agent(
            user_id=user_id,
            role_code=role_code,
            soul_profile=soul_profile
        )
        
        # 记录用户Agent映射
        manager.user_agents[user_id] = role_code
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        # 获取最新的角色列表（包含新创建的Agent）
        characters_info = manager.scrollweaver.get_characters_info()
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": user_agent.role_name,
                "nickname": user_agent.nickname,
                "location": user_agent.location_name,
                "profile": user_agent.role_profile[:200] + "..." if len(user_agent.role_profile) > 200 else user_agent.role_profile,
                "extracted_profile": soul_profile
            },
            "characters": characters_info  # 返回最新的角色列表
        }
    except Exception as e:
        print(f"Error creating agent from QA: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-social-story/{agent_code}")
async def get_social_story(agent_code: str, hours: int = 24):
    """获取Agent的社交故事（观察者模式）"""
    try:
        history_manager = manager.scrollweaver.server.history_manager
        language = manager.scrollweaver.server.language
        
        story_info = generate_social_story(
            history_manager=history_manager,
            agent_code=agent_code,
            language=language,
            time_range_hours=hours
        )
        
        return {
            "success": True,
            "data": story_info
        }
    except Exception as e:
        print(f"Error getting social story: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/list-preset-agents")
async def list_preset_agents():
    """获取所有预设Agent模板列表"""
    try:
        templates = PresetAgents.get_preset_templates()
        return {
            "success": True,
            "templates": templates
        }
    except Exception as e:
        print(f"Error listing preset agents: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/add-preset-npc")
async def add_preset_npc(request: Request):
    """从预设模板添加NPC Agent（用于与用户Agent社交）"""
    try:
        data = await request.json()
        preset_id = data.get('preset_id')
        custom_name = data.get('custom_name')
        role_code = data.get('role_code')
        
        if not preset_id:
            raise HTTPException(status_code=400, detail="preset_id is required")
        
        # 获取预设模板
        preset_template = PresetAgents.get_preset_by_id(preset_id)
        if not preset_template:
            raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")
        
        # 使用自定义名称或预设名称
        role_name = custom_name if custom_name and custom_name.strip() else preset_template["name"]
        
        if not role_code:
            # 添加微秒和随机数确保唯一性
            import random
            timestamp_ms = int(datetime.now().timestamp() * 1000)
            random_suffix = random.randint(100, 999)
            role_code = f"npc_{preset_id}_{timestamp_ms}_{random_suffix}"
        
        print(f"\n[添加NPC] preset_id={preset_id}, role_name={role_name}, role_code={role_code}")
        print(f"[添加前] 沙盒中的agents数量: {len(manager.scrollweaver.server.role_codes)}")
        print(f"[添加前] agents列表: {list(manager.scrollweaver.server.role_codes)}")
        
        # 创建NPC Agent（使用新的三层人格模型）
        npc_agent = manager.scrollweaver.server.add_npc_agent(
            role_code=role_code,
            role_name=role_name,
            preset_id=preset_id  # 使用preset_id而不是preset_config
        )
        
        print(f"[添加后] 沙盒中的agents数量: {len(manager.scrollweaver.server.role_codes)}")
        print(f"[添加后] agents列表: {list(manager.scrollweaver.server.role_codes)}\n")
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        # 确保用户Agent仍在沙盒中
        user_id = get_user_id_from_session(request)
        if user_id:
            user_role_code = manager.user_agents.get(user_id)
            if user_role_code and user_role_code not in manager.scrollweaver.server.role_codes:
                print(f"[Add NPC] Warning: User agent {user_role_code} missing from sandbox, restoring...")
                # 尝试恢复用户Agent
                user_file = os.path.join(USERS_DIR, f"{user_id}.json")
                if os.path.exists(user_file):
                    user_data = load_json_file(user_file)
                    digital_twin = user_data.get('digital_twin')
                    if digital_twin:
                        manager.scrollweaver.server.add_user_agent(
                            user_id=user_id,
                            role_code=digital_twin['role_code']
                        )
                        print(f"[Add NPC] Restored user agent {digital_twin['role_code']}")
        
        # 获取语言风格（用于前端显示）
        speaking_style = PresetAgents._get_speaking_style_for_preset(preset_id, preset_template.get("mbti"))
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": npc_agent.role_name,
                "nickname": npc_agent.nickname,
                "location": npc_agent.location_name,
                "profile": preset_template.get("description", npc_agent.role_profile[:100]), # 使用简短描述
                "personality": {
                    "mbti": preset_template.get("mbti"),
                    "big_five": preset_template.get("big_five"),
                    "values": preset_template.get("values"),
                    "defense_mechanism": preset_template.get("defense_mechanism")
                },
                "speaking_style": speaking_style,
                "generated_profile": {
                     "core_traits": {
                         "values": preset_template.get("values"),
                         "defense_mechanism": preset_template.get("defense_mechanism")
                     }
                },
                "preset_info": {
                    "preset_id": preset_id,
                    "preset_name": preset_template["name"]
                },
                "is_npc": True
            }
        }
    except Exception as e:
        print(f"Error adding preset NPC: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/toggle-agent-sandbox")
async def toggle_agent_sandbox(request: Request):
    """动态移除/添加Agent到沙盒"""
    try:
        data = await request.json()
        role_code = data.get('role_code')
        enabled = data.get('enabled')
        preset_id = data.get('preset_id') # Required for re-enabling
        
        if not role_code:
            raise HTTPException(status_code=400, detail="role_code is required")
            
        server = manager.scrollweaver.server
        
        if not enabled:
            # 移除 Agent
            if role_code in server.role_codes:
                server.role_codes.remove(role_code)
            if role_code in server.performers:
                del server.performers[role_code]
            # 清除该agent的对话历史
            if hasattr(server, 'history_manager') and server.history_manager:
                # 清除与该agent相关的历史记录
                pass  # history_manager可能没有直接的删除方法，但移除后不会再出现在对话中
            print(f"[Toggle] Removed agent {role_code} from sandbox")
        else:
            # 添加 Agent
            # 如果已经在沙盒中，忽略
            if role_code in server.role_codes:
                return {"success": True, "message": "Agent already in sandbox"}
                
            # 如果不在，需要重新添加
            if preset_id:
                preset_template = PresetAgents.get_preset_by_id(preset_id)
                if preset_template:
                    server.add_npc_agent(
                        role_code=role_code,
                        role_name=preset_template["name"],
                        preset_id=preset_id
                    )
                    print(f"[Toggle] Re-added agent {role_code} to sandbox")
                else:
                    raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")
            else:
                 raise HTTPException(status_code=400, detail="preset_id is required to enable agent")
                 
        # 关键修复：重置generator标志并停止活跃任务
        print(f"[Toggle] Agent list modified, resetting generator")
        manager.generator_initialized = False
        
        # 确保用户Agent仍在沙盒中
        user_id = get_user_id_from_session(request)
        if user_id:
            user_role_code = manager.user_agents.get(user_id)
            if user_role_code and user_role_code not in server.role_codes:
                print(f"[Toggle] Warning: User agent {user_role_code} missing from sandbox, restoring...")
                # 尝试恢复用户Agent
                user_file = os.path.join(USERS_DIR, f"{user_id}.json")
                if os.path.exists(user_file):
                    user_data = load_json_file(user_file)
                    digital_twin = user_data.get('digital_twin')
                    if digital_twin:
                        manager.scrollweaver.server.add_user_agent(
                            user_id=user_id,
                            role_code=digital_twin['role_code']
                        )
                        print(f"[Toggle] Restored user agent {digital_twin['role_code']}")

        # 停止所有活跃的story任务（让用户重新开始对话）
        active_clients = list(manager.story_tasks.keys())
        for client_id in active_clients:
            manager.stop_story(client_id)
            print(f"[Toggle] Stopped story task for client {client_id}")
        
        # 通知所有连接的客户端需要重新开始
        for client_id in active_clients:
            if client_id in manager.active_connections:
                try:
                    await manager.active_connections[client_id].send_json({
                        'type': 'agents_updated',
                        'data': {'message': 'Agent列表已更新，请重新开始对话'}
                    })
                except Exception as e:
                    print(f"[Toggle] Error notifying client {client_id}: {e}")
        
        return {"success": True, "role_code": role_code, "enabled": enabled, "stopped_tasks": len(active_clients)}
    except Exception as e:
        print(f"Error toggling agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reset-sandbox")
async def reset_sandbox(request: Request):
    """重置沙盒到默认状态（用于从聊天返回匹配页）"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
            
        print(f"\n[Reset Sandbox] 重置沙盒for user {user_id}")
        
        # 重新初始化 ScrollWeaver 为默认沙盒配置
        preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                  'experiment_presets/soulverse_sandbox.json')
        
        manager.scrollweaver = ScrollWeaver(
            preset_path=preset_path,
            world_llm_name=config["world_llm_name"],
            role_llm_name=config["role_llm_name"],
            embedding_name=config["embedding_model_name"]
        )
        
        # 恢复用户Agent
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            user_data = load_json_file(user_file)
            digital_twin = user_data.get('digital_twin')
            if digital_twin:
                manager.scrollweaver.server.add_user_agent(
                    user_id=user_id,
                    role_code=digital_twin['role_code']
                )
                print(f"[Reset Sandbox] Restored user agent {digital_twin['role_code']}")
        
        # 重置生成器标志（agents会由前端重新添加，generator会在下次对话时初始化）
        manager.generator_initialized = False
            
        print(f"[Reset Sandbox] ScrollWeaver 已重新初始化")
        
        return {"success": True, "message": "Sandbox reset successfully"}
        
    except Exception as e:
        print(f"Error resetting sandbox: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear-chat-history")
async def clear_chat_history(request: Request):
    """清除当前对话历史（真正的重置）"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
            
        print(f"\n[Clear History] Clearing chat history for user {user_id}")
        
        # 1. 清除历史记录
        if hasattr(manager.scrollweaver, 'history_manager'):
            manager.scrollweaver.history_manager.detailed_history = []
            manager.scrollweaver.history_manager.history = []
            print("[Clear History] History manager cleared")
            
        # 2. 重置轮次和事件
        manager.scrollweaver.cur_round = 0
        manager.scrollweaver.event_history = []
        
        # 3. 重置生成器标志，强制重新初始化
        manager.generator_initialized = False
        
        # 确保用户Agent仍在沙盒中
        user_role_code = manager.user_agents.get(user_id)
        if user_role_code and user_role_code not in manager.scrollweaver.server.role_codes:
            print(f"[Clear History] Warning: User agent {user_role_code} missing from sandbox, restoring...")
            # 尝试恢复用户Agent
            user_file = os.path.join(USERS_DIR, f"{user_id}.json")
            if os.path.exists(user_file):
                user_data = load_json_file(user_file)
                digital_twin = user_data.get('digital_twin')
                if digital_twin:
                    manager.scrollweaver.server.add_user_agent(
                        user_id=user_id,
                        role_code=digital_twin['role_code']
                    )
                    print(f"[Clear History] Restored user agent {digital_twin['role_code']}")
        
        # 4. 停止并重启活跃任务，刷新上下文
        active_clients = list(manager.story_tasks.keys())
        for client_id in active_clients:
            manager.stop_story(client_id)
            print(f"[Clear History] Stopped story task for client {client_id}")
            
        # 5. 自动重启任务（如果连接还在）
        for client_id in active_clients:
            if client_id in manager.active_connections:
                try:
                    await manager.start_story(client_id)
                    print(f"[Clear History] Restarted story for client {client_id}")
                    
                    # 通知前端已清除
                    await manager.active_connections[client_id].send_json({
                        'type': 'info',
                        'data': {'message': '对话历史已完全重置'}
                    })
                except Exception as e:
                    print(f"[Clear History] Error restarting story for client {client_id}: {e}")
        
        return {"success": True, "message": "Chat history cleared successfully"}
        
    except Exception as e:
        print(f"Error clearing chat history: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-1on1-chat")
async def start_1on1_chat(request: Request):
    """开启1对1聊天模式"""
    try:
        data = await request.json()
        target_role_code = data.get('target_role_code')
        preset_id = data.get('preset_id')
        
        if not target_role_code or not preset_id:
            raise HTTPException(status_code=400, detail="target_role_code and preset_id are required")
            
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        print(f"\n{'='*60}")
        print(f"[1on1] Starting 1-on-1 chat mode")
        print(f"[1on1] User ID: {user_id}")
        print(f"[1on1] Target role: {target_role_code}")
        print(f"[1on1] Preset ID: {preset_id}")
            
        # 1. 直接使用 manager.user_agents 获取用户的 role_code
        # 这个映射在restore_user_agent时已经建立
        user_role_code = manager.user_agents.get(user_id)
        
        if not user_role_code:
            print(f"[1on1] Error: user {user_id} not found in user_agents mapping")
            print(f"[1on1] Current user_agents: {manager.user_agents}")
            raise HTTPException(status_code=400, detail="请先恢复用户Agent到沙盒")
        
        print(f"[1on1] User role code: {user_role_code}")
        
        # 记录旧沙盒状态
        old_agent_count = len(manager.scrollweaver.server.role_codes) if manager.scrollweaver else 0
        old_agents = list(manager.scrollweaver.server.role_codes) if manager.scrollweaver else []
        print(f"[1on1] Old sandbox had {old_agent_count} agents: {old_agents}")

        # 2. 重新初始化 ScrollWeaver 为 1on1 模式
        # 使用完整的 preset 配置文件
        preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                  'experiment_presets/soulverse_1on1.json')
        
        print(f"[1on1] Reinitializing ScrollWeaver with preset: {preset_path}")
        
        # 重新初始化 ScrollWeaver - 这会创建一个全新的空沙盒
        manager.scrollweaver = ScrollWeaver(preset_path=preset_path,
                world_llm_name=config["world_llm_name"],
                role_llm_name=config["role_llm_name"],
                embedding_name=config["embedding_model_name"])
        
        # 验证沙盒已清空
        initial_agent_count = len(manager.scrollweaver.server.role_codes)
        print(f"[1on1] After reinitialization: {initial_agent_count} agents in sandbox")
        if initial_agent_count > 0:
            print(f"[1on1] WARNING: Sandbox not empty! Contains: {list(manager.scrollweaver.server.role_codes)}")
                
        # 3. 添加用户 Agent
        # 需要从数据库重新加载用户Agent数据
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            user_data = load_json_file(user_file)
            digital_twin = user_data.get('digital_twin')
            if digital_twin:
                print(f"[1on1] Adding user agent: {digital_twin['role_code']}")
                
                # 提取soul_profile from digital_twin
                soul_profile = None
                if 'generated_profile' in digital_twin and digital_twin['generated_profile']:
                    soul_profile = digital_twin['generated_profile']
                    print(f"[1on1] Using generated_profile with MBTI: {soul_profile.get('core_traits', {}).get('mbti', 'NOT FOUND')}")
                elif 'personality' in digital_twin and digital_twin['personality']:
                    # 如果没有generated_profile，使用personality字段
                    soul_profile = {'core_traits': digital_twin['personality']}
                    print(f"[1on1] Using personality with MBTI: {soul_profile.get('core_traits', {}).get('mbti', 'NOT FOUND')}")
                
                # 使用正确的 add_user_agent 参数签名，包括soul_profile
                manager.scrollweaver.server.add_user_agent(
                    user_id=user_id,
                    role_code=digital_twin['role_code'],
                    soul_profile=soul_profile
                )
                print(f"[1on1] User agent added successfully")
        
        # 4. 添加目标 NPC Agent
        preset_template = PresetAgents.get_preset_by_id(preset_id)
        if preset_template:
            print(f"[1on1] Adding NPC agent: {target_role_code} ({preset_template['name']})")
            manager.scrollweaver.server.add_npc_agent(
                role_code=target_role_code,
                role_name=preset_template["name"],
                preset_id=preset_id
            )
            print(f"[1on1] NPC agent added successfully")
        else:
            raise HTTPException(status_code=404, detail=f"Preset {preset_id} not found")
        
        # 验证沙盒中只有2个agent
        agent_count = len(manager.scrollweaver.server.role_codes)
        agents_list = list(manager.scrollweaver.server.role_codes)
        print(f"[1on1] Final sandbox state: {agent_count} agents")
        print(f"[1on1] Agents: {agents_list}")
        
        if agent_count != 2:
            print(f"[1on1] ERROR: Expected exactly 2 agents but found {agent_count}!")
            print(f"[1on1] This indicates a problem with sandbox initialization")
            # Don't raise an error, but log it prominently
        
        # 关键：重置generator标志
        manager.generator_initialized = False
        
        # 停止所有活跃的story任务
        active_clients = list(manager.story_tasks.keys())
        for client_id in active_clients:
            manager.stop_story(client_id)
            print(f"[1on1] Stopped story task for client {client_id}")
        
        # 自动重启对话（因为1on1是主动操作，应该立即生效）
        for client_id in active_clients:
            if client_id in manager.active_connections:
                try:
                    # 自动开始新的1on1对话
                    await manager.start_story(client_id)
                    print(f"[1on1] Auto-restarted story for client {client_id}")
                    
                    # 通知客户端已进入1on1模式
                    await manager.active_connections[client_id].send_json({
                        'type': 'info',
                        'data': {'message': f'已进入1对1私密对话模式，当前对话人数：{agent_count}'}
                    })
                except Exception as e:
                    print(f"[1on1] Error restarting story for client {client_id}: {e}")
        
        print(f"[1on1] 1-on-1 chat mode activated successfully")
        print(f"{'='*60}\n")
        
        return {"success": True, "message": "Entered 1-on-1 chat mode", "agent_count": agent_count, "restarted_tasks": len(active_clients)}
        
    except Exception as e:
        print(f"Error starting 1-on-1 chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-daily-report/{agent_code}")
async def get_daily_report(agent_code: str, date: str = None):
    """获取Agent的社交日报"""
    try:
        history_manager = manager.scrollweaver.server.history_manager
        language = manager.scrollweaver.server.language
        
        # 解析日期
        report_date = None
        if date:
            try:
                report_date = datetime.strptime(date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        report = generate_daily_report(
            history_manager=history_manager,
            agent_code=agent_code,
            date=report_date,
            language=language
        )
        
        # 生成文本格式
        generator = DailyReportGenerator(history_manager, language)
        report_text = generator.generate_report_text(report)
        
        return {
            "success": True,
            "data": {
                **report,
                "report_text": report_text
            }
        }
    except Exception as e:
        print(f"Error getting daily report: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 用户会话管理 API ====================

def get_user_id_from_session(request: Request) -> Optional[str]:
    """从会话中获取用户ID"""
    session_id = request.session.get('user_id')
    return session_id

@app.post("/api/login")
async def login(request: Request):
    """用户登录（简单验证，支持访客模式）"""
    try:
        data = await request.json()
        user_id = data.get('user_id', '').strip()
        password = data.get('password', '').strip()
        is_guest = data.get('is_guest', False)
        
        if is_guest:
            # 访客模式：生成临时用户ID
            user_id = f"guest_{secrets.token_urlsafe(8)}"
            # 创建访客用户数据
            user_data = {
                "user_id": user_id,
                "username": "访客",
                "is_guest": True,
                "created_at": datetime.now().isoformat()
            }
        else:
            # 正常登录：验证用户（简单实现，实际应验证密码）
            if not user_id:
                raise HTTPException(status_code=400, detail="用户ID不能为空")
            
            # 检查用户是否存在
            user_file = os.path.join(USERS_DIR, f"{user_id}.json")
            if os.path.exists(user_file):
                user_data = load_json_file(user_file)
            else:
                # 新用户：创建用户数据
                user_data = {
                    "user_id": user_id,
                    "username": user_id,
                    "is_guest": False,
                    "created_at": datetime.now().isoformat()
                }
                # 保存用户数据
                with open(user_file, 'w', encoding='utf-8') as f:
                    json.dump(user_data, f, ensure_ascii=False, indent=2)
        
        # 设置会话
        request.session['user_id'] = user_id
        request.session['username'] = user_data.get('username', user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "username": user_data.get('username', user_id),
            "is_guest": user_data.get('is_guest', False)
        }
    except Exception as e:
        print(f"Error in login: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/register")
async def register(request: Request):
    """用户注册（可选）"""
    try:
        data = await request.json()
        user_id = data.get('user_id', '').strip()
        password = data.get('password', '').strip()
        username = data.get('username', user_id).strip()
        
        if not user_id:
            raise HTTPException(status_code=400, detail="用户ID不能为空")
        
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            raise HTTPException(status_code=400, detail="用户已存在")
        
        # 创建新用户
        user_data = {
            "user_id": user_id,
            "username": username,
            "password": password,  # 简单存储，实际应加密
            "is_guest": False,
            "created_at": datetime.now().isoformat()
        }
        
        # 保存用户数据
        with open(user_file, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, ensure_ascii=False, indent=2)
        
        # 设置会话
        request.session['user_id'] = user_id
        request.session['username'] = username
        
        return {
            "success": True,
            "user_id": user_id,
            "username": username
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in register: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/me")
async def get_current_user(request: Request):
    """获取当前用户信息"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            user_data = load_json_file(user_file)
            # 移除敏感信息
            user_data.pop('password', None)
            return {
                "success": True,
                "user": user_data
            }
        else:
            # 访客用户或新用户
            return {
                "success": True,
                "user": {
                    "user_id": user_id,
                    "username": request.session.get('username', user_id),
                    "is_guest": True
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_current_user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/logout")
async def logout(request: Request):
    """用户退出登录"""
    try:
        # 清除会话
        request.session.clear()
        
        return {
            "success": True,
            "message": "已退出登录"
        }
    except Exception as e:
        print(f"Error in logout: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-digital-twin-profile")
async def generate_digital_twin_profile(request: Request):
    """生成数字孪生完整画像"""
    try:
        data = await request.json()
        
        # 提取输入数据
        mbti_type = data.get('mbti_type')
        mbti_answers = data.get('mbti_answers', [])
        big_five_answers = data.get('big_five_answers', [])
        
        # 新增 Phase 2 数据
        defense_answers = data.get('defense_answers', [])
        attachment_answers = data.get('attachment_answers', [])
        values_order = data.get('values_order', [])
        
        chat_history = data.get('chat_history', '')
        user_name = data.get('user_name', '')
        relationship = data.get('relationship', '')
        
        # 1. 确定MBTI类型
        final_mbti = mbti_type
        if not final_mbti and mbti_answers:
            # 计算MBTI
            counts = {'E': 0, 'I': 0, 'S': 0, 'N': 0, 'T': 0, 'F': 0, 'J': 0, 'P': 0}
            for answer in mbti_answers:
                if answer:
                    counts[answer] += 1
            
            final_mbti = (
                ('E' if counts['E'] >= counts['I'] else 'I') +
                ('S' if counts['S'] >= counts['N'] else 'N') +
                ('T' if counts['T'] >= counts['F'] else 'T') +
                ('J' if counts['J'] >= counts['P'] else 'P')
            )
        elif not final_mbti:
            # 如果没有MBTI类型且无法计算（新版问卷数据在后端未配置题目元数据），暂定为未知
            pass
            
        # 2. 计算Big Five分数
        big_five_scores = None
        if big_five_answers:
            scores = {
                'openness': [], 
                'conscientiousness': [], 
                'extraversion': [], 
                'agreeableness': [], 
                'neuroticism': []
            }
            
            for answer in big_five_answers:
                if answer and 'dimension' in answer and 'value' in answer:
                    dim = answer['dimension']
                    try:
                        val = float(answer['value'])
                        
                        # 处理反向计分 (1-5量表)
                        if 'direction' in answer and int(answer.get('direction', 1)) == -1:
                            val = 6 - val
                            
                        if dim in scores:
                            scores[dim].append(val)
                    except (ValueError, TypeError):
                        continue
            
            big_five_scores = {}
            for dim, values in scores.items():
                if values:
                    # 计算平均分 (1-5)
                    avg = sum(values) / len(values)
                    # 归一化到 0-1 (1->0, 5->1)
                    normalized = (avg - 1) / 4
                    big_five_scores[dim] = round(max(0.0, min(1.0, normalized)), 2)
                else:
                    big_five_scores[dim] = 0.5

        # 3. 计算防御机制分数
        defense_scores = {}
        if defense_answers:
            d_scores = {}
            for answer in defense_answers:
                if answer and 'dimension' in answer and 'value' in answer:
                    dim = answer['dimension']
                    val = float(answer['value'])
                    if dim not in d_scores: d_scores[dim] = []
                    d_scores[dim].append(val)
            
            for dim, values in d_scores.items():
                defense_scores[dim] = round(sum(values) / len(values), 2)

        # 4. 计算依恋风格分数
        attachment_scores = {}
        if attachment_answers:
            a_scores = {}
            for answer in attachment_answers:
                if answer and 'dimension' in answer and 'value' in answer:
                    dim = answer['dimension']
                    val = float(answer['value'])
                    if dim not in a_scores: a_scores[dim] = []
                    a_scores[dim].append(val)
            
            for dim, values in a_scores.items():
                attachment_scores[dim] = round(sum(values) / len(values), 2)
        
        # 5. 构建Prompt
        prompt = "你是一位专业的数字孪生人格分析师。请基于以下所有信息，生成用户的完整人格画像。\n\n"
        
        # MBTI信息
        prompt += "## 一、MBTI类型信息\n"
        if mbti_type:
            prompt += f"**用户自己选择的MBTI类型**: {mbti_type}\n**重要**: 这是用户自己确定的MBTI类型，你必须使用这个类型，不可更改。\n"
        elif final_mbti:
            prompt += f"**根据问卷计算的MBTI类型**: {final_mbti}\n"
        else:
            prompt += "**MBTI类型**: 未知\n"
            
        # 核心层信息
        prompt += "\n## 二、核心层信息 (Big Five)\n"
        if big_five_scores:
            prompt += f"**Big Five评分**（基于问卷计算）: {json.dumps(big_five_scores, ensure_ascii=False, indent=2)}\n"
        else:
            prompt += "用户未完成核心层问卷。\n"

        # 深层机制信息
        prompt += "\n## 三、深层机制信息\n"
        if defense_scores:
            prompt += f"**防御机制倾向** (1-5分): {json.dumps(defense_scores, ensure_ascii=False, indent=2)}\n"
            # 找出得分最高的防御机制
            top_defense = max(defense_scores.items(), key=lambda x: x[1])[0] if defense_scores else "Unknown"
            prompt += f"**主要防御机制**: {top_defense}\n"
        else:
            prompt += "用户未完成防御机制问卷。\n"

        if attachment_scores:
            prompt += f"**依恋风格倾向** (1-5分): {json.dumps(attachment_scores, ensure_ascii=False, indent=2)}\n"
            # 找出得分最高的依恋风格
            top_attachment = max(attachment_scores.items(), key=lambda x: x[1])[0] if attachment_scores else "Unknown"
            prompt += f"**主要依恋风格**: {top_attachment}\n"
        else:
            prompt += "用户未完成依恋风格问卷。\n"

        if values_order:
            prompt += f"**价值观排序** (从最重要到最不重要): {', '.join(values_order)}\n"
        else:
            prompt += "用户未完成价值观排序。\n"

        if not big_five_scores and not defense_scores and chat_history:
             prompt += "**注意**: 由于缺乏问卷数据，请重点基于后续提供的聊天记录，推断用户的Big Five人格特征、价值观和防御机制。\n"
                
        # 聊天记录信息
        prompt += "\n## 四、用户聊天记录\n"
        if chat_history:
            prompt += f"**用户名称**: {user_name}\n"
            if relationship:
                prompt += f"**聊天对象关系**: {relationship}\n"
            
            # 截取最近的聊天记录以避免超出token限制
            # 简单截取最后10000个字符
            truncated_history = chat_history[-10000:] if len(chat_history) > 10000 else chat_history
            prompt += f"\n**聊天记录内容**:\n{truncated_history}\n\n"
            
            prompt += "**重要说明**:\n"
            prompt += f"- 请识别出用户自己发送的消息（发送者为\"{user_name}\"的消息）\n"
            prompt += "- 基于用户自己的消息，分析语言风格特征（表象层）\n"
            prompt += "- 基于完整聊天记录，分析用户的性格特征\n"
        else:
            prompt += "用户未上传聊天记录。\n"
            
        # 生成要求
        prompt += """
\n## 五、分析与生成要求

请按以下步骤进行思考 (Chain of Thought):
1. **核心特质识别**: 结合MBTI、Big Five和价值观排序，构建用户的人格核心。
2. **深层动力分析**: 
   - 结合依恋风格和防御机制，分析用户在压力或亲密关系中的行为模式。
   - 确保生成的 defense_mechanism 与问卷结果一致（如有）。
   - 确保生成的 values 与用户的价值观排序一致（如有）。
3. **一致性检验**: 如果有聊天记录，对比问卷结果和聊天风格是否一致。
4. **语言风格设计**: 确保生成的语言风格（speaking_style）与人格特质高度匹配。

请生成一个完整的JSON对象，包含以下所有字段：

{
  "core_traits": {
    "mbti": "MBTI类型",
    "big_five": {"openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5, "agreeableness": 0.5, "neuroticism": 0.5},
    "values": ["价值观1", "价值观2", "价值观3"],
    "defense_mechanism": "防御机制名称 (英文)",
    "attachment_style": "依恋风格 (Secure/Anxious/Avoidant)"
  },
  "speaking_style": {
    "sentence_length": "short/medium/long/mixed",
    "vocabulary_level": "academic/casual/network/mixed",
    "punctuation_habit": "minimal/standard/excessive/mixed",
    "emoji_usage": {
      "frequency": "none/low/medium/high",
      "preferred": ["表情1", "表情2"],
      "avoided": []
    },
    "catchphrases": ["口头禅1", "口头禅2"],
    "tone_markers": ["语气词1", "语气词2"]
  }
}

**重要规则**:
1. **MBTI类型**: 必须使用确定的MBTI类型。
2. **核心层数据**: 
   - Big Five评分必须基于计算结果（如有）。
   - values数组生成3-5个中文词汇，必须优先参考用户的价值观排序。
   - defense_mechanism: 如果有问卷结果，必须使用得分最高的机制；否则从以下选择：Rationalization, Projection, Denial, Repression, Sublimation, Displacement, ReactionFormation, Humor, Intellectualization。
   - attachment_style: 如果有问卷结果，必须使用得分最高的风格；否则根据分析推断。
3. **表象层数据**: 
   - 如果有聊天记录，必须深入分析生成speaking_style对象。
   - 如果没有聊天记录，请根据MBTI和Big Five推断最可能的语言风格。
4. 只返回JSON对象，不要包含markdown代码块标记。
"""

        # 4. 调用LLM
        # 使用配置中的默认模型
        model_name = config.get("role_llm_name", "gpt-3.5-turbo")
        llm = get_models(model_name)
        response = llm.chat(prompt)
        
        # 5. 解析响应
        try:
            # 尝试清理markdown标记
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            profile_data = json_parser(cleaned_response)
            
            return {
                "success": True,
                "profile": profile_data
            }
        except Exception as e:
            print(f"Error parsing LLM response: {e}")
            print(f"Raw response: {response}")
            return {
                "success": False,
                "error": "生成失败，无法解析AI响应",
                "raw_response": response
            }
            
    except Exception as e:
        print(f"Error in generate_digital_twin_profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/digital-twin")
async def save_digital_twin(request: Request):
    """保存/更新用户的数字孪生 agent"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        data = await request.json()
        agent_info = data.get('agent_info')
        
        if not agent_info:
            raise HTTPException(status_code=400, detail="agent_info 不能为空")
        
        # 加载或创建用户数据
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            user_data = load_json_file(user_file)
        else:
            user_data = {
                "user_id": user_id,
                "username": request.session.get('username', user_id),
                "created_at": datetime.now().isoformat()
            }
        
        # 保存数字孪生（覆盖旧的）
        user_data['digital_twin'] = agent_info
        user_data['digital_twin_updated_at'] = datetime.now().isoformat()
        
        # 保存到文件
        with open(user_file, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "message": "数字孪生已保存",
            "agent_info": agent_info
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in save_digital_twin: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/digital-twin")
async def get_digital_twin(request: Request):
    """获取用户的数字孪生 agent"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if os.path.exists(user_file):
            user_data = load_json_file(user_file)
            digital_twin = user_data.get('digital_twin')
            if digital_twin:
                return {
                    "success": True,
                    "agent_info": digital_twin
                }
        
        return {
            "success": True,
            "agent_info": None,
            "message": "用户尚未创建数字孪生"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_digital_twin: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/restore-user-agent")
async def restore_user_agent(request: Request):
    """从已保存的数字孪生恢复用户 agent 到沙盒"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        data = await request.json()
        role_code = data.get('role_code')
        
        if not role_code:
            raise HTTPException(status_code=400, detail="role_code is required")
        
        # 检查 agent 是否已存在
        if role_code in manager.scrollweaver.server.role_codes:
            print(f"用户Agent {role_code} 已存在于沙盒中，跳过恢复")
            # 获取现有 agent 信息
            agent = manager.scrollweaver.server.performers.get(role_code)
            return {
                "success": True,
                "already_exists": True,
                "agent_info": {
                    "role_code": role_code,
                    "nickname": agent.nickname if agent else "Unknown",
                    "message": "Agent已存在"
                }
            }
        
        # 获取用户的数字孪生数据
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if not os.path.exists(user_file):
            raise HTTPException(status_code=404, detail="用户数据不存在")
        
        user_data = load_json_file(user_file)
        digital_twin = user_data.get('digital_twin')
        if not digital_twin:
            raise HTTPException(status_code=404, detail="数字孪生数据不存在")
        
        # 从数字孪生数据中提取 soul_profile
        soul_profile = digital_twin.get('extracted_profile', {})
        
        # 兼容新版结构 (core_traits)
        # Check for core_traits in personality (where CreationWizard puts it) or at top level
        core_traits = None
        if 'personality' in digital_twin and isinstance(digital_twin['personality'], dict) and 'mbti' in digital_twin['personality']:
             core_traits = digital_twin['personality']
        elif 'core_traits' in digital_twin:
             core_traits = digital_twin['core_traits']

        if not soul_profile and core_traits:
            soul_profile = {
                "mbti": core_traits.get('mbti'),
                "interests": core_traits.get('values', []), # 使用values作为兴趣/价值观
                "social_goals": core_traits.get('values', []),
                "big_five": core_traits.get('big_five', {}),
                "defense_mechanism": core_traits.get('defense_mechanism'),
                "attachment_style": core_traits.get('attachment_style'),
                "personality": core_traits # 保留完整core_traits
            }

        if not soul_profile:
            # 如果没有 extracted_profile，尝试从其他字段构建
            soul_profile = get_soul_profile(user_id=user_id)
        
        # 创建用户 Agent
        user_agent = manager.scrollweaver.server.add_user_agent(
            user_id=user_id,
            role_code=role_code,
            soul_profile=soul_profile
        )
        
        # 记录用户 Agent 映射
        manager.user_agents[user_id] = role_code
        
        # 重置生成器初始化标志
        manager.generator_initialized = False
        
        print(f"用户Agent已恢复到沙盒: {user_agent.nickname} ({role_code})")
        
        return {
            "success": True,
            "already_exists": False,
            "agent_info": {
                "role_code": role_code,
                "role_name": user_agent.role_name,
                "nickname": user_agent.nickname,
                "location": user_agent.location_name
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in restore_user_agent: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear-preset-agents")
async def clear_preset_agents(request: Request):
    """清空沙盒中的所有预设agents（保留用户agent）"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        # 获取当前沙盒中的所有agents (注意：role_codes是Server类的属性)
        role_codes = list(manager.scrollweaver.server.role_codes)
        removed_count = 0
        
        print(f"\n========== 清空预设agents ==========")
        print(f"清空前沙盒中的agents数量: {len(role_codes)}")
        print(f"清空前的agents列表: {role_codes}")
        
        # 遍历所有agents，移除预设agents（保留用户agent）
        for role_code in role_codes:
            # 检查是否是用户agent（user_agent开头）
            if not role_code.startswith('user_agent_'):
                # 是预设agent，移除
                try:
                    # 从role_codes列表中移除
                    if role_code in manager.scrollweaver.server.role_codes:
                        manager.scrollweaver.server.role_codes.remove(role_code)
                    
                    # 从performers字典中移除
                    if role_code in manager.scrollweaver.server.performers:
                        del manager.scrollweaver.server.performers[role_code]
                    
                    removed_count += 1
                    print(f"✓ 已移除预设agent: {role_code}")
                except Exception as e:
                    print(f"✗ 移除agent {role_code} 时出错: {e}")
        
        print(f"清空后沙盒中的agents数量: {len(manager.scrollweaver.server.role_codes)}")
        print(f"清空后的agents列表: {list(manager.scrollweaver.server.role_codes)}")
        print(f"共移除 {removed_count} 个预设agents")
        print(f"====================================\n")
        
        return {
            "success": True,
            "removed_count": removed_count,
            "message": f"已清空 {removed_count} 个预设agents"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error clearing preset agents: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/neural-match")
async def neural_match(request: Request):
    """神经元匹配：计算用户数字孪生与预设 agents 的匹配度"""
    try:
        user_id = get_user_id_from_session(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="未登录")
        
        # 获取用户的数字孪生
        user_file = os.path.join(USERS_DIR, f"{user_id}.json")
        if not os.path.exists(user_file):
            raise HTTPException(status_code=404, detail="用户尚未创建数字孪生")
        
        user_data = load_json_file(user_file)
        digital_twin = user_data.get('digital_twin')
        if not digital_twin:
            raise HTTPException(status_code=404, detail="用户尚未创建数字孪生")
        
        # 获取所有预设 agents
        preset_templates = PresetAgents.get_preset_templates()
        
        # 构建用户 agent 的 profile（用于匹配计算）
        # 优先使用 personality 字段 (新版结构)
        personality = digital_twin.get('personality', {})
        generated_traits = digital_twin.get('generated_profile', {}).get('core_traits', {})
        extracted_profile = digital_twin.get('extracted_profile', {})
        
        user_profile = {
            "mbti": personality.get('mbti') or generated_traits.get('mbti') or extracted_profile.get('mbti', ''),
            "interests": extracted_profile.get('interests', []) or personality.get('values', []) or generated_traits.get('values', []),
            "social_goals": extracted_profile.get('social_goals', []) or personality.get('values', []) or generated_traits.get('values', []),
            "personality": personality.get('big_five') or generated_traits.get('big_five') or extracted_profile.get('personality', '')
        }
        
        # 计算匹配度
        matches = []
        
        # 调试输出：用户profile
        print(f"\n========== Neural Matching Debug ==========")
        print(f"User Profile:")
        print(f"  MBTI: {user_profile.get('mbti')}")
        print(f"  Big Five: {user_profile.get('personality')}")
        print(f"  Interests: {user_profile.get('interests')[:3] if user_profile.get('interests') else 'None'}...")
        print(f"  Values: {user_profile.get('social_goals')[:3] if user_profile.get('social_goals') else 'None'}...")
        print(f"==========================================\n")
        
        # 预计算用户Embedding（避免重复计算）
        user_embeddings = {}
        embedding_model = manager.scrollweaver.server.embedding
        
        if embedding_model:
            try:
                # 准备用户文本数据
                user_interests_text = " ".join(user_profile.get("interests", []))
                user_values_text = " ".join(user_profile.get("social_goals", [])) # Values usually in social_goals or values
                user_goals_text = " ".join(user_profile.get("social_goals", []))
                
                # 批量生成Embedding
                texts_to_embed = [t for t in [user_interests_text, user_values_text, user_goals_text] if t]
                if texts_to_embed:
                    embeddings = embedding_model(texts_to_embed)
                    idx = 0
                    if user_interests_text:
                        user_embeddings["interests"] = embeddings[idx]
                        idx += 1
                    if user_values_text:
                        user_embeddings["values"] = embeddings[idx]
                        idx += 1
                    if user_goals_text:
                        user_embeddings["goals"] = embeddings[idx]
                        idx += 1
            except Exception as e:
                print(f"Error generating user embeddings: {e}")

        for preset in preset_templates:
            preset_profile = {
                "interests": preset.get('interests', []),
                "mbti": preset.get('mbti', ''),
                "social_goals": preset.get('social_goals', []),
                "personality": preset.get('personality', ''),
                "big_five": preset.get('big_five', {}),
                "values": preset.get('values', [])
            }
            
            # 使用高级匹配算法
            # 获取预设Agent的Embedding (带缓存)
            preset_embeddings = PresetAgents.get_preset_embeddings(preset, embedding_model)
            
            compatibility_result = calculate_advanced_compatibility(user_profile, preset_profile, user_embeddings, preset_embeddings)
            compatibility = compatibility_result['score']
            breakdown = compatibility_result['breakdown']
            
            # 调试输出：每个preset的匹配度
            print(f"[Match] {preset.get('name'):15s} | MBTI: {preset.get('mbti'):4s} | Score: {compatibility*100:5.1f}%")
            print(f"  Breakdown: {breakdown}")
            
            matches.append({
                "id": preset.get('id'),
                "name": preset.get('name'),
                "role": preset.get('description', ''),
                "match": round(compatibility * 100),
                "match_breakdown": breakdown,  # 添加详细breakdown
                "avatar": get_avatar_color(preset.get('id')),
                "status": "online",
                "preset": preset
            })
        
        # 按匹配度排序
        matches.sort(key=lambda x: x['match'], reverse=True)
        
        # 调试输出：排序后的结果
        print(f"\n========== Sorted Matches ==========")
        for i, match in enumerate(matches[:5], 1):
            print(f"{i}. {match['name']:15s} | {match['match']}%")
        print(f"====================================\n")
        
        # Top 3 完美共鸣
        top_matches = matches[:3]
        
        # 2 个随机遭遇（从匹配度较低的agents中选择，增加多样性）
        import random
        # 从后50%的agents中随机选择（真正的"偶然遭遇"，不是高匹配）
        all_remaining = matches[3:]
        if len(all_remaining) >= 4:
            # 如果剩余agents足够多，从后半部分（低匹配度）中随机选择
            lower_half_start = len(all_remaining) // 2
            random_pool = all_remaining[lower_half_start:]
            random_encounters = random.sample(random_pool, min(2, len(random_pool)))
        elif len(all_remaining) >= 2:
            # agents不够多，就从所有剩余中随机选
            random_encounters = random.sample(all_remaining, 2)
        elif len(all_remaining) == 1:
            random_encounters = all_remaining
        else:
            random_encounters = []
        
        return {
            "success": True,
            "matched_twins": top_matches,
            "random_twins": random_encounters
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in neural_match: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def calculate_advanced_compatibility(profile1: dict, profile2: dict, user_embeddings: dict = None, preset_embeddings: dict = None) -> float:
    """
    高级匹配度计算算法 (Scheme C + B)
    综合考量：性格共鸣(40%) + 价值观契合(35%) + 兴趣重叠(15%) + 社交目标(10%)
    """
    import numpy as np
    
    scores = []
    
    # --- 1. 性格共鸣 (Personality Resonance) - 权重 40% ---
    # 包含 Big Five 距离 (25%) + MBTI 互补性 (15%)
    
    # A. Big Five 距离 (欧几里得距离)
    bf1 = profile1.get('personality', {})
    bf2 = profile2.get('big_five', {})
    
    # 确保是字典且有数据
    if not isinstance(bf1, dict): bf1 = {}
    if not isinstance(bf2, dict): bf2 = {}
    
    dims = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
    dist_sq = 0
    valid_dims = 0
    
    for dim in dims:
        v1 = bf1.get(dim)
        v2 = bf2.get(dim)
        if v1 is not None and v2 is not None:
            # 归一化差异 (假设输入是0-1)
            diff = float(v1) - float(v2)
            dist_sq += diff * diff
            valid_dims += 1
            
    if valid_dims > 0:
        # 计算平均距离
        avg_dist = np.sqrt(dist_sq / valid_dims)
        # 距离越小越好，转换为相似度 (0-1)
        # 使用更强的高斯核函数增加区分度: gamma从2.0提升到5.0
        bf_score = np.exp(-5.0 * (avg_dist ** 2))
    else:
        bf_score = 0.3 # 默认降低（从0.5降至0.3），缺失数据时匹配度更低
        
    # B. MBTI 互补性
    mbti1 = profile1.get('mbti', '')
    mbti2 = profile2.get('mbti', '')
    mbti_score = 0.3  # 默认降低
    
    if mbti1 and mbti2 and len(mbti1) == 4 and len(mbti2) == 4:
        # E/I: 互补更好 (Different is better)
        s_ei = 1.0 if mbti1[0] != mbti2[0] else 0.5  # 降低"相同"的分数
        # N/S: 相同更好 (Same is better) - 沟通基础
        s_ns = 1.0 if mbti1[1] == mbti2[1] else 0.3  # 增加惩罚
        # T/F: 互补或相同皆可，视情况而定，这里暂定相同稍好
        s_tf = 0.7 if mbti1[2] == mbti2[2] else 0.5
        # J/P: 互补通常有助于生活协作，但在闲聊中相同可能更轻松
        s_jp = 0.7 if mbti1[3] == mbti2[3] else 0.5
        
        mbti_score = (s_ei * 0.3 + s_ns * 0.4 + s_tf * 0.15 + s_jp * 0.15)
        
    personality_resonance = bf_score * 0.6 + mbti_score * 0.4
    scores.append(('personality', personality_resonance, 0.50))  # 提升到50%权重
    
    # --- 2. 语义匹配 (Semantic Matching) ---
    # 辅助函数：计算余弦相似度
    def cosine_sim(vec1, vec2):
        if vec1 is None or vec2 is None: return 0.3  # 降低默认值
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0: return 0.0
        return np.dot(vec1, vec2) / (norm1 * norm2)

    # A. 价值观契合 (Values Alignment) - 权重 35%
    values_score = 0.3  # 降低默认值
    if user_embeddings and "values" in user_embeddings and preset_embeddings and "values" in preset_embeddings:
        try:
            raw_sim = cosine_sim(user_embeddings["values"], preset_embeddings["values"])
            # 激进的非线性映射：余弦相似度天生偏高，需要强力压制
            # 使用指数惩罚: score = (raw_sim - 0.5)^3 if > 0.5
            if raw_sim > 0.85:
                values_score = 0.7 + (raw_sim - 0.85) * 2.0  # 0.85-1.0 → 0.7-1.0
            elif raw_sim > 0.75:
                values_score = 0.4 + (raw_sim - 0.75) * 3.0  # 0.75-0.85 → 0.4-0.7
            elif raw_sim > 0.65:
                values_score = 0.2 + (raw_sim - 0.65) * 2.0  # 0.65-0.75 → 0.2-0.4
            elif raw_sim > 0.5:
                values_score = (raw_sim - 0.5) * 1.33        # 0.5-0.65 → 0-0.2
            else:
                values_score = 0.0
        except:
            pass
    else:
        # 回退到 Jaccard
        v1 = set(profile1.get('social_goals', [])) # User values often in social_goals
        v2 = set(profile2.get('values', []))
        if v1 and v2:
            values_score = len(v1 & v2) / len(v1 | v2)
            
    scores.append(('values', values_score, 0.30))  # 降低权重
    
    # B. 兴趣重叠 (Interests Overlap) - 权重 15%
    interests_score = 0.3  # 降低默认值
    if user_embeddings and "interests" in user_embeddings and preset_embeddings and "interests" in preset_embeddings:
        try:
            raw_sim = cosine_sim(user_embeddings["interests"], preset_embeddings["interests"])
            # 应用同样激进的映射
            if raw_sim > 0.8:
                interests_score = 0.6 + (raw_sim - 0.8) * 2.0
            elif raw_sim > 0.65:
                interests_score = 0.3 + (raw_sim - 0.65) * 2.0
            elif raw_sim > 0.5:
                interests_score = (raw_sim - 0.5) * 2.0
            else:
                interests_score = 0.0
        except:
            pass
    else:
        # 回退到 Jaccard
        i1 = set(profile1.get('interests', []))
        i2 = set(profile2.get('interests', []))
        if i1 and i2:
            interests_score = len(i1 & i2) / len(i1 | i2)
            
    scores.append(('interests', interests_score, 0.10))  # 降低权重
    
    # C. 社交目标 (Social Goals) - 权重 10%
    goals_score = 0.3  # 降低默认值
    if user_embeddings and "goals" in user_embeddings and preset_embeddings and "goals" in preset_embeddings:
        try:
            raw_sim = cosine_sim(user_embeddings["goals"], preset_embeddings["goals"])
            # 应用最激进的映射（因为这个维度区分度最差）
            if raw_sim > 0.85:
                goals_score = 0.7 + (raw_sim - 0.85) * 2.0
            elif raw_sim > 0.7:
                goals_score = 0.3 + (raw_sim - 0.7) * 2.67
            elif raw_sim > 0.5:
                goals_score = (raw_sim - 0.5) * 1.5
            else:
                goals_score = 0.0
        except:
            pass
    else:
        # 回退到 Jaccard
        g1 = set(profile1.get('social_goals', []))
        g2 = set(profile2.get('social_goals', []))
        if g1 and g2:
            goals_score = len(g1 & g2) / len(g1 | g2)
            
    scores.append(('goals', goals_score, 0.10))
    
    # 计算加权总分
    total_score = sum(score * weight for _, score, weight in scores)
    
    # 调试输出：各维度得分
    debug_output = f"  P:{scores[0][1]:.2f}({scores[0][2]}) V:{scores[1][1]:.2f}({scores[1][2]}) I:{scores[2][1]:.2f}({scores[2][2]}) G:{scores[3][1]:.2f}({scores[3][2]}) => Total:{total_score:.3f}"
    
    # 应用非线性映射，进一步拉大区分度
    # 使用sigmoid风格的映射
    import random
    # 将0.3-0.9的原始分数映射到0.1-0.99
    if total_score > 0.6:
        # 高分区：0.6-1.0 → 0.65-0.99
        mapped_score = 0.65 + (total_score - 0.6) * 0.85
    elif total_score > 0.4:
        # 中分区：0.4-0.6 → 0.35-0.65
        mapped_score = 0.35 + (total_score - 0.4) * 1.5
    else:
        # 低分区：0.0-0.4 → 0.1-0.35
        mapped_score = 0.1 + total_score * 0.625
    
    # 添加小的随机扰动，避免分数完全相同
    jitter = random.uniform(-0.03, 0.03)
    final_score = max(0.05, min(0.99, mapped_score + jitter))
    
    # 输出映射后的分数
    print(debug_output + f" | Mapped:{mapped_score:.3f} Final:{final_score:.3f}")
    
    # 返回最终分数和详细breakdown
    return {
        'score': final_score,
        'breakdown': {
            'personality': round(scores[0][1] * 100, 1),
            'values': round(scores[1][1] * 100, 1),
            'interests': round(scores[2][1] * 100, 1),
            'goals': round(scores[3][1] * 100, 1)
        }
    }

def get_avatar_color(preset_id: str) -> str:
    """根据预设ID返回头像颜色类"""
    color_map = {
        "preset_001": "bg-purple-500",
        "preset_002": "bg-blue-500",
        "preset_003": "bg-pink-500",
        "preset_004": "bg-indigo-600",
        "preset_005": "bg-red-600",
        "preset_006": "bg-cyan-500",
        "preset_007": "bg-yellow-500",
        "preset_008": "bg-green-500",
        "preset_009": "bg-orange-500",
        "preset_010": "bg-teal-500",
        "preset_011": "bg-violet-500",
        "preset_012": "bg-rose-500"
    }
    return color_map.get(preset_id, "bg-slate-500")

@app.post("/api/reset-all")
async def reset_all():
    """重置所有内容：清除所有soulverse角色数据和状态"""
    try:
        import shutil
        
        # 1. 停止所有正在运行的任务
        for client_id in list(manager.story_tasks.keys()):
            task = manager.story_tasks.get(client_id)
            if task and not task.done():
                task.cancel()
        
        # 2. 清除所有WebSocket连接的状态
        manager.story_tasks.clear()
        manager.user_selected_roles.clear()
        manager.waiting_for_input.clear()
        manager.pending_user_inputs.clear()
        manager.possession_mode.clear()
        manager.user_agents.clear()
        manager.pending_display_message.clear()
        
        # 3. 清除soulverse运行时创建的角色数据目录
        # 注意：
        # - 只删除运行时创建的角色实例（soulverse_npcs 和 soulverse_users）
        # - 不删除预设模板（预设Agent模板在代码modules/preset_agents.py中）
        # - 不删除预设配置文件（experiment_presets/目录下的JSON文件）
        # - 不删除其他预设角色（如A_Dream_in_Red_Mansions、A_Song_of_Ice_and_Fire等）
        base_dir = os.path.dirname(os.path.abspath(__file__))
        soulverse_npcs_dir = os.path.join(base_dir, "data", "roles", "soulverse_npcs")
        soulverse_users_dir = os.path.join(base_dir, "data", "roles", "soulverse_users")
        
        # 安全地清除目录内容，保留目录结构
        # 这样不会影响预设模板、预设配置文件或其他预设角色
        try:
            if os.path.exists(soulverse_npcs_dir):
                # 删除目录内的所有文件和子目录，但保留目录本身
                items = os.listdir(soulverse_npcs_dir)
                for item in items:
                    item_path = os.path.join(soulverse_npcs_dir, item)
                    try:
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        elif os.path.isfile(item_path):
                            os.remove(item_path)
                    except Exception as e:
                        print(f"Warning: 无法删除 {item_path}: {e}")
                print(f"已清除NPC Agent实例: {soulverse_npcs_dir}")
            else:
                os.makedirs(soulverse_npcs_dir, exist_ok=True)
        except Exception as e:
            print(f"Error clearing soulverse_npcs directory: {e}")
        
        try:
            if os.path.exists(soulverse_users_dir):
                # 删除目录内的所有文件和子目录，但保留目录本身
                items = os.listdir(soulverse_users_dir)
                for item in items:
                    item_path = os.path.join(soulverse_users_dir, item)
                    try:
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        elif os.path.isfile(item_path):
                            os.remove(item_path)
                    except Exception as e:
                        print(f"Warning: 无法删除 {item_path}: {e}")
                print(f"已清除用户Agent实例: {soulverse_users_dir}")
            else:
                os.makedirs(soulverse_users_dir, exist_ok=True)
        except Exception as e:
            print(f"Error clearing soulverse_users directory: {e}")
        
        # 4. 重新初始化ScrollWeaver实例
        if "preset_path" in config and config["preset_path"]:
            if os.path.exists(config["preset_path"]):
                preset_path = config["preset_path"]
            else:
                raise ValueError(f"The preset path {config['preset_path']} does not exist.")
        elif "genre" in config and config["genre"]:
            genre = config["genre"]
            preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),f"./config/experiment_{genre}.json")
        else:
            preset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                      'experiment_presets/soulverse_sandbox.json')
            if not os.path.exists(preset_path):
                print(f"Warning: Soulverse preset not found, using default.")
        
        # 重新创建ScrollWeaver实例
        manager.scrollweaver = ScrollWeaver(
            preset_path=preset_path,
            world_llm_name=config["world_llm_name"],
            role_llm_name=config["role_llm_name"],
            embedding_name=config["embedding_model_name"]
        )
        
        # 设置生成器
        rounds = config.get("rounds", 100) if manager.scrollweaver.server.is_soulverse_mode else config.get("rounds", 10)
        manager.scrollweaver.set_generator(
            rounds=rounds,
            save_dir=config.get("save_dir", ""),
            if_save=config.get("if_save", 0),
            mode="free",
            scene_mode=config.get("scene_mode", 1)
        )
        
        # 5. 通知所有连接的客户端重置
        for client_id, websocket in list(manager.active_connections.items()):
            try:
                await websocket.send_json({
                    "type": "system_reset",
                    "message": "系统已重置，所有数据已清除"
                })
            except Exception as e:
                print(f"Error sending reset message to {client_id}: {e}")
        
        return {
            "success": True,
            "message": "所有内容已成功重置"
        }
        
    except Exception as e:
        print(f"Error resetting all: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
