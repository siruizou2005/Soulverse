// MBTI类型数据
export const MBTI_TYPES = [
    { code: 'INTJ', name: '建筑师', desc: '独立、理性、有远见的战略家', icon: '🏗️', color: '#6366f1' },
    { code: 'INTP', name: '逻辑学家', desc: '好奇、逻辑、创新的思想家', icon: '🔬', color: '#8b5cf6' },
    { code: 'ENTJ', name: '指挥官', desc: '果断、自信、有领导力的指挥官', icon: '👑', color: '#ec4899' },
    { code: 'ENTP', name: '辩论家', desc: '聪明、创新、喜欢挑战传统', icon: '💡', color: '#f59e0b' },
    { code: 'INFJ', name: '提倡者', desc: '理想主义、有洞察力、富有同理心', icon: '🌟', color: '#10b981' },
    { code: 'INFP', name: '调停者', desc: '理想主义、忠诚、富有创造力', icon: '🎨', color: '#3b82f6' },
    { code: 'ENFJ', name: '主人公', desc: '热情、有魅力、天生的领导者', icon: '🎭', color: '#ef4444' },
    { code: 'ENFP', name: '竞选者', desc: '热情、自由、富有创造力的活动家', icon: '🎪', color: '#f97316' },
    { code: 'ISTJ', name: '物流师', desc: '实际、可靠、有责任感的检查员', icon: '📋', color: '#64748b' },
    { code: 'ISFJ', name: '守卫者', desc: '温暖、负责、保护性的守护者', icon: '🛡️', color: '#06b6d4' },
    { code: 'ESTJ', name: '总经理', desc: '务实、果断、有组织能力的执行官', icon: '💼', color: '#14b8a6' },
    { code: 'ESFJ', name: '执政官', desc: '外向、友好、关心他人的执政官', icon: '🤝', color: '#a855f7' },
    { code: 'ISTP', name: '鉴赏家', desc: '大胆、实用、实验性的冒险家', icon: '🔧', color: '#84cc16' },
    { code: 'ISFP', name: '探险家', desc: '灵活、迷人、艺术性的探险家', icon: '🎯', color: '#eab308' },
    { code: 'ESTP', name: '企业家', desc: '聪明、精力充沛、感知力强', icon: '🚀', color: '#f43f5e' },
    { code: 'ESFP', name: '表演者', desc: '自发的、精力充沛的、热情的表演者', icon: '🎬', color: '#fb923c' }
];

