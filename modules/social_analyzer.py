"""
社交分析器
分析Agent的社交行为特点，计算投缘度等指标
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from modules.history_manager import HistoryManager
from sw_utils import get_models
import json


class SocialAnalyzer:
    """
    社交分析器
    分析Agent的社交行为特点，计算投缘度等指标
    """
    
    def __init__(self, history_manager: HistoryManager, language: str = "zh", llm_name: str = "gpt-4o-mini"):
        """
        初始化社交分析器
        
        Args:
            history_manager: 历史管理器
            language: 语言设置
            llm_name: LLM模型名称（用于AI分析）
        """
        self.history_manager = history_manager
        self.language = language
        self.llm = get_models(llm_name) if llm_name else None
    
    def analyze_agent_behavior(self, 
                               agent_code: str,
                               agent_profile: Dict[str, Any],
                               start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        分析Agent的社交行为特点
        
        Args:
            agent_code: Agent代码
            agent_profile: Agent的profile信息（包含兴趣、MBTI、性格等）
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            行为分析结果
        """
        # 获取相关记录
        records = self._filter_records(agent_code, start_time, end_time)
        
        # 计算基础统计
        stats = self._calculate_behavior_stats(records, agent_code)
        
        # 分析互动模式
        interaction_patterns = self._analyze_interaction_patterns(records, agent_code)
        
        # 分析位置偏好
        location_preferences = self._analyze_location_preferences(records, agent_code)
        
        # 分析时间段活跃度
        time_activity = self._analyze_time_activity(records, agent_code)
        
        # 使用AI生成行为特点分析
        behavior_insights = self._generate_behavior_insights(
            agent_code, 
            agent_profile, 
            stats, 
            interaction_patterns, 
            location_preferences,
            records
        )
        
        return {
            "agent_code": agent_code,
            "stats": stats,
            "interaction_patterns": interaction_patterns,
            "location_preferences": location_preferences,
            "time_activity": time_activity,
            "behavior_insights": behavior_insights
        }
    
    def calculate_compatibility(self,
                               agent1_code: str,
                               agent1_profile: Dict[str, Any],
                               agent2_code: str,
                               agent2_profile: Dict[str, Any],
                               interaction_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        计算两个Agent之间的投缘度
        
        Args:
            agent1_code: 第一个Agent的代码
            agent1_profile: 第一个Agent的profile
            agent2_code: 第二个Agent的代码
            agent2_profile: 第二个Agent的profile
            interaction_history: 互动历史记录
        
        Returns:
            投缘度分析结果
        """
        compatibility_scores = {}
        
        # 1. 兴趣相似度
        interests_score = self._calculate_interests_similarity(
            agent1_profile.get("interests", []),
            agent2_profile.get("interests", [])
        )
        compatibility_scores["interests"] = interests_score
        
        # 2. MBTI兼容度
        mbti_score = self._calculate_mbti_compatibility(
            agent1_profile.get("mbti", ""),
            agent2_profile.get("mbti", "")
        )
        compatibility_scores["mbti"] = mbti_score
        
        # 3. 互动频率和深度
        interaction_score = self._calculate_interaction_score(
            agent1_code, 
            agent2_code, 
            interaction_history
        )
        compatibility_scores["interaction"] = interaction_score
        
        # 4. 社交目标匹配度
        goals_score = self._calculate_goals_match(
            agent1_profile.get("social_goals", []),
            agent2_profile.get("social_goals", [])
        )
        compatibility_scores["goals"] = goals_score
        
        # 5. 综合投缘度（加权平均）
        overall_compatibility = (
            interests_score * 0.3 +
            mbti_score * 0.2 +
            interaction_score * 0.3 +
            goals_score * 0.2
        )
        
        # 生成投缘度描述
        compatibility_desc = self._generate_compatibility_description(
            overall_compatibility,
            compatibility_scores,
            agent1_profile,
            agent2_profile
        )
        
        return {
            "agent1_code": agent1_code,
            "agent2_code": agent2_code,
            "overall_compatibility": round(overall_compatibility, 2),
            "scores": compatibility_scores,
            "description": compatibility_desc
        }
    
    def _filter_records(self,
                       agent_code: str,
                       start_time: Optional[datetime] = None,
                       end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """筛选相关记录"""
        records = []
        
        for record in self.history_manager.detailed_history:
            # 检查时间范围
            if start_time or end_time:
                if "virtual_timestamp" in record:
                    record_time = datetime.fromtimestamp(record["virtual_timestamp"])
                    if start_time and record_time < start_time:
                        continue
                    if end_time and record_time > end_time:
                        continue
            
            # 检查是否与Agent相关
            if (record.get("role_code") == agent_code or 
                agent_code in record.get("group", []) or
                record.get("actor") == agent_code):
                records.append(record)
        
        return records
    
    def _calculate_behavior_stats(self, records: List[Dict[str, Any]], agent_code: str) -> Dict[str, Any]:
        """计算行为统计"""
        stats = {
            "total_interactions": 0,
            "total_movements": 0,
            "initiated_interactions": 0,
            "received_interactions": 0,
            "unique_contacts": set(),
            "average_interaction_length": 0,
            "most_active_location": None,
            "interaction_topics": {}
        }
        
        location_count = {}
        interaction_lengths = []
        
        # 排除的记录类型（这些不应该被统计为互动或移动）
        excluded_types = ["user_input_placeholder", "user_input", "goal setting", "plan", "npc", "enviroment"]
        
        for record in records:
            act_type = record.get("act_type", record.get("type", ""))
            
            # 跳过排除的类型
            if act_type in excluded_types:
                continue
            
            if act_type in ["single", "multi"]:
                stats["total_interactions"] += 1
                group = record.get("group", [])
                
                # 判断是否主动发起（检查role_code或actor字段）
                record_role_code = record.get("role_code")
                record_actor = record.get("actor")
                if record_role_code == agent_code or record_actor == agent_code:
                    stats["initiated_interactions"] += 1
                else:
                    stats["received_interactions"] += 1
                
                # 记录互动对象（确保group不为空且member有效）
                if group:
                    for member in group:
                        if member and member != agent_code:  # 确保member不为空且不是自己
                            stats["unique_contacts"].add(member)
                
                # 估算互动长度（基于detail长度）
                detail = record.get("detail", "")
                if detail and detail != "__USER_INPUT_PLACEHOLDER__":  # 排除占位符
                    interaction_lengths.append(len(detail))
            
            elif act_type == "move":
                stats["total_movements"] += 1
                detail = record.get("detail", "")
                if detail:
                    # 尝试从detail中提取位置名称
                    if "到" in detail:
                        location = detail.split("到")[-1].strip()
                    elif "位于" in detail:
                        location = detail.split("位于")[-1].strip()
                    else:
                        location = detail.strip()
                    if location:
                        location_count[location] = location_count.get(location, 0) + 1
        
        # 计算平均值
        if interaction_lengths:
            stats["average_interaction_length"] = sum(interaction_lengths) / len(interaction_lengths)
        
        # 找出最活跃的位置
        if location_count:
            stats["most_active_location"] = max(location_count.items(), key=lambda x: x[1])[0]
        
        stats["unique_contacts_count"] = len(stats["unique_contacts"])
        stats["unique_contacts"] = list(stats["unique_contacts"])
        
        return stats
    
    def _analyze_interaction_patterns(self, records: List[Dict[str, Any]], agent_code: str) -> Dict[str, Any]:
        """分析互动模式"""
        patterns = {
            "prefers_group": 0,
            "prefers_one_on_one": 0,
            "initiation_rate": 0.0,
            "response_rate": 0.0
        }
        
        total_interactions = 0
        initiated = 0
        group_interactions = 0
        one_on_one = 0
        
        # 排除的记录类型
        excluded_types = ["user_input_placeholder", "user_input", "goal setting", "plan", "npc", "enviroment"]
        
        for record in records:
            act_type = record.get("act_type", record.get("type", ""))
            
            # 跳过排除的类型
            if act_type in excluded_types:
                continue
            
            if act_type in ["single", "multi"]:
                total_interactions += 1
                group = record.get("group", [])
                
                # 计算群体互动和一对一互动
                if group and len(group) > 2:
                    group_interactions += 1
                elif group and len(group) == 2:
                    one_on_one += 1
                else:
                    # 如果没有group信息，默认算作一对一
                    one_on_one += 1
                
                # 判断是否主动发起
                record_role_code = record.get("role_code")
                record_actor = record.get("actor")
                if record_role_code == agent_code or record_actor == agent_code:
                    initiated += 1
        
        if total_interactions > 0:
            patterns["prefers_group"] = group_interactions / total_interactions
            patterns["prefers_one_on_one"] = one_on_one / total_interactions
            patterns["initiation_rate"] = initiated / total_interactions
        
        return patterns
    
    def _analyze_location_preferences(self, records: List[Dict[str, Any]], agent_code: str) -> Dict[str, int]:
        """分析位置偏好"""
        location_count = {}
        
        for record in records:
            act_type = record.get("act_type", record.get("type", ""))
            
            # 只处理移动类型的记录
            if act_type == "move":
                detail = record.get("detail", "")
                if detail:
                    # 尝试从detail中提取位置名称
                    if "到" in detail:
                        location = detail.split("到")[-1].strip()
                    elif "位于" in detail:
                        location = detail.split("位于")[-1].strip()
                    else:
                        location = detail.strip()
                    if location:
                        location_count[location] = location_count.get(location, 0) + 1
        
        return location_count
    
    def _analyze_time_activity(self, records: List[Dict[str, Any]], agent_code: str) -> Dict[str, int]:
        """分析时间段活跃度"""
        time_slots = {
            "morning": 0,    # 6-12
            "afternoon": 0,  # 12-18
            "evening": 0,    # 18-24
            "night": 0       # 0-6
        }
        
        for record in records:
            if "virtual_timestamp" in record:
                record_time = datetime.fromtimestamp(record["virtual_timestamp"])
                hour = record_time.hour
                
                if 6 <= hour < 12:
                    time_slots["morning"] += 1
                elif 12 <= hour < 18:
                    time_slots["afternoon"] += 1
                elif 18 <= hour < 24:
                    time_slots["evening"] += 1
                else:
                    time_slots["night"] += 1
        
        return time_slots
    
    def _generate_behavior_insights(self,
                                   agent_code: str,
                                   agent_profile: Dict[str, Any],
                                   stats: Dict[str, Any],
                                   patterns: Dict[str, Any],
                                   locations: Dict[str, int],
                                   records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """使用AI生成行为特点分析"""
        if not self.llm:
            # 如果没有LLM，返回基础分析
            return self._generate_basic_insights(stats, patterns, locations)
        
        try:
            # 构建分析提示
            profile_summary = f"""
            Agent信息：
            - 兴趣：{', '.join(agent_profile.get('interests', []))}
            - MBTI：{agent_profile.get('mbti', '未知')}
            - 性格：{agent_profile.get('personality', '未知')}
            - 社交目标：{', '.join(agent_profile.get('social_goals', []))}
            """
            
            behavior_summary = f"""
            行为统计：
            - 总互动次数：{stats.get('total_interactions', 0)}
            - 发起互动：{stats.get('initiated_interactions', 0)}
            - 接收互动：{stats.get('received_interactions', 0)}
            - 接触的Agent数量：{stats.get('unique_contacts_count', 0)}
            - 移动次数：{stats.get('total_movements', 0)}
            - 最活跃位置：{stats.get('most_active_location', '未知')}
            
            互动模式：
            - 群体互动偏好：{patterns.get('prefers_group', 0):.1%}
            - 一对一互动偏好：{patterns.get('prefers_one_on_one', 0):.1%}
            - 主动发起率：{patterns.get('initiation_rate', 0):.1%}
            """
            
            prompt = f"""基于以下Agent的profile和行为数据，生成一份详细的社交行为特点分析报告。

{profile_summary}

{behavior_summary}

请用中文生成分析报告，包括：
1. 社交活跃度评估
2. 互动风格特点（主动/被动，群体/一对一偏好）
3. 位置偏好分析
4. 社交目标达成情况
5. 个性特点在社交中的体现

要求：分析要深入、客观，字数在200-300字左右。"""
            
            response = self.llm.chat(prompt)
            
            # 解析响应
            insights = {
                "analysis": response.strip(),
                "social_activity_level": self._assess_activity_level(stats),
                "interaction_style": self._assess_interaction_style(patterns),
                "location_preference": max(locations.items(), key=lambda x: x[1])[0] if locations else "无数据"
            }
            
            return insights
            
        except Exception as e:
            print(f"Error generating behavior insights: {e}")
            return self._generate_basic_insights(stats, patterns, locations)
    
    def _generate_basic_insights(self, stats: Dict[str, Any], patterns: Dict[str, Any], locations: Dict[str, int]) -> Dict[str, Any]:
        """生成基础分析（不使用LLM）"""
        activity_level = self._assess_activity_level(stats)
        interaction_style = self._assess_interaction_style(patterns)
        
        analysis = f"该Agent共进行了{stats.get('total_interactions', 0)}次社交互动，"
        analysis += f"接触了{stats.get('unique_contacts_count', 0)}位不同的Agent。"
        
        if patterns.get('initiation_rate', 0) > 0.6:
            analysis += "倾向于主动发起社交互动，"
        elif patterns.get('initiation_rate', 0) < 0.4:
            analysis += "更倾向于被动接受社交互动，"
        else:
            analysis += "在主动和被动社交之间保持平衡，"
        
        if patterns.get('prefers_group', 0) > 0.6:
            analysis += "偏好群体社交。"
        elif patterns.get('prefers_one_on_one', 0) > 0.6:
            analysis += "偏好一对一深度交流。"
        else:
            analysis += "在不同规模的社交场景中都能适应。"
        
        return {
            "analysis": analysis,
            "social_activity_level": activity_level,
            "interaction_style": interaction_style,
            "location_preference": max(locations.items(), key=lambda x: x[1])[0] if locations else "无数据"
        }
    
    def _assess_activity_level(self, stats: Dict[str, Any]) -> str:
        """评估社交活跃度"""
        total = stats.get('total_interactions', 0)
        if total > 10:
            return "非常活跃"
        elif total > 5:
            return "活跃"
        elif total > 2:
            return "中等"
        else:
            return "较低"
    
    def _assess_interaction_style(self, patterns: Dict[str, Any]) -> str:
        """评估互动风格"""
        initiation_rate = patterns.get('initiation_rate', 0.5)
        group_pref = patterns.get('prefers_group', 0.5)
        
        if initiation_rate > 0.7 and group_pref > 0.6:
            return "主动外向型"
        elif initiation_rate > 0.7 and group_pref < 0.4:
            return "主动深度型"
        elif initiation_rate < 0.3 and group_pref > 0.6:
            return "被动社交型"
        elif initiation_rate < 0.3 and group_pref < 0.4:
            return "被动内敛型"
        else:
            return "平衡型"
    
    def _calculate_interests_similarity(self, interests1: List[str], interests2: List[str]) -> float:
        """计算兴趣相似度"""
        if not interests1 or not interests2:
            return 0.5  # 默认中等相似度
        
        set1 = set(interests1)
        set2 = set(interests2)
        
        if not set1 or not set2:
            return 0.5
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def _calculate_mbti_compatibility(self, mbti1: str, mbti2: str) -> float:
        """计算MBTI兼容度"""
        if not mbti1 or not mbti2:
            return 0.5
        
        # 简化的MBTI兼容度计算
        # 相同类型：0.9
        # 相同维度（E/I, S/N, T/F, J/P）相同：0.7
        # 互补类型：0.8
        # 其他：0.5
        
        if mbti1 == mbti2:
            return 0.9
        
        # 检查相同维度
        same_dimensions = sum(1 for i in range(min(len(mbti1), len(mbti2))) if mbti1[i] == mbti2[i])
        
        if same_dimensions >= 3:
            return 0.7
        elif same_dimensions >= 2:
            return 0.6
        else:
            return 0.5
    
    def _calculate_interaction_score(self,
                                    agent1_code: str,
                                    agent2_code: str,
                                    interaction_history: List[Dict[str, Any]]) -> float:
        """计算互动分数"""
        interaction_count = 0
        total_interactions = 0
        
        for record in interaction_history:
            if record.get("act_type") in ["single", "multi"]:
                total_interactions += 1
                group = record.get("group", [])
                if agent1_code in group and agent2_code in group:
                    interaction_count += 1
        
        if total_interactions == 0:
            return 0.5  # 默认中等分数
        
        # 互动频率分数（0-1）
        frequency_score = min(interaction_count / max(total_interactions, 1), 1.0)
        
        return frequency_score
    
    def _calculate_goals_match(self, goals1: List[str], goals2: List[str]) -> float:
        """计算社交目标匹配度"""
        if not goals1 or not goals2:
            return 0.5
        
        set1 = set(goals1)
        set2 = set(goals2)
        
        if not set1 or not set2:
            return 0.5
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def _generate_compatibility_description(self,
                                          overall_compatibility: float,
                                          scores: Dict[str, float],
                                          agent1_profile: Dict[str, Any],
                                          agent2_profile: Dict[str, Any]) -> str:
        """生成投缘度描述"""
        if overall_compatibility >= 0.8:
            level = "非常投缘"
            desc = "两人兴趣高度重合，性格互补，互动频繁，是非常理想的社交伙伴。"
        elif overall_compatibility >= 0.6:
            level = "较为投缘"
            desc = "两人在多个方面有共同点，能够建立良好的社交关系。"
        elif overall_compatibility >= 0.4:
            level = "一般投缘"
            desc = "两人在某些方面有共同点，但需要更多时间深入了解。"
        else:
            level = "不太投缘"
            desc = "两人在兴趣、性格等方面差异较大，可能不太容易建立深入联系。"
        
        return f"{level} ({overall_compatibility:.0%})。{desc}"
