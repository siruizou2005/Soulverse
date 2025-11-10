"""
用户Agent类
基于Soul兴趣图谱创建的用户Agent，继承Performer的核心功能
"""
import os
import sys
sys.path.append("../")
from typing import Any, Dict, List, Optional
from modules.main_performer import Performer
from modules.soul_api_mock import get_soul_profile
from modules.soulverse_mode import SoulverseMode
from sw_utils import *


class UserAgent(Performer):
    """
    用户Agent类，基于Soul兴趣图谱创建
    继承Performer的所有功能，但使用用户画像数据初始化
    """
    
    def __init__(self,
                 user_id: str,
                 role_code: str,
                 world_file_path: str,
                 soul_profile: Optional[Dict[str, Any]] = None,
                 language: str = "zh",
                 db_type: str = "chroma",
                 llm_name: str = "gpt-4o-mini",
                 llm = None,
                 embedding_name: str = "bge-small",
                 embedding = None):
        """
        初始化用户Agent
        
        Args:
            user_id: 用户ID
            role_code: Agent的角色代码（唯一标识）
            world_file_path: 世界设定文件路径
            soul_profile: Soul用户画像数据（如果为None，则从模拟API获取）
            language: 语言设置
            db_type: 数据库类型
            llm_name: LLM模型名称
            llm: LLM实例（可选）
            embedding_name: 嵌入模型名称
            embedding: 嵌入模型实例（可选）
        """
        # 获取或生成Soul用户画像
        if soul_profile is None:
            soul_profile = get_soul_profile(user_id=user_id)
        
        self.user_id = user_id
        self.soul_profile = soul_profile
        self.is_user_agent = True  # 标记为用户Agent
        self.soulverse_mode = SoulverseMode(language=language)  # Soulverse模式
        
        # 从Soul画像生成Agent的profile
        agent_profile = self._generate_agent_profile_from_soul(soul_profile)
        
        # 创建临时角色信息文件
        role_info = self._create_role_info(role_code, agent_profile, soul_profile)
        
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
        
        # 设置长期目标（基于Soul画像）
        self.long_term_goals = soul_profile.get("long_term_goals", [])
        
        # 设置初始motivation（基于社交目标）
        if soul_profile.get("social_goals"):
            self.initial_social_goals = soul_profile["social_goals"]
        else:
            self.initial_social_goals = []
    
    def _generate_agent_profile_from_soul(self, soul_profile: Dict[str, Any]) -> str:
        """
        从Soul用户画像生成Agent的profile描述
        
        Args:
            soul_profile: Soul用户画像数据
        
        Returns:
            Agent的profile字符串
        """
        interests = ", ".join(soul_profile.get("interests", []))
        mbti = soul_profile.get("mbti", "未知")
        personality = soul_profile.get("personality", "")
        traits = ", ".join(soul_profile.get("traits", []))
        social_goals = ", ".join(soul_profile.get("social_goals", []))
        
        profile = f"""这是一个基于用户真实画像创建的AI Agent。

基本信息：
- MBTI类型：{mbti}
- 性格特征：{personality}
- 性格标签：{traits}

兴趣标签：{interests}

社交目标：{social_goals}

这个Agent在虚拟世界中会根据自己的兴趣和性格自主行动，寻找志同道合的朋友，建立真实的社交关系。"""
        
        return profile
    
    def _create_role_info(self, role_code: str, profile: str, soul_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建角色信息字典
        
        Args:
            role_code: 角色代码
            profile: Agent profile
            soul_profile: Soul用户画像
        
        Returns:
            角色信息字典
        """
        # 生成角色名称：默认展示完整用户ID，确保不会丢失首字母/单词
        base_name = (self.user_id or "").strip()
        if not base_name:
            base_name = role_code
        # 统一使用下划线替换空白，避免 UI 中首字符被隐藏
        sanitized_name = base_name.replace(" ", "_")
        if sanitized_name.startswith("用户_") or sanitized_name.startswith("用户"):
            role_name = sanitized_name
        else:
            role_name = f"用户_{sanitized_name}"
        nickname = role_name
        
        role_info = {
            "role_code": role_code,
            "role_name": role_name,
            "nickname": nickname,
            "original_user_id": self.user_id,
            "source": "soulverse_user",
            "activity": soul_profile.get("activity_level", 1.0),
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
        temp_dir = os.path.join(base_dir, "data", "roles", "soulverse_users", role_code)
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
    
    def get_soul_interests(self) -> List[str]:
        """获取Soul兴趣标签"""
        return self.soul_profile.get("interests", [])
    
    def get_soul_mbti(self) -> str:
        """获取MBTI类型"""
        return self.soul_profile.get("mbti", "未知")
    
    def get_social_goals(self) -> List[str]:
        """获取社交目标"""
        return self.soul_profile.get("social_goals", [])
    
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
    
    def update_motivation_with_social_goals(self, world_description: str, other_roles_info: Dict[str, Any]):
        """
        基于社交目标更新motivation
        
        Args:
            world_description: 世界描述
            other_roles_info: 其他角色信息
        """
        # 调用父类的set_motivation，但会考虑社交目标
        motivation = self.set_motivation(
            world_description=world_description,
            other_roles_info=other_roles_info,
            intervention=""
        )
        
        # 如果有社交目标，在motivation中强调
        if self.initial_social_goals:
            goals_text = "，".join(self.initial_social_goals)
            motivation = f"{motivation}\n\n特别关注：{goals_text}"
            self.motivation = motivation
        
        return motivation
