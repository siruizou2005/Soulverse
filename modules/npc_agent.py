"""
NPC Agent类
用于创建预设的NPC Agent，与用户Agent进行社交互动
"""
import os
import sys
sys.path.append("../")
from typing import Any, Dict, List, Optional
from modules.main_performer import Performer
from modules.soulverse_mode import SoulverseMode
from sw_utils import *


class NPCAgent(Performer):
    """
    NPC Agent类，用于创建预设的NPC
    继承Performer的所有功能，但使用预设配置初始化
    """
    
    def __init__(self,
                 role_code: str,
                 role_name: str,
                 world_file_path: str,
                 preset_config: Dict[str, Any],
                 language: str = "zh",
                 db_type: str = "chroma",
                 llm_name: str = "gpt-4o-mini",
                 llm = None,
                 embedding_name: str = "bge-small",
                 embedding = None):
        """
        初始化NPC Agent
        
        Args:
            role_code: Agent的角色代码（唯一标识）
            role_name: Agent的名称
            world_file_path: 世界设定文件路径
            preset_config: 预设配置字典，包含兴趣、MBTI、性格、社交目标等
            language: 语言设置
            db_type: 数据库类型
            llm_name: LLM模型名称
            llm: LLM实例（可选）
            embedding_name: 嵌入模型名称
            embedding: 嵌入模型实例（可选）
        """
        self.preset_config = preset_config
        self.is_user_agent = False  # 标记为NPC Agent
        self.is_npc_agent = True  # 标记为NPC
        self.soulverse_mode = SoulverseMode(language=language)  # Soulverse模式
        
        # 从预设配置生成Agent的profile
        agent_profile = self._generate_agent_profile_from_preset(preset_config)
        
        # 创建临时角色信息文件
        role_info = self._create_role_info(role_code, role_name, agent_profile, preset_config)
        
        # 创建临时目录存储角色信息
        temp_role_dir = self._create_temp_role_dir(role_code, role_info)
        
        # 调用父类初始化，使用临时角色目录
        super().__init__(
            role_code=role_code,
            role_file_dir=temp_role_dir,
            world_file_path=world_file_path,
            source="",
            language=language,
            db_type=db_type,
            llm_name=llm_name,
            llm=llm,
            embedding_name=embedding_name,
            embedding=embedding
        )
        
        # 设置长期目标（基于预设配置）
        self.long_term_goals = preset_config.get("social_goals", [])
        self.initial_social_goals = preset_config.get("social_goals", [])
    
    def _generate_agent_profile_from_preset(self, preset_config: Dict[str, Any]) -> str:
        """
        从预设配置生成Agent的profile描述
        
        Args:
            preset_config: 预设配置字典
        
        Returns:
            Agent的profile字符串
        """
        interests = ", ".join(preset_config.get("interests", []))
        mbti = preset_config.get("mbti", "未知")
        personality = preset_config.get("personality", "")
        tags = ", ".join(preset_config.get("tags", []))
        social_goals = ", ".join(preset_config.get("social_goals", []))
        
        profile = f"""这是一个预设的NPC Agent，用于与用户Agent进行社交互动。

基本信息：
- MBTI类型：{mbti}
- 性格特征：{personality}
- 性格标签：{tags}

兴趣标签：{interests}

社交目标：{social_goals}

这个NPC Agent会在虚拟世界中自主行动，与其他Agent（包括用户Agent）进行社交互动，建立关系。"""
        
        return profile
    
    def _create_role_info(self, role_code: str, role_name: str, profile: str, preset_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建角色信息字典
        
        Args:
            role_code: 角色代码
            role_name: 角色名称
            profile: Agent profile
            preset_config: 预设配置
        
        Returns:
            角色信息字典
        """
        role_info = {
            "role_code": role_code,
            "role_name": role_name,
            "nickname": role_name,
            "source": "soulverse_npc",
            "activity": preset_config.get("activity_level", 0.9),
            "profile": profile,
            "relation": {},  # 初始没有关系
            "motivation": ""  # 将在set_motivation时生成
        }
        
        return role_info
    
    def _create_temp_role_dir(self, role_code: str, role_info: Dict[str, Any]) -> str:
        """
        创建临时角色目录并保存角色信息
        
        Args:
            role_code: 角色代码
            role_info: 角色信息字典
        
        Returns:
            临时目录路径
        """
        # 创建临时目录
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        temp_dir = os.path.join(base_dir, "data", "roles", "soulverse_npcs", role_code)
        os.makedirs(temp_dir, exist_ok=True)
        
        # 保存角色信息
        role_info_path = os.path.join(temp_dir, "role_info.json")
        save_json_file(role_info_path, role_info)
        
        # 创建空的role_data（可以后续扩展）
        role_data_path = os.path.join(temp_dir, "role_data.jsonl")
        if not os.path.exists(role_data_path):
            with open(role_data_path, 'w', encoding='utf-8') as f:
                pass  # 创建空文件
        
        return os.path.join(base_dir, "data", "roles")
    
    def get_social_goals(self) -> List[str]:
        """获取社交目标"""
        return self.preset_config.get("social_goals", [])
    
    def set_motivation(self, 
                      world_description: str, 
                      other_roles_info: Dict[str, Any], 
                      intervention: str = "", 
                      script: str = ""):
        """
        重写set_motivation，使用Soulverse社交模式
        
        Args:
            world_description: 世界描述
            other_roles_info: 其他角色信息
            intervention: 干预事件（在Soulverse模式下不使用）
            script: 剧本（在Soulverse模式下不使用）
        """
        if self.motivation:
            return self.motivation
        
        # 使用Soulverse模式生成社交motivation
        social_goals = self.get_social_goals()
        current_location = self.location_name if hasattr(self, 'location_name') and self.location_name else "未知位置"
        
        motivation = self.soulverse_mode.generate_social_motivation(
            agent_profile=self.role_profile,
            social_goals=social_goals,
            world_description=world_description,
            other_agents_info=other_roles_info,
            current_location=current_location
        )
        
        self.motivation = motivation
        return motivation

