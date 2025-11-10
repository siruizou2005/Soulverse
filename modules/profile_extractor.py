"""
从用户文本（聊天记录、自述等）提取用户画像
使用LLM分析文本，提取兴趣、性格、MBTI等信息
"""
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from typing import Dict, List, Any, Optional
from sw_utils import get_models


class ProfileExtractor:
    """从文本提取用户画像的类"""
    
    def __init__(self, llm_name: str = "gpt-4o-mini", language: str = "zh"):
        """
        初始化ProfileExtractor
        
        Args:
            llm_name: LLM模型名称
            language: 语言设置
        """
        self.llm = get_models(llm_name)
        self.language = language
    
    def extract_profile_from_text(self, text: str) -> Dict[str, Any]:
        """
        从文本中提取用户画像
        
        Args:
            text: 用户提供的文本（聊天记录、自述等）
        
        Returns:
            用户画像字典，包含：
            - interests: 兴趣标签列表
            - mbti: MBTI类型
            - personality: 性格描述
            - traits: 性格特征列表
            - social_goals: 社交目标列表
            - long_term_goals: 长期目标列表
        """
        if self.language == "zh":
            prompt = self._get_chinese_prompt(text)
        else:
            prompt = self._get_english_prompt(text)
        
        try:
            response = self.llm.chat(prompt)
            profile = self._parse_response(response)
            return profile
        except Exception as e:
            print(f"Error extracting profile: {e}")
            # 返回默认画像
            return self._get_default_profile()
    
    def _get_chinese_prompt(self, text: str) -> str:
        """生成中文提示词"""
        return f"""请分析以下文本，提取用户的兴趣、性格特征、MBTI类型和社交目标。

文本内容：
{text}

请以JSON格式返回分析结果，格式如下：
{{
    "interests": ["兴趣1", "兴趣2", ...],  // 从文本中提取的兴趣标签，至少5个
    "mbti": "MBTI类型",  // 16种MBTI类型之一：INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP
    "personality": "性格描述",  // 一段描述用户性格的文字
    "traits": ["特征1", "特征2", ...],  // 性格特征标签列表
    "social_goals": ["目标1", "目标2", ...],  // 社交目标列表，如"寻找志同道合的朋友"、"寻找学习伙伴"等
    "long_term_goals": ["长期目标1", "长期目标2", ...]  // 长期目标列表
}}

注意：
1. 如果文本中没有明确信息，请根据文本的语气、用词、话题等进行合理推断
2. interests应该包含用户明显感兴趣的话题、活动、领域等
3. mbti需要根据用户的交流风格、思维方式、行为模式进行判断
4. social_goals应该基于用户的表达和需求推断
5. 只返回JSON，不要有其他文字说明"""
    
    def _get_english_prompt(self, text: str) -> str:
        """生成英文提示词"""
        return f"""Please analyze the following text and extract the user's interests, personality traits, MBTI type, and social goals.

Text content:
{text}

Please return the analysis results in JSON format as follows:
{{
    "interests": ["interest1", "interest2", ...],  // Extract at least 5 interest tags from the text
    "mbti": "MBTI_TYPE",  // One of 16 MBTI types: INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP
    "personality": "personality description",  // A paragraph describing the user's personality
    "traits": ["trait1", "trait2", ...],  // List of personality trait tags
    "social_goals": ["goal1", "goal2", ...],  // List of social goals, such as "find like-minded friends", "find study partners", etc.
    "long_term_goals": ["long_term_goal1", "long_term_goal2", ...]  // List of long-term goals
}}

Note:
1. If the text doesn't contain explicit information, make reasonable inferences based on the text's tone, word choice, topics, etc.
2. interests should include topics, activities, fields the user is clearly interested in
3. mbti needs to be determined based on the user's communication style, thinking patterns, and behavioral patterns
4. social_goals should be inferred based on the user's expressions and needs
5. Return only JSON, no other text explanations"""
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """解析LLM返回的JSON响应"""
        try:
            # 尝试提取JSON部分
            response = response.strip()
            # 如果响应包含```json或```，提取其中的内容
            if "```json" in response:
                start = response.find("```json") + 7
                end = response.find("```", start)
                if end != -1:
                    response = response[start:end].strip()
            elif "```" in response:
                start = response.find("```") + 3
                end = response.find("```", start)
                if end != -1:
                    response = response[start:end].strip()
            
            # 解析JSON
            profile = json.loads(response)
            
            # 验证和补充字段
            if "interests" not in profile or not profile["interests"]:
                profile["interests"] = ["阅读", "音乐", "旅行"]
            if "mbti" not in profile or not profile["mbti"]:
                profile["mbti"] = "INFP"
            if "personality" not in profile:
                profile["personality"] = "性格温和，待人友善"
            if "traits" not in profile or not profile["traits"]:
                profile["traits"] = ["友好", "开放"]
            if "social_goals" not in profile or not profile["social_goals"]:
                profile["social_goals"] = ["寻找志同道合的朋友"]
            if "long_term_goals" not in profile or not profile["long_term_goals"]:
                profile["long_term_goals"] = ["在虚拟世界中找到志同道合的朋友"]
            
            return profile
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Response was: {response}")
            return self._get_default_profile()
    
    def _get_default_profile(self) -> Dict[str, Any]:
        """返回默认用户画像"""
        return {
            "interests": ["阅读", "音乐", "旅行", "电影", "科技"],
            "mbti": "INFP",
            "personality": "性格温和，待人友善，喜欢探索新事物",
            "traits": ["友好", "开放", "好奇"],
            "social_goals": ["寻找志同道合的朋友"],
            "long_term_goals": ["在虚拟世界中找到志同道合的朋友"]
        }
    
    def extract_profile_from_qa(self, answers: Dict[str, str]) -> Dict[str, Any]:
        """
        从问答结果提取用户画像
        
        Args:
            answers: 问答字典，例如：
                {
                    "interests": "我喜欢看电影、听音乐、旅行",
                    "personality": "我比较内向，喜欢独处，但也喜欢和志同道合的人交流",
                    "social_goals": "我想找到一起看电影的朋友"
                }
        
        Returns:
            用户画像字典
        """
        # 将问答结果组合成文本
        text = "\n".join([f"{key}: {value}" for key, value in answers.items()])
        return self.extract_profile_from_text(text)


def extract_profile_from_text(text: str, llm_name: str = "gpt-4o-mini", language: str = "zh") -> Dict[str, Any]:
    """
    从文本提取用户画像的便捷函数
    
    Args:
        text: 用户提供的文本
        llm_name: LLM模型名称
        language: 语言设置
    
    Returns:
        用户画像字典
    """
    extractor = ProfileExtractor(llm_name=llm_name, language=language)
    return extractor.extract_profile_from_text(text)


def extract_profile_from_qa(answers: Dict[str, str], llm_name: str = "gpt-4o-mini", language: str = "zh") -> Dict[str, Any]:
    """
    从问答结果提取用户画像的便捷函数
    
    Args:
        answers: 问答字典
        llm_name: LLM模型名称
        language: 语言设置
    
    Returns:
        用户画像字典
    """
    extractor = ProfileExtractor(llm_name=llm_name, language=language)
    return extractor.extract_profile_from_qa(answers)