// MBTI问卷题目（20题，参考16Personalities）
export const MBTI_QUESTIONS = [
    {
        id: 1, text: "在聚会中，你更倾向于：", options: [
            { text: "与很多人交流，认识新朋友", value: "E" },
            { text: "与几个熟悉的朋友深入交谈", value: "I" }
        ]
    },
    {
        id: 2, text: "你更倾向于：", options: [
            { text: "先行动，再思考", value: "S" },
            { text: "先思考，再行动", value: "N" }
        ]
    },
    {
        id: 3, text: "做决定时，你更依赖：", options: [
            { text: "逻辑和分析", value: "T" },
            { text: "价值观和感受", value: "F" }
        ]
    },
    {
        id: 4, text: "你更喜欢：", options: [
            { text: "有计划的、有序的生活", value: "J" },
            { text: "灵活的、随性的生活", value: "P" }
        ]
    },
    {
        id: 5, text: "面对新环境，你：", options: [
            { text: "很快适应，感到兴奋", value: "E" },
            { text: "需要时间适应，感到紧张", value: "I" }
        ]
    },
    {
        id: 6, text: "你更关注：", options: [
            { text: "具体的事实和细节", value: "S" },
            { text: "可能性和整体概念", value: "N" }
        ]
    },
    {
        id: 7, text: "在争论中，你更重视：", options: [
            { text: "客观真理和正确性", value: "T" },
            { text: "和谐和人际关系", value: "F" }
        ]
    },
    {
        id: 8, text: "你更喜欢：", options: [
            { text: "提前完成工作", value: "J" },
            { text: "在截止日期前完成", value: "P" }
        ]
    },
    {
        id: 9, text: "社交活动后，你：", options: [
            { text: "感到精力充沛", value: "E" },
            { text: "感到疲惫，需要独处", value: "I" }
        ]
    },
    {
        id: 10, text: "你更倾向于：", options: [
            { text: "关注现实和实际", value: "S" },
            { text: "关注未来和可能性", value: "N" }
        ]
    },
    {
        id: 11, text: "做决定时，你更看重：", options: [
            { text: "公平和一致性", value: "T" },
            { text: "个人价值观和特殊情况", value: "F" }
        ]
    },
    {
        id: 12, text: "你更喜欢：", options: [
            { text: "有明确的结构和计划", value: "J" },
            { text: "保持开放和灵活", value: "P" }
        ]
    },
    {
        id: 13, text: "在团队中，你：", options: [
            { text: "主动发言，分享想法", value: "E" },
            { text: "先倾听，再表达", value: "I" }
        ]
    },
    {
        id: 14, text: "你更相信：", options: [
            { text: "经验和传统", value: "S" },
            { text: "创新和新方法", value: "N" }
        ]
    },
    {
        id: 15, text: "面对冲突，你：", options: [
            { text: "直接面对，寻求解决方案", value: "T" },
            { text: "考虑他人感受，寻求妥协", value: "F" }
        ]
    },
    {
        id: 16, text: "你更喜欢：", options: [
            { text: "完成后再开始新任务", value: "J" },
            { text: "同时处理多个任务", value: "P" }
        ]
    },
    {
        id: 17, text: "你的能量来源主要是：", options: [
            { text: "与他人互动", value: "E" },
            { text: "独处和反思", value: "I" }
        ]
    },
    {
        id: 18, text: "你更关注：", options: [
            { text: "现在正在发生的事情", value: "S" },
            { text: "未来可能发生的事情", value: "N" }
        ]
    },
    {
        id: 19, text: "评价事物时，你更看重：", options: [
            { text: "逻辑性和效率", value: "T" },
            { text: "情感价值和意义", value: "F" }
        ]
    },
    {
        id: 20, text: "你更喜欢：", options: [
            { text: "有明确的规则和程序", value: "J" },
            { text: "自由和自发性", value: "P" }
        ]
    }
];

