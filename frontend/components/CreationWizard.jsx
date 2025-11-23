import { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, Fingerprint, Cpu, User, Zap, Check, Upload, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { MBTI_TYPES, MBTI_QUESTIONS, CORE_QUESTIONS } from '../data/questionnaires';

export default function CreationWizard({ onClose, onComplete }) {
  // 步骤: 1=MBTI, 2=核心层(BigFive), 3=风格层(聊天记录), 4=生成中/结果
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  // MBTI 状态
  const [mbtiMode, setMbtiMode] = useState(null); // 'known' | 'unknown'
  const [selectedMbti, setSelectedMbti] = useState(null);
  const [mbtiAnswers, setMbtiAnswers] = useState(new Array(MBTI_QUESTIONS.length).fill(null));
  const [currentMbtiQuestion, setCurrentMbtiQuestion] = useState(0);

  // 核心层状态
  const [coreMode, setCoreMode] = useState(null); // 'skip' | 'test'
  const [coreAnswers, setCoreAnswers] = useState(new Array(CORE_QUESTIONS.length).fill(null));
  const [currentCoreQuestion, setCurrentCoreQuestion] = useState(0);

  // 风格层状态
  const [styleMode, setStyleMode] = useState(null); // 'skip' | 'upload'
  const [chatHistory, setChatHistory] = useState('');
  const [wechatName, setWechatName] = useState('');
  const [relationship, setRelationship] = useState('');

  // 生成结果
  const [generatedProfile, setGeneratedProfile] = useState(null);

  // 步骤标题和描述
  const steps = [
    { title: "人格基石 (MBTI)", icon: <Fingerprint className="w-5 h-5" />, desc: "确定你的 MBTI 类型，构建人格的基础框架。" },
    { title: "核心特质 (Big Five)", icon: <Cpu className="w-5 h-5" />, desc: "通过大五人格测试，深入刻画你的性格维度。" },
    { title: "语言风格", icon: <MessageSquare className="w-5 h-5" />, desc: "上传聊天记录，让数字孪生学习你的表达习惯。" },
    { title: "神经元构建", icon: <Zap className="w-5 h-5" />, desc: "正在生成你的数字孪生..." },
  ];

  // 计算MBTI结果
  const calculateMbti = () => {
    const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    mbtiAnswers.forEach(answer => {
      if (answer) counts[answer]++;
    });

    return (
      (counts.E >= counts.I ? 'E' : 'I') +
      (counts.S >= counts.N ? 'S' : 'N') +
      (counts.T >= counts.F ? 'T' : 'F') +
      (counts.J >= counts.P ? 'J' : 'P')
    );
  };

  // 处理下一步
  const handleNext = async () => {
    if (step === 1) {
      if (mbtiMode === 'unknown' && mbtiAnswers.filter(a => a).length === MBTI_QUESTIONS.length) {
        const calculated = calculateMbti();
        setSelectedMbti(calculated);
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
      await generateProfile();
    }
  };

  // 生成画像
  const generateProfile = async () => {
    setLoading(true);
    const progressSteps = [
      { p: 20, t: '正在分析人格数据...' },
      { p: 40, t: '正在构建思维模型...' },
      { p: 60, t: '正在提取语言特征...' },
      { p: 80, t: '正在生成完整画像...' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        setProgress(progressSteps[currentStep].p);
        setProgressText(progressSteps[currentStep].t);
        currentStep++;
      }
    }, 800);

    try {
      const payload = {
        mbti_type: selectedMbti,
        mbti_answers: mbtiMode === 'unknown' ? mbtiAnswers : null,
        big_five_answers: coreMode === 'test' ? coreAnswers : null,
        chat_history: styleMode === 'upload' ? (chatHistory.length > 50000 ? chatHistory.substring(0, 50000) : chatHistory) : null,
        user_name: wechatName,
        relationship: relationship
      };

      // 调用后端API生成画像
      const response = await api.generateDigitalTwinProfile(payload);

      // api.js的方法直接返回json数据，不需要再次await response.json()
      // 但我们需要检查返回结构，api.js通常直接返回解析后的JSON
      const result = response;

      clearInterval(interval);
      setProgress(100);
      setProgressText('生成完成！');

      if (result.success) {
        setGeneratedProfile(result.profile);
      } else {
        // 优先显示 detail (FastAPI 错误格式)，其次是 error，最后是未知错误
        const errorMessage = result.detail || result.error || '未知错误';
        console.error('Generation failed:', result);
        alert('生成失败: ' + errorMessage);
        setStep(3); // 返回上一步
      }
    } catch (error) {
      clearInterval(interval);
      console.error('Generation error:', error);
      alert('生成出错: ' + error.message);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // 确认并创建Agent
  const handleConfirm = async () => {
    if (!generatedProfile) return;

    setLoading(true);
    try {
      // 1. 使用生成的人格数据创建用户Agent
      const userId = `user_${Date.now()}`;
      const role_code = `digital_twin_${userId}`;

      // 构建Agent信息 - 符合UI组件期望的格式
      const agentInfo = {
        role_code: role_code,
        nickname: wechatName || 'My Digital Twin',
        role_name: wechatName || 'My Digital Twin',
        location: `MBTI: ${generatedProfile.core_traits.mbti}`,
        profile: `基于 ${generatedProfile.core_traits.mbti} 人格构建的数字孪生`,
        personality: generatedProfile.core_traits,
        speaking_style: generatedProfile.speaking_style,
        // 保存完整的生成数据
        generated_profile: generatedProfile
      };

      // 2. 保存数字孪生到用户数据
      const saveResult = await api.saveDigitalTwin(agentInfo);

      if (!saveResult.success) {
        throw new Error(saveResult.detail || saveResult.message || '保存失败');
      }

      // 3. 创建实际的ScrollWeaver agent
      try {
        const createResult = await api.createUserAgent(userId);
        if (createResult.success) {
          console.log('✓ 用户agent已创建:', createResult.agent_info);
        } else {
          console.warn('创建agent失败，但数字孪生已保存:', createResult.message);
        }
      } catch (createError) {
        console.warn('创建agent出错，但数字孪生已保存:', createError);
        // 继续流程，即使agent创建失败
      }

      // 4. 完成创建并关闭向导
      onComplete(agentInfo);
    } catch (error) {
      console.error('Save error:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 渲染MBTI步骤
  const renderMbtiStep = () => {
    if (!mbtiMode) {
      return (
        <div className="grid grid-cols-2 gap-6 h-full">
          <div
            onClick={() => setMbtiMode('known')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Check className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">我知道我的 MBTI</h3>
            <p className="text-slate-400 text-center text-sm">直接从 16 种人格类型中选择</p>
          </div>
          <div
            onClick={() => setMbtiMode('unknown')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-purple-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Fingerprint className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">我不知道</h3>
            <p className="text-slate-400 text-center text-sm">通过 20 题快速测试确定类型</p>
          </div>
        </div>
      );
    }

    if (mbtiMode === 'known') {
      return (
        <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
          {MBTI_TYPES.map(type => (
            <div
              key={type.code}
              onClick={() => setSelectedMbti(type.code)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedMbti === type.code
                ? 'bg-cyan-500/20 border-cyan-500'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                }`}
            >
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="font-bold text-white">{type.code}</div>
              <div className="text-xs text-slate-400">{type.name}</div>
            </div>
          ))}
        </div>
      );
    }

    // 问卷模式
    const question = MBTI_QUESTIONS[currentMbtiQuestion];
    return (
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>问题 {currentMbtiQuestion + 1} / {MBTI_QUESTIONS.length}</span>
            <span>已回答: {mbtiAnswers.filter(a => a).length}/{MBTI_QUESTIONS.length}</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${((currentMbtiQuestion + 1) / MBTI_QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        <h3 className="text-xl text-white mb-8">{question.text}</h3>

        <div className="space-y-4">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                const newAnswers = [...mbtiAnswers];
                newAnswers[currentMbtiQuestion] = option.value;
                setMbtiAnswers(newAnswers);
                if (currentMbtiQuestion < MBTI_QUESTIONS.length - 1) {
                  setTimeout(() => setCurrentMbtiQuestion(curr => curr + 1), 200);
                }
              }}
              className={`w-full p-4 text-left rounded-xl border transition-all ${mbtiAnswers[currentMbtiQuestion] === option.value
                ? 'bg-cyan-500/20 border-cyan-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                }`}
            >
              {option.text}
            </button>
          ))}
        </div>

        <div className="mt-auto flex justify-between pt-6">
          <button
            onClick={() => setCurrentMbtiQuestion(curr => Math.max(0, curr - 1))}
            disabled={currentMbtiQuestion === 0}
            className="text-slate-500 disabled:opacity-30 hover:text-white"
          >
            上一题
          </button>
        </div>
      </div>
    );
  };

  // 渲染核心层步骤
  const renderCoreStep = () => {
    if (!coreMode) {
      return (
        <div className="grid grid-cols-2 gap-6 h-full">
          <div
            onClick={() => setCoreMode('skip')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-slate-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRight className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">直接生成</h3>
            <p className="text-slate-400 text-center text-sm">跳过详细测试，基于 MBTI 生成</p>
          </div>
          <div
            onClick={() => setCoreMode('test')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">深度构建</h3>
            <p className="text-slate-400 text-center text-sm">通过 Big Five 测试精确刻画</p>
          </div>
        </div>
      );
    }

    if (coreMode === 'skip') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-yellow-400" />
          </div>
          <h3 className="text-xl text-white mb-2">已准备好进入下一步</h3>
          <p className="text-slate-400 max-w-xs">我们将基于您的 MBTI 类型 ({selectedMbti}) 构建核心人格。</p>
        </div>
      );
    }

    // 问卷模式
    const question = CORE_QUESTIONS[currentCoreQuestion];
    return (
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>问题 {currentCoreQuestion + 1} / {CORE_QUESTIONS.length}</span>
            <span>{Math.round(((currentCoreQuestion + 1) / CORE_QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${((currentCoreQuestion + 1) / CORE_QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        <h3 className="text-xl text-white mb-8">{question.text}</h3>

        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                const newAnswers = [...coreAnswers];
                newAnswers[currentCoreQuestion] = { dimension: question.dimension, value: option.value };
                setCoreAnswers(newAnswers);
                if (currentCoreQuestion < CORE_QUESTIONS.length - 1) {
                  setTimeout(() => setCurrentCoreQuestion(curr => curr + 1), 200);
                }
              }}
              className={`w-full p-3 text-left rounded-xl border transition-all ${coreAnswers[currentCoreQuestion]?.value === option.value
                ? 'bg-cyan-500/20 border-cyan-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                }`}
            >
              {option.text}
            </button>
          ))}
        </div>

        <div className="mt-auto flex justify-between pt-4">
          <button
            onClick={() => setCurrentCoreQuestion(curr => Math.max(0, curr - 1))}
            disabled={currentCoreQuestion === 0}
            className="text-slate-500 disabled:opacity-30 hover:text-white"
          >
            上一题
          </button>
        </div>
      </div>
    );
  };

  // 渲染风格层步骤
  const renderStyleStep = () => {
    if (!styleMode) {
      return (
        <div className="grid grid-cols-2 gap-6 h-full">
          <div
            onClick={() => setStyleMode('skip')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-slate-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRight className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">跳过</h3>
            <p className="text-slate-400 text-center text-sm">使用默认语言风格</p>
          </div>
          <div
            onClick={() => setStyleMode('upload')}
            className="border border-slate-700 bg-slate-800/50 rounded-xl p-6 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">上传聊天记录</h3>
            <p className="text-slate-400 text-center text-sm">AI 学习你的表达习惯</p>
          </div>
        </div>
      );
    }

    if (styleMode === 'upload') {
      return (
        <div className="flex flex-col h-full gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">你在聊天中的昵称</label>
              <input
                type="text"
                value={wechatName}
                onChange={e => setWechatName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="例如: Alice"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">对方与你的关系</label>
              <input
                type="text"
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="例如: 朋友"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">聊天记录文本</label>
            <textarea
              value={chatHistory}
              onChange={e => setChatHistory(e.target.value)}
              className="w-full h-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none resize-none custom-scrollbar"
              placeholder="请粘贴聊天记录..."
            />
          </div>
        </div>
      );
    }

    return null;
  };

  // 渲染生成结果
  const renderResult = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-24 h-24 relative mb-8">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
            <div
              className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"
            ></div>
            <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold">
              {progress}%
            </div>
          </div>
          <h3 className="text-xl text-white mb-2">{progressText}</h3>
          <p className="text-slate-500 text-sm">这可能需要 1-2 分钟，请耐心等待...</p>
        </div>
      );
    }

    if (generatedProfile) {
      return (
        <div className="h-full overflow-y-auto custom-scrollbar pr-2">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <User className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">数字孪生构建完成</h2>
            <p className="text-slate-400">MBTI: <span className="text-cyan-400 font-bold">{generatedProfile.core_traits.mbti}</span></p>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4" /> 核心特质
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(generatedProfile.core_traits.big_five || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 capitalize">{key}</span>
                    <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${value * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {generatedProfile.speaking_style && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 语言风格
                </h3>
                <div className="flex flex-wrap gap-2">
                  {generatedProfile.speaking_style.catchphrases?.slice(0, 5).map((phrase, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs text-cyan-300">
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // 底部按钮状态
  const isNextDisabled = () => {
    if (step === 1) {
      if (!mbtiMode) return true;
      if (mbtiMode === 'known' && !selectedMbti) return true;
      if (mbtiMode === 'unknown') {
        const answeredCount = mbtiAnswers.filter(a => a).length;
        // console.log(`MBTI Progress: ${answeredCount}/${MBTI_QUESTIONS.length}`);
        return answeredCount < MBTI_QUESTIONS.length;
      }
    }
    if (step === 2) {
      if (!coreMode) return true;
      if (coreMode === 'test') {
        const answeredCount = coreAnswers.filter(a => a).length;
        return answeredCount < CORE_QUESTIONS.length;
      }
    }
    if (step === 3) {
      if (!styleMode) return true;
      if (styleMode === 'upload' && (!chatHistory || !wechatName)) return true;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-2xl h-[600px] overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-2 text-cyan-400">
            <Zap className="w-5 h-5" />
            <span className="font-bold tracking-wider">GENESIS PROTOCOL</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        {step < 4 && (
          <div className="flex border-b border-slate-800 bg-slate-950/50">
            {steps.slice(0, 3).map((s, i) => (
              <div
                key={i}
                className={`flex-1 p-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${step === i + 1
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                  : i + 1 < step
                    ? 'border-transparent text-slate-500'
                    : 'border-transparent text-slate-700'
                  }`}
              >
                {s.icon}
                <span className="text-sm font-medium hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-8 overflow-hidden">
          {step === 1 && renderMbtiStep()}
          {step === 2 && renderCoreStep()}
          {step === 3 && renderStyleStep()}
          {step === 4 && renderResult()}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="p-6 border-t border-slate-800 flex justify-between bg-slate-900">
            <button
              onClick={() => {
                if (step === 1 && mbtiMode) setMbtiMode(null);
                else if (step === 2 && coreMode) setCoreMode(null);
                else if (step === 3 && styleMode) setStyleMode(null);
                else if (step > 1) setStep(step - 1);
                else onClose();
              }}
              className="px-6 py-2 text-slate-400 hover:text-white flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 && !mbtiMode ? '取消' : '上一步'}
            </button>

            <button
              onClick={handleNext}
              disabled={isNextDisabled()}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-8 py-2 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
            >
              {step === 3 ? '开始生成' : '下一步'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 4 && !loading && (
          <div className="p-6 border-t border-slate-800 flex justify-center bg-slate-900">
            <button
              onClick={handleConfirm}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-12 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
            >
              <Check className="w-5 h-5" />
              确认并启动数字孪生
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

