import asyncio
from fastapi import WebSocket
from typing import Dict, List, Optional
import uuid
import os
from datetime import datetime, timedelta
from ScrollWeaver import ScrollWeaver
from sw_utils import is_image, load_json_file

# Load config similar to server.py
config = load_json_file('config.json')
default_icon_path = './frontend/assets/images/default-icon.jpg'

class Room:
    def __init__(self, room_id: str, preset_path: str = None):
        self.room_id = room_id
        self.active_connections: Dict[str, WebSocket] = {}  # client_id -> WebSocket
        self.story_task: Optional[asyncio.Task] = None
        
        # Room state
        self.user_selected_roles: Dict[str, str] = {}  # client_id -> role_code
        self.waiting_for_input: Dict[str, bool] = {}  # client_id -> bool
        self.pending_user_inputs: Dict[str, asyncio.Future] = {}  # client_id -> Future
        self.possession_mode: Dict[str, bool] = {}  # client_id -> bool
        self.user_agents: Dict[str, str] = {}  # user_id -> role_code
        self.pending_display_message: Dict[str, dict] = {}
        
        self.last_empty_time: Optional[datetime] = datetime.now() # Start empty
        
        
        # Initialize ScrollWeaver
        self._init_scrollweaver(preset_path)
        
    def _init_scrollweaver(self, preset_path: str = None):
        if not preset_path:
             if "preset_path" in config and config["preset_path"] and os.path.exists(config["preset_path"]):
                preset_path = config["preset_path"]
             elif "genre" in config and config["genre"]:
                genre = config["genre"]
                preset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), f"config/experiment_{genre}.json")
             else:
                preset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                          'experiment_presets/soulverse_sandbox.json')
        
        if not os.path.exists(preset_path):
             print(f"Warning: Preset path {preset_path} does not exist. Using default.")
             # Fallback logic could be added here
        
        print(f"Initializing Room {self.room_id} with preset: {preset_path}")
        
        self.scrollweaver = ScrollWeaver(
            preset_path=preset_path,
            world_llm_name=config["world_llm_name"],
            role_llm_name=config["role_llm_name"],
            embedding_name=config["embedding_model_name"]
        )
        
        self.generator_config = {
            "rounds": config.get("rounds", 100) if self.scrollweaver.server.is_soulverse_mode else config.get("rounds", 10),
            "save_dir": config.get("save_dir", ""),
            "if_save": config.get("if_save", 0),
            "mode": "free",
            "scene_mode": 1,
        }
        self.generator_initialized = False

    async def connect(self, websocket: WebSocket, client_id: str, user_id: str = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.last_empty_time = None # Active now
        
        if user_id:
            # Check if this user already has an assigned agent in this room
            if user_id in self.user_agents:
                role_code = self.user_agents[user_id]
                self.user_selected_roles[client_id] = role_code
                print(f"  -> Auto-linked Client {client_id} to User Agent {role_code} (User {user_id})")
                
            # Store client_id for this user (for later lookups)
            self.user_client_map = getattr(self, 'user_client_map', {})
            if user_id not in self.user_client_map:
                self.user_client_map[user_id] = set()
            self.user_client_map[user_id].add(client_id)
        
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            
        if not self.active_connections:
            self.last_empty_time = datetime.now()
        
        # If no clients left, maybe stop the story task?
        # For now, we clean up client specific state
        if client_id in self.user_selected_roles:
            del self.user_selected_roles[client_id]
            # Broadcast updated selection map asynchronously
            try:
                asyncio.create_task(self.broadcast_json({'type': 'role_selection_map', 'data': self.user_selected_roles}))
            except Exception:
                pass
        if client_id in self.waiting_for_input:
            del self.waiting_for_input[client_id]
        if client_id in self.pending_user_inputs:
            if not self.pending_user_inputs[client_id].done():
                self.pending_user_inputs[client_id].cancel()
            del self.pending_user_inputs[client_id]

    async def broadcast_json(self, data: dict):
        """Send JSON to all connected clients"""
        disconnected = []
        for cid, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception as e:
                print(f"Error broadcasting to {cid}: {e}")
                disconnected.append(cid)
        
        for cid in disconnected:
            self.disconnect(cid)

    async def cleanup(self):
        """Cleanup room resources"""
        if self.story_task:
            self.story_task.cancel()
            try:
                await self.story_task
            except asyncio.CancelledError:
                pass
        
        for cid in list(self.active_connections.keys()):
            await self.active_connections[cid].close()
            del self.active_connections[cid]

    # ... Include logic from ConnectionManager but adapted for Room ...
    # Specifically, generate_story should loop and broadcast
    
    def _ensure_generator_initialized(self):
        if not self.generator_initialized:
            if len(self.scrollweaver.server.role_codes) == 0:
                return False
            
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
        # ... logic from ConnectionManager.get_next_message ...
        if not self._ensure_generator_initialized():
            return None, None
        
        max_attempts = 10
        attempts = 0
        loop = asyncio.get_running_loop()

        while attempts < max_attempts:
            try:
                # 同步当前房间中被用户选中的角色到 ScrollWeaver，使其可识别多用户占位符
                try:
                    selected = set(self.user_selected_roles.values()) if self.user_selected_roles else set()
                    # 存为可序列化的列表或集合，ScrollWeaver 支持 `_user_role_codes`
                    self.scrollweaver.server._user_role_codes = list(selected)
                    # 同步 possession 模式到 ScrollWeaver（按 role）
                    pos_map = {}
                    for cid, role in self.user_selected_roles.items():
                        if role:
                            pos_map[role] = bool(self.possession_mode.get(cid, False))
                    self.scrollweaver.server.possession_modes = pos_map
                    self.scrollweaver.server._possession_mode_by_role = pos_map
                    # 兼容性全局标志
                    self.scrollweaver.server._possession_mode = any(pos_map.values()) if pos_map else False
                except Exception:
                    pass
                
                # Execute blocking generator in a separate thread
                # Note: generate_next_message is synchronous and cpu/io bound (LLM calls)
                message = await loop.run_in_executor(None, self.scrollweaver.generate_next_message)
                
            except StopIteration:
                return None, None
            except AttributeError as e:
                # Catching thread execution errors might wrap them, but here we assume direct usage
                if "generator" in str(e):
                    return None, None
                raise
            except Exception as e:
                print(f"Error in async generation: {e}")
                import traceback
                traceback.print_exc()
                # Stop iteration on error or retry? 
                # If it's a StopIteration from inside the thread, it might come as runtime error?
                # ThreadPoolExecutor doesn't propagate StopIteration easily if it's raised as exception.
                # Actually concurrent.futures wraps exceptions.
                # If generate_next_message raises StopIteration, run_in_executor will raise it here.
                # Let's check if it IS StopIteration
                if isinstance(e, StopIteration):
                     return None, None
                attempts += 1
                continue
            
            if message is None:
                attempts += 1
                continue
            
            text = message.get("text", "").strip()
            if text == "__USER_INPUT_PLACEHOLDER__":
                message["is_placeholder"] = True
                status = self.scrollweaver.get_current_status()
                return message, status
            
            if not text:
                attempts += 1
                continue

            if not os.path.exists(message.get("icon", "")) or not is_image(message.get("icon", "")):
                message["icon"] = default_icon_path
            
            status = self.scrollweaver.get_current_status()
            return message, status
        
        return None, None
    
    def _get_role_code_by_name(self, role_name: str) -> str:
        # ... logic from ConnectionManager ...
        if not role_name:
            return None
        try:
            role_name_lower = role_name.lower().strip()
            for role_code in self.scrollweaver.server.role_codes:
                performer = self.scrollweaver.server.performers[role_code]
                if (performer.role_name and performer.role_name.lower().strip() == role_name_lower) or \
                   (performer.nickname and performer.nickname.lower().strip() == role_name_lower):
                    return role_code
        except Exception:
            pass
        return None

    async def handle_user_role_input(self, client_id: str, role_code: str, user_text: str, delay_display: bool = False, skip_broadcast: bool = False):
        # ... logic from ConnectionManager ...
        try:
            record_id = str(uuid.uuid4())
            self.scrollweaver.server.record(
                role_code=role_code,
                detail=user_text,
                actor=role_code,
                group=self.scrollweaver.server.current_status.get('group', [role_code]),
                actor_type='role',
                act_type="user_input",
                record_id=record_id
            )
            
            performer = self.scrollweaver.server.performers[role_code]
            username = performer.nickname if hasattr(performer, 'nickname') and performer.nickname else (performer.role_name if hasattr(performer, 'role_name') else role_code)
            message = {
                'username': username,
                'type': 'role',
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'text': user_text,
                'icon': performer.icon_path if hasattr(performer, 'icon_path') and os.path.exists(performer.icon_path) and is_image(performer.icon_path) else default_icon_path,
                'uuid': record_id,
                'scene': self.scrollweaver.server.cur_round,
                'is_user': True
            }
            
            if delay_display:
                self.pending_display_message[client_id] = message
            elif not skip_broadcast:
                await self.broadcast_json({
                    'type': 'message',
                    'data': message
                })
                status = self.scrollweaver.get_current_status()
                await self.broadcast_json({
                    'type': 'status_update',
                    'data': status
                })
        except Exception as e:
            print(f"Error handling user role input: {e}")

    async def start_story_loop(self):
        """Single loop to drive the story forward for the room"""
        if self.story_task and not self.story_task.done():
            return # Already running
            
        self.story_task = asyncio.create_task(self._story_loop())
    
    async def _story_loop(self):
        print(f"Starting story loop for Room {self.room_id}")
        try:
            if len(self.scrollweaver.server.role_codes) == 0:
                 await self.broadcast_json({
                    'type': 'error',
                    'data': {'message': 'Waiting for characters...'}
                })
                 # Wait a bit or exit loop? Let's check periodically or wait for an event?
                 # For now, just exit and let 'start_story_loop' be called again when agents are added
                 return

            while True:
                # Check active connections
                if not self.active_connections:
                    await asyncio.sleep(1)
                    continue # Pause if nobody listening? Or keep running? 
                    # Probably keep running but maybe slower or pause to save resources
                    # For a multiplayer game, usually the world keeps running or pauses if empty.
                    # Let's pause to save tokens.
                    # continue

                # Determine active user role across all clients?
                # The logic in ConnectionManager assumed one user driving one role.
                # In multiplayer, multiple users might drive multiple roles, or share.
                # Simplified: Check if ANY client has selected a role that is currently acting?
                
                # Logic adaptation:
                # pass ALL user selected roles to server?
                # server._user_role_code was a single string.
                # multiplayer support required in ScrollWeaver? 
                # Assuming simple adaptation: If the NEXT actor is controlled by ANY user, we wait.
                
                # We need to know who is controlled.
                controlled_roles = set(self.user_selected_roles.values())
                
                # We can't easily pass list of user roles to single var `_user_role_code`.
                # BUT, `ConnectionManager` passed it just before `get_next_message`.
                # `ScrollWeaver` uses `decide_next_actor`.
                # If `decide_next_actor` picks a role that is in `controlled_roles`, we handle it.
                
                # Modify ScrollWeaver state to know all user roles?
                # Or just let it pick naturally. If it picks a role X:
                # If X is in controlled_roles, we hit the placeholder logic if we set the flag.
                
                # Hack: We can set `_user_role_code` to the *likely next* or *any* for now to trigger the logic inside generator?
                # Actually, `decide_next_actor` logic in `ScrollWeaver` doesn't strictly depend on `_user_role_code` for SELECTION,
                # but `generate_next_message` checks if the SELECTED actor == `_user_role_code` to yield placeholder.
                
                # To support multiple user roles, we might need to patch ScrollWeaver or use a trick.
                # Let's assume for this step we support one acting user at a time or we need to update `ScrollWeaver` (out of scope?).
                # Wait! The generator yields tokens/messages.
                
                # If we want `ScrollWeaver` to yield placeholder for ANY user role:
                # We need to intercept the check inside `ScrollWeaver`.
                
                # Let's look at `ConnectionManager` logic again.
                # It sets `self.scrollweaver.server._user_role_code = user_role_code`.
                
                # If we have multiple users, we might need to set `_user_role_code` to a LIST or change how we invoke it.
                # Or, we just set it to the role that is about to act? We don't know who is about to act until `decide_next_actor` runs inside generator.
                
                # Workaround:
                # If we can't change `ScrollWeaver`, we might suffer.
                # But wait, `ScrollWeaver` is likely Python code we can see?
                # Yes, but avoiding deep changes there is better if possible.
                
                # Let's try to set `_user_role_code` to the set of all controlled roles if possible, or iterate?
                # Python dynamic attributes. 
                
                # Actually, simply:
                # `self.scrollweaver.server._controlled_roles = controlled_roles`
                # And we rely on `ScrollWeaver` being smart enough? Unlikely if not written that way.
                
                # Let's assume for the MVP: One "Possession" at a time globally for the room?
                # OR, we risk it not pausing for other users.
                
                # Let's peek at `server.py` lines 222 again.
                # It sets `_user_role_code`.
                
                # In Multi-User, multiple people might possess different agents.
                # If Agent A (User A) is picked, we must pause for User A.
                # If Agent B (User B) is picked, we must pause for User B.
                
                # We need to pass ALL possessed roles.
                # `self.scrollweaver.server._user_role_codes = list(controlled_roles)`
                # (We will need to check if ScrollWeaver supports this, or we patch it).
                
                # For this task, I will set `_user_role_code` to the union of roles if they are compatible, or just one.
                # LIMITATION: If we can't patch ScrollWeaver easily, maybe we accept race condition or limit 1 active user role?
                
                # Let's proceed assuming we can manage flow.
                
                message, status = await self.get_next_message()
                
                if message is None:
                     if len(self.scrollweaver.server.role_codes) == 0:
                        await self.broadcast_json({
                            'type': 'error',
                            'data': {'message': 'Waiting for characters...'}
                        })
                     else:
                        await self.broadcast_json({'type': 'story_ended', 'data': {'message': 'Story ended.'}})
                     break
                
                is_placeholder = message.get('is_placeholder', False) or message.get('text', '').strip().startswith('__USER_INPUT_PLACEHOLDER__')
                
                # Identify which role this message belongs to
                username = message.get('username', '')
                current_role_code = self._get_role_code_by_name(username)
                
                # Check if this role is controlled by any connected client
                # Find client_id that controls this role
                controlling_client_id = None
                for cid, role in self.user_selected_roles.items():
                    if role == current_role_code:
                        controlling_client_id = cid
                        break
                
                if controlling_client_id and is_placeholder:
                    # It's a user turn!
                    # Notify SPECIFIC user to input
                    ws = self.active_connections.get(controlling_client_id)
                    if ws:
                         # Send exclusive request to this user
                         await ws.send_json({
                            'type': 'waiting_for_user_input',
                            'data': {
                                'role_name': username,
                                'message': 'Your turn to act!'
                            }
                        })
                         
                         self.waiting_for_input[controlling_client_id] = True
                         future = asyncio.Future()
                         self.pending_user_inputs[controlling_client_id] = future

                         # Notify others? "Waiting for X..."
                         await self.broadcast_json_except(controlling_client_id, {
                             'type': 'status_update',
                             'data': {'status': f"Waiting for {username}..."}
                         })

                         try:
                             timeout = config.get('user_input_timeout', 60)

                             # Broadcast countdown start to all clients so frontend can show local timer
                             try:
                                 deadline = (datetime.utcnow() + timedelta(seconds=timeout)).isoformat() + 'Z'
                                 await self.broadcast_json({
                                     'type': 'input_countdown_start',
                                     'data': {
                                         'role_name': username,
                                         'role_code': current_role_code,
                                         'duration': int(timeout),
                                         'deadline': deadline
                                     }
                                 })
                             except Exception:
                                 pass

                             user_input_result = await asyncio.wait_for(future, timeout=timeout)
                             if isinstance(user_input_result, tuple):
                                 user_text, is_echoed = user_input_result
                             else:
                                 user_text = user_input_result
                                 is_echoed = False
                                 
                             # Process input... (Similar to existing code)
                             original_uuid = message.get('uuid')
                             
                             def _augment_for_context(text: str, min_len: int = 40) -> str:
                                    t = text.strip()
                                    if len(t) >= min_len:
                                        return t
                                    return f"{t}\n(System Note: User intent is short, please elaborate reasonably.)"
                             
                             augmented_text = _augment_for_context(user_text)
                             
                             # Cancel countdown display (user responded)
                             try:
                                 await self.broadcast_json({
                                     'type': 'input_countdown_cancel',
                                     'data': {'role_code': current_role_code}
                                 })
                             except Exception:
                                 pass

                             if original_uuid:
                                 self.scrollweaver.server.history_manager.modify_record(original_uuid, augmented_text)
                                 # Update act_type
                                 for record in self.scrollweaver.server.history_manager.detailed_history:
                                     if record.get("record_id") == original_uuid:
                                         record["act_type"] = "user_input"
                                         break

                                 if not is_echoed:
                                      # Broadcast echo to ALL
                                      echo_msg = {
                                        'type': 'role',
                                        'username': username,
                                        'text': user_text,
                                        'is_user': True,
                                        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                        'uuid': original_uuid
                                      }
                                      await self.broadcast_json({'type': 'message', 'data': echo_msg})
                             else:
                                 # Fallback
                                 await self.handle_user_role_input(controlling_client_id, current_role_code, user_text)

                         except asyncio.TimeoutError:
                             # User did not respond in time. Notify room and skip.
                             try:
                                 await self.broadcast_json({
                                     'type': 'input_countdown_timeout',
                                     'data': {
                                         'role_name': username,
                                         'role_code': current_role_code,
                                         'message': f'用户 {username} 超时未回复，已跳过'
                                     }
                                 })
                             except Exception:
                                 pass
                             try:
                                 await self.broadcast_json({
                                     'type': 'system',
                                     'data': {'message': f'用户 {username} 超时未回复，已跳过'}
                                 })
                             except Exception:
                                 pass
                             print(f"User input timeout for client {controlling_client_id} (role {current_role_code})")
                             # Attempt AI auto-reply to replace the missing user input
                             try:
                                 performer = None
                                 try:
                                     performer = self.scrollweaver.server.performers.get(current_role_code)
                                 except Exception:
                                     performer = None

                                 if performer:
                                     loop = asyncio.get_running_loop()
                                     # Run the potentially blocking LLM call in a threadpool
                                     try:
                                         ai_interaction = await loop.run_in_executor(
                                             None,
                                             performer.single_role_interact,
                                             current_role_code,
                                             username,
                                             "（用户超时，AI代替回复）",
                                             ""
                                         )
                                     except TypeError:
                                         # Fallback if run_in_executor with args not accepted: use lambda
                                         ai_interaction = await loop.run_in_executor(
                                             None,
                                             lambda: performer.single_role_interact(current_role_code, username, "（用户超时，AI代替回复）", "")
                                         )

                                     ai_text = None
                                     if isinstance(ai_interaction, dict):
                                         ai_text = ai_interaction.get('detail') or ai_interaction.get('text') or None
                                     elif isinstance(ai_interaction, str):
                                         ai_text = ai_interaction

                                     if ai_text:
                                         # Record and broadcast as if it were a user input
                                         try:
                                             await self.handle_user_role_input(controlling_client_id, current_role_code, ai_text)
                                         except Exception as e:
                                             print(f"Error broadcasting AI replacement input: {e}")
                             except Exception as e:
                                 print(f"Error generating AI replacement on timeout: {e}")
                         except Exception as e:
                             print(f"Error handling user input: {e}")
                         finally:
                             self.waiting_for_input[controlling_client_id] = False
                             if controlling_client_id in self.pending_user_inputs:
                                 del self.pending_user_inputs[controlling_client_id]
                    else:
                        # Client disconnected? Skip turn or auto-play
                        pass
                else:
                    # Normal message, broadcast to all
                    if not is_placeholder:
                        await self.broadcast_json({'type': 'message', 'data': message})
                        if status:
                             await self.broadcast_json({'type': 'status_update', 'data': status})
                        await asyncio.sleep(0.2)

        except Exception as e:
            print(f"Room story loop error: {e}")
            import traceback
            traceback.print_exc()

    async def broadcast_json_except(self, excluded_cid: str, data: dict):
        for cid, ws in self.active_connections.items():
            if cid != excluded_cid:
                try:
                    await ws.send_json(data)
                except:
                    pass

class RoomManager:
    def __init__(self):
        self._rooms: Dict[str, Room] = {}
        
    def get_room(self, room_id: str) -> Optional[Room]:
        return self._rooms.get(room_id)
        
    def create_room(self, room_id: str = None, preset_path: str = None) -> Room:
        if not room_id:
            room_id = str(uuid.uuid4())[:8]
        if room_id in self._rooms:
            return self._rooms[room_id]
            
        room = Room(room_id, preset_path)
        self._rooms[room_id] = room
        return room
    
    async def delete_room(self, room_id: str):
        if room_id in self._rooms:
            await self._rooms[room_id].cleanup()
            del self._rooms[room_id]

    def get_or_create_default_room(self) -> Room:
        return self.create_room("default")
        
    async def start_cleanup_task(self):
        """Start the background cleanup loop"""
        asyncio.create_task(self._cleanup_loop())
        
    async def _cleanup_loop(self):
        print("Starting RoomManager cleanup loop")
        while True:
            try:
                await asyncio.sleep(60) # Check every minute
                now = datetime.now()
                ids_to_delete = []
                
                # Check for inactive rooms
                for rid, room in list(self._rooms.items()):
                    if rid == "default": continue # Keep default room? Or clean it too? 
                    # Let's keep default room for convenience, or maybe clean it if using resources.
                    # Usually default room is persistent entry point.
                    
                    if not room.active_connections:
                        if room.last_empty_time:
                             elapsed = (now - room.last_empty_time).total_seconds()
                             if elapsed > 600: # 10 minutes
                                  ids_to_delete.append(rid)
                        else:
                             # Should have been set in disconnect, but if created and never connected:
                             room.last_empty_time = now
                
                for rid in ids_to_delete:
                    print(f"Cleaning up inactive room {rid}")
                    await self.delete_room(rid)
                    
            except Exception as e:
                print(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)
