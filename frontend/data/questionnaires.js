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

const LIKERT_OPTIONS = [
    { text: "非常不同意", value: 1 },
    { text: "不同意", value: 2 },
    { text: "中立", value: 3 },
    { text: "同意", value: 4 },
    { text: "非常同意", value: 5 }
];

// MBTI问卷题目（20题，5点量表）
export const MBTI_QUESTIONS = [
    // E vs I (5 items)
    {
        id: "MBTI_EI_1", text: "在社交活动中，我通常会主动介绍自己。",
        dimension: "EI", direction: 1, // 5=E
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_EI_2", text: "我喜欢成为注意力的焦点。",
        dimension: "EI", direction: 1, // 5=E
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_EI_3", text: "我倾向于先思考，然后再说话。",
        dimension: "EI", direction: -1, // 5=I
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_EI_4", text: "在长时间的社交后，我感到精力充沛。",
        dimension: "EI", direction: 1, // 5=E
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_EI_5", text: "我更喜欢一个人安静地度过周末。",
        dimension: "EI", direction: -1, // 5=I
        options: LIKERT_OPTIONS
    },

    // S vs N (5 items)
    {
        id: "MBTI_SN_1", text: "我更关注现实中的具体细节，而不是抽象的理论。",
        dimension: "SN", direction: -1, // 5=S (Low N) -> Wait, let's standardize. Let's say 5=N, 1=S. So this is -1.
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_SN_2", text: "我经常思考人类存在的意义和未来。",
        dimension: "SN", direction: 1, // 5=N
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_SN_3", text: "我更相信经过验证的经验，而不是未经测试的新方法。",
        dimension: "SN", direction: -1, // 5=S
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_SN_4", text: "我喜欢通过隐喻和类比来表达想法。",
        dimension: "SN", direction: 1, // 5=N
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_SN_5", text: "我更擅长处理实际操作的任务。",
        dimension: "SN", direction: -1, // 5=S
        options: LIKERT_OPTIONS
    },

    // T vs F (5 items)
    {
        id: "MBTI_TF_1", text: "做决定时，逻辑分析比个人感受更重要。",
        dimension: "TF", direction: -1, // Let's say 5=F, 1=T. So this is -1.
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_TF_2", text: "我很容易察觉到他人的情绪变化。",
        dimension: "TF", direction: 1, // 5=F
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_TF_3", text: "在争论中，我认为赢得真理比维护和谐更重要。",
        dimension: "TF", direction: -1, // 5=T
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_TF_4", text: "我经常被描述为是一个热情和富有同情心的人。",
        dimension: "TF", direction: 1, // 5=F
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_TF_5", text: "我认为客观和公正是最重要的原则。",
        dimension: "TF", direction: -1, // 5=T
        options: LIKERT_OPTIONS
    },

    // J vs P (5 items)
    {
        id: "MBTI_JP_1", text: "我喜欢做事有详细的计划和时间表。",
        dimension: "JP", direction: -1, // Let's say 5=P, 1=J. So this is -1.
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_JP_2", text: "我喜欢保持选择的开放性，不喜欢过早做决定。",
        dimension: "JP", direction: 1, // 5=P
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_JP_3", text: "我通常在截止日期前的最后一刻才开始工作。",
        dimension: "JP", direction: 1, // 5=P
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_JP_4", text: "看到东西没有放回原处会让我感到不舒服。",
        dimension: "JP", direction: -1, // 5=J
        options: LIKERT_OPTIONS
    },
    {
        id: "MBTI_JP_5", text: "我喜欢按部就班地完成任务清单。",
        dimension: "JP", direction: -1, // 5=J
        options: LIKERT_OPTIONS
    }
];

