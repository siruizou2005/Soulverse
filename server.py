from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
import uvicorn
import json
import asyncio
import os
from pathlib import Path
from datetime import datetime
from sw_utils import is_image, load_json_file
from ScrollWeaver import ScrollWeaver
from modules.social_story_generator import SocialStoryGenerator, generate_social_story
from modules.daily_report import DailyReportGenerator, generate_daily_report
from modules.soul_api_mock import get_soul_profile
from modules.profile_extractor import ProfileExtractor, extract_profile_from_text, extract_profile_from_qa
from modules.preset_agents import PresetAgents
from fastapi import UploadFile, File, Form

app = FastAPI()
default_icon_path = './frontend/assets/images/default-icon.jpg'
config = load_json_file('config.json')
for key in config:
    if "API_KEY" in key and config[key]:
        os.environ[key] = config[key]
# Also allow setting API base URLs (mirrors) from config.json, e.g. OPENAI_API_BASE
for key in ['OPENAI_API_BASE', 'GEMINI_API_BASE', 'OPENROUTER_BASE_URL']:
    if key in config and config[key]:
        os.environ[key] = config[key]

static_file_abspath = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))
app.mount("/frontend", StaticFiles(directory=static_file_abspath), name="frontend")

# 预设文件目录
PRESETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'experiment_presets')

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
                "scene_mode": config.get("scene_mode", 1),
            }
            self.generator_initialized = False
            
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
                    else:
                        # 如果用户没有选择角色，清除标志
                        if hasattr(self.scrollweaver.server, '_user_role_code'):
                            delattr(self.scrollweaver.server, '_user_role_code')
                    
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
                    is_possession_mode = self.possession_mode.get(client_id, False)
                    
                    # 检查是否是占位消息（占位消息不应该发送到前端）
                    is_placeholder = message.get('text', '').strip().startswith('__USER_INPUT_PLACEHOLDER__')
                    
                    if user_role_code and message.get('type') == 'role':
                        # 检查当前消息的角色代码是否匹配用户选择的角色
                        # 需要通过角色名称找到角色代码
                        current_role_code = self._get_role_code_by_name(message.get('username', ''))
                        
                        if current_role_code and current_role_code == user_role_code:
                            # 如果是占位消息，不发送到前端，直接等待用户输入
                            if is_placeholder:
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
                                    user_text = await asyncio.wait_for(
                                        self.pending_user_inputs[client_id], 
                                        timeout=None
                                    )
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
                                            self.scrollweaver.server.history_manager.modify_record(original_uuid, augmented_text)

                                            # 立即回显用户消息到前端（显示原文）
                                            echo_msg = dict(message)
                                            echo_msg['text'] = user_text
                                            echo_msg['is_user'] = True
                                            echo_msg['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                            await self.active_connections[client_id].send_json({
                                                'type': 'message',
                                                'data': echo_msg
                                            })

                                            # 清除future和等待状态（继续推进生成，下一条将是其他Agent响应）
                                            if client_id in self.pending_user_inputs:
                                                del self.pending_user_inputs[client_id]
                                            self.waiting_for_input[client_id] = False
                                            
                                            # 继续循环，获取下一条消息（下一个agent的响应）
                                            continue
                                        except Exception as e:
                                            print(f"Error modifying placeholder record {original_uuid}: {e}")
                                            # 如果修改失败，创建新记录（立即显示）
                                            await self.handle_user_role_input(client_id, user_role_code, user_text, delay_display=False)
                                            continue
                                    else:
                                        # 如果没有uuid，创建新记录（立即显示）
                                        await self.handle_user_role_input(client_id, user_role_code, user_text, delay_display=False)
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
            
            # 过滤无效消息
            text = message.get("text", "").strip()
            if not text or text == "__USER_INPUT_PLACEHOLDER__":
                # 跳过占位消息和空消息，继续获取下一条
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
                    if detail:
                        options.append({
                            'index': i + 1,
                            'style': config['style'],
                            'name': config['name'],
                            'description': config['description'],
                            'text': detail
                        })
                except Exception as e:
                    print(f"Error generating option {i+1} ({config['style']}): {e}")
                    import traceback
                    traceback.print_exc()
            
            return options if options else None
        except Exception as e:
            print(f"Error in generate_auto_action_options: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def handle_user_role_input(self, client_id: str, role_code: str, user_text: str, delay_display: bool = False):
        """处理用户输入作为角色消息（当消息没有uuid时使用）
        如果 delay_display=True，则不立即发送消息到前端，交给generate_story在下条Agent消息前发送
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
            message = {
                'username': performer.role_name,
                'type': 'role',
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'text': user_text,
                'icon': performer.icon_path if os.path.exists(performer.icon_path) and is_image(performer.icon_path) else default_icon_path,
                'uuid': record_id,
                'scene': self.scrollweaver.server.cur_round,
                'is_user': True  # 标记为用户输入
            }
            
            # 若设置延迟显示，则缓存；否则立即发送
            if delay_display:
                self.pending_display_message[client_id] = message
            else:
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

@app.get("/")
async def get():
    html_file = Path("index.html")
    return HTMLResponse(html_file.read_text(encoding="utf-8"))

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
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message['type'] == 'user_message':
                # 处理用户消息
                user_text_incoming = message.get('text', '').strip()

                # 优先处理“正在等待用户输入”的情况（即使近期记录仍显示为goal setting也应接收）
                if client_id in manager.waiting_for_input and manager.waiting_for_input[client_id]:
                    # 正常等待用户输入，处理用户输入
                    if client_id in manager.pending_user_inputs:
                        if not manager.pending_user_inputs[client_id].done():
                            if user_text_incoming:
                                manager.pending_user_inputs[client_id].set_result(user_text_incoming)
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
                                # 将选中的选项作为用户输入
                                manager.pending_user_inputs[client_id].set_result(selected_text)
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
            role_code = f"npc_{preset_id}_{int(datetime.now().timestamp())}"
        
        # 创建NPC Agent（使用新的三层人格模型）
        npc_agent = manager.scrollweaver.server.add_npc_agent(
            role_code=role_code,
            role_name=role_name,
            preset_id=preset_id  # 使用preset_id而不是preset_config
        )
        
        # 重置生成器初始化标志，下次调用时会重新初始化
        manager.generator_initialized = False
        
        return {
            "success": True,
            "agent_info": {
                "role_code": role_code,
                "role_name": npc_agent.role_name,
                "nickname": npc_agent.nickname,
                "location": npc_agent.location_name,
                "profile": npc_agent.role_profile[:200] + "..." if len(npc_agent.role_profile) > 200 else npc_agent.role_profile,
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