// 核心层问卷题目（20题）
export const CORE_QUESTIONS = [
    {
        id: 1, text: "你有多愿意尝试新事物？", dimension: "openness", options: [
            { text: "非常愿意，我喜欢探索", value: 0.9 },
            { text: "比较愿意", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太愿意", value: 0.3 },
            { text: "很不愿意，我更喜欢熟悉的事物", value: 0.1 }
        ]
    },
    {
        id: 2, text: "你做事有多有条理？", dimension: "conscientiousness", options: [
            { text: "非常有条理，我计划一切", value: 0.9 },
            { text: "比较有条理", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太有条理", value: 0.3 },
            { text: "很随意，很少计划", value: 0.1 }
        ]
    },
    {
        id: 3, text: "你在社交场合有多活跃？", dimension: "extraversion", options: [
            { text: "非常活跃，我是焦点", value: 0.9 },
            { text: "比较活跃", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太活跃", value: 0.3 },
            { text: "很安静，喜欢观察", value: 0.1 }
        ]
    },
    {
        id: 4, text: "你有多信任他人？", dimension: "agreeableness", options: [
            { text: "非常信任，我相信人性本善", value: 0.9 },
            { text: "比较信任", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太信任", value: 0.3 },
            { text: "很不信任，我比较谨慎", value: 0.1 }
        ]
    },
    {
        id: 5, text: "你有多容易感到焦虑？", dimension: "neuroticism", options: [
            { text: "很少焦虑，我很平静", value: 0.1 },
            { text: "偶尔焦虑", value: 0.3 },
            { text: "有时焦虑", value: 0.5 },
            { text: "经常焦虑", value: 0.7 },
            { text: "总是焦虑，我很容易担心", value: 0.9 }
        ]
    },
    {
        id: 6, text: "你对艺术和美的敏感度？", dimension: "openness", options: [
            { text: "非常敏感，我热爱艺术", value: 0.9 },
            { text: "比较敏感", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太敏感", value: 0.3 },
            { text: "不敏感，我更关注实用", value: 0.1 }
        ]
    },
    {
        id: 7, text: "你完成任务的可靠性？", dimension: "conscientiousness", options: [
            { text: "非常可靠，我总是按时完成", value: 0.9 },
            { text: "比较可靠", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太可靠", value: 0.3 },
            { text: "不可靠，我经常拖延", value: 0.1 }
        ]
    },
    {
        id: 8, text: "你在人群中感到舒适吗？", dimension: "extraversion", options: [
            { text: "非常舒适，我享受人群", value: 0.9 },
            { text: "比较舒适", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太舒适", value: 0.3 },
            { text: "很不舒适，我更喜欢小群体", value: 0.1 }
        ]
    },
    {
        id: 9, text: "你有多愿意帮助他人？", dimension: "agreeableness", options: [
            { text: "非常愿意，我乐于助人", value: 0.9 },
            { text: "比较愿意", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太愿意", value: 0.3 },
            { text: "不愿意，我更关注自己", value: 0.1 }
        ]
    },
    {
        id: 10, text: "你处理压力的能力？", dimension: "neuroticism", options: [
            { text: "很强，我很少被压力影响", value: 0.1 },
            { text: "比较强", value: 0.3 },
            { text: "一般", value: 0.5 },
            { text: "比较弱", value: 0.7 },
            { text: "很弱，压力让我很困扰", value: 0.9 }
        ]
    },
    {
        id: 11, text: "你对抽象概念的兴趣？", dimension: "openness", options: [
            { text: "非常感兴趣，我热爱思考", value: 0.9 },
            { text: "比较感兴趣", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太感兴趣", value: 0.3 },
            { text: "不感兴趣，我更喜欢具体事物", value: 0.1 }
        ]
    },
    {
        id: 12, text: "你的组织能力？", dimension: "conscientiousness", options: [
            { text: "非常强，我很有条理", value: 0.9 },
            { text: "比较强", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "比较弱", value: 0.3 },
            { text: "很弱，我比较混乱", value: 0.1 }
        ]
    },
    {
        id: 13, text: "你主动发起对话的频率？", dimension: "extraversion", options: [
            { text: "经常，我总是主动", value: 0.9 },
            { text: "比较经常", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太经常", value: 0.3 },
            { text: "很少，我通常等待他人", value: 0.1 }
        ]
    },
    {
        id: 14, text: "你对他人感受的敏感度？", dimension: "agreeableness", options: [
            { text: "非常敏感，我能察觉细微变化", value: 0.9 },
            { text: "比较敏感", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太敏感", value: 0.3 },
            { text: "不敏感，我更关注事实", value: 0.1 }
        ]
    },
    {
        id: 15, text: "你的情绪稳定性？", dimension: "neuroticism", options: [
            { text: "非常稳定，我很少波动", value: 0.1 },
            { text: "比较稳定", value: 0.3 },
            { text: "一般", value: 0.5 },
            { text: "不太稳定", value: 0.7 },
            { text: "很不稳定，我情绪波动大", value: 0.9 }
        ]
    },
    {
        id: 16, text: "你对新想法的接受度？", dimension: "openness", options: [
            { text: "非常高，我欢迎新想法", value: 0.9 },
            { text: "比较高", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "比较低", value: 0.3 },
            { text: "很低，我更喜欢传统", value: 0.1 }
        ]
    },
    {
        id: 17, text: "你的自律能力？", dimension: "conscientiousness", options: [
            { text: "非常强，我很有自制力", value: 0.9 },
            { text: "比较强", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "比较弱", value: 0.3 },
            { text: "很弱，我容易分心", value: 0.1 }
        ]
    },
    {
        id: 18, text: "你在社交中的主导性？", dimension: "extraversion", options: [
            { text: "非常主导，我经常领导", value: 0.9 },
            { text: "比较主导", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太主导", value: 0.3 },
            { text: "很少主导，我更喜欢跟随", value: 0.1 }
        ]
    },
    {
        id: 19, text: "你的合作意愿？", dimension: "agreeableness", options: [
            { text: "非常愿意，我热爱合作", value: 0.9 },
            { text: "比较愿意", value: 0.7 },
            { text: "一般", value: 0.5 },
            { text: "不太愿意", value: 0.3 },
            { text: "不愿意，我更喜欢独立", value: 0.1 }
        ]
    },
    {
        id: 20, text: "你应对挫折的能力？", dimension: "neuroticism", options: [
            { text: "很强，我很快恢复", value: 0.1 },
            { text: "比较强", value: 0.3 },
            { text: "一般", value: 0.5 },
            { text: "比较弱", value: 0.7 },
            { text: "很弱，挫折让我很沮丧", value: 0.9 }
        ]
    }
];