// 核心层问卷题目（50题，Big Five）
export const CORE_QUESTIONS = [
    // Openness (10 items)
    { id: "BF_O_1", text: "我拥有丰富的想象力。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_O_2", text: "我对抽象的概念不感兴趣。", dimension: "openness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_O_3", text: "我经常尝试新的食物或去新的地方。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_O_4", text: "我认为艺术和美是非常重要的。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_O_5", text: "我倾向于坚持传统的做事方式。", dimension: "openness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_O_6", text: "我喜欢思考哲学问题。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_O_7", text: "我很难理解隐喻性的语言。", dimension: "openness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_O_8", text: "我充满好奇心，喜欢学习新事物。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_O_9", text: "我更喜欢熟悉的环境，而不是未知的挑战。", dimension: "openness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_O_10", text: "我经常沉浸在自己的幻想世界中。", dimension: "openness", direction: 1, options: LIKERT_OPTIONS },

    // Conscientiousness (10 items)
    { id: "BF_C_1", text: "我做事总是准备充分。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_C_2", text: "我经常把东西乱放。", dimension: "conscientiousness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_C_3", text: "我注重细节。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_C_4", text: "我经常拖延任务。", dimension: "conscientiousness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_C_5", text: "我严格遵守时间表。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_C_6", text: "我做事有时会半途而废。", dimension: "conscientiousness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_C_7", text: "我喜欢秩序和整洁。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_C_8", text: "我在做决定前会仔细考虑后果。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_C_9", text: "我有时会逃避责任。", dimension: "conscientiousness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_C_10", text: "我是一个追求完美的人。", dimension: "conscientiousness", direction: 1, options: LIKERT_OPTIONS },

    // Extraversion (10 items)
    { id: "BF_E_1", text: "我是聚会上的活跃分子。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_E_2", text: "我不喜欢成为关注的焦点。", dimension: "extraversion", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_E_3", text: "我感到与人交谈很舒服。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_E_4", text: "我通常保持沉默。", dimension: "extraversion", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_E_5", text: "我喜欢充满刺激的生活。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_E_6", text: "我精力充沛。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_E_7", text: "我是一个比较保守的人。", dimension: "extraversion", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_E_8", text: "我很容易结交新朋友。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_E_9", text: "我更喜欢独处。", dimension: "extraversion", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_E_10", text: "我经常表现出乐观的情绪。", dimension: "extraversion", direction: 1, options: LIKERT_OPTIONS },

    // Agreeableness (10 items)
    { id: "BF_A_1", text: "我关心他人。", dimension: "agreeableness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_A_2", text: "我对别人的问题不感兴趣。", dimension: "agreeableness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_A_3", text: "我尊重他人。", dimension: "agreeableness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_A_4", text: "我经常侮辱他人。", dimension: "agreeableness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_A_5", text: "我通常信任别人。", dimension: "agreeableness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_A_6", text: "我很难原谅别人。", dimension: "agreeableness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_A_7", text: "我有一颗柔软的心。", dimension: "agreeableness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_A_8", text: "我有时会利用他人。", dimension: "agreeableness", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_A_9", text: "我喜欢帮助别人。", dimension: "agreeableness", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_A_10", text: "我经常引起冲突。", dimension: "agreeableness", direction: -1, options: LIKERT_OPTIONS },

    // Neuroticism (10 items)
    { id: "BF_N_1", text: "我经常感到忧郁。", dimension: "neuroticism", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_N_2", text: "我通常很放松。", dimension: "neuroticism", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_N_3", text: "我很容易感到压力。", dimension: "neuroticism", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_N_4", text: "我很少感到焦虑。", dimension: "neuroticism", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_N_5", text: "我的情绪波动很大。", dimension: "neuroticism", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_N_6", text: "我能够很好地控制自己的情绪。", dimension: "neuroticism", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_N_7", text: "我经常担心事情会出错。", dimension: "neuroticism", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_N_8", text: "我在压力下保持冷静。", dimension: "neuroticism", direction: -1, options: LIKERT_OPTIONS },
    { id: "BF_N_9", text: "我很容易被激怒。", dimension: "neuroticism", direction: 1, options: LIKERT_OPTIONS },
    { id: "BF_N_10", text: "我对自己感到满意。", dimension: "neuroticism", direction: -1, options: LIKERT_OPTIONS }
];
