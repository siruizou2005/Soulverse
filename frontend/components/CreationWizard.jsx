import { useState } from 'react';
import { X, ArrowRight, Fingerprint, Cpu, User, Zap, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

export default function CreationWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    method: 'qa', // qa, text, file
    text: '',
    interests: '',
    personality: '',
    socialGoals: '',
    file: null
  });

  const steps = [
    { title: "人格核心", icon: <Fingerprint className="w-6 h-6" />, desc: "定义你的数字孪生的基础性格与价值观。" },
    { title: "知识图谱", icon: <Cpu className="w-6 h-6" />, desc: "上传或链接你希望孪生学习的记忆与知识库。" },
    { title: "外貌与声音", icon: <User className="w-6 h-6" />, desc: "生成独特的虚拟形象与语音合成模型。" },
  ];

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // 完成创建
      setLoading(true);
      try {
        let result;
        const userId = formData.userId || `user_${Date.now()}`;

        if (formData.method === 'qa') {
          const answers = {};
          if (formData.interests) answers.interests = formData.interests;
          if (formData.personality) answers.personality = formData.personality;
          if (formData.socialGoals) answers.social_goals = formData.socialGoals;
          
          result = await api.createAgentFromQA(userId, answers);
        } else if (formData.method === 'text') {
          result = await api.createAgentFromText(userId, formData.text);
        } else if (formData.method === 'file' && formData.file) {
          result = await api.createAgentFromFile(userId, formData.file);
        } else {
          // 快速创建
          result = await api.createUserAgent(userId);
        }

        if (result.success) {
          console.log('用户agent创建成功:', result.agent_info);
          // 保存数字孪生到用户数据
          await api.saveDigitalTwin(result.agent_info);
          console.log('数字孪生已保存到用户数据');
          onComplete(result.agent_info);
        } else {
          alert('创建失败: ' + (result.message || '未知错误'));
          setLoading(false);
        }
      } catch (error) {
        console.error('Error creating agent:', error);
        alert('创建失败: ' + error.message);
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] relative">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-2 text-cyan-400">
            <Zap className="w-5 h-5 animate-spin-slow" />
            <span className="font-bold tracking-wider">GENESIS PROTOCOL</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 min-h-[300px] flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full flex-1 animate-pulse">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-cyan-300 font-mono">正在构建神经元网络...</p>
              <p className="text-slate-500 text-sm mt-2">同步率 98.4%</p>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="flex justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10"></div>
                {steps.map((s, i) => (
                  <div key={i} className={`flex flex-col items-center gap-2 transition-all duration-300 ${i + 1 <= step ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      i + 1 === step 
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' 
                        : i + 1 < step 
                        ? 'bg-cyan-500 border-cyan-500 text-black' 
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}>
                      {i + 1 < step ? <Zap className="w-5 h-5 fill-current" /> : s.icon}
                    </div>
                    <span className="text-xs font-mono">{s.title}</span>
                  </div>
                ))}
              </div>

              {/* Content Area */}
              <div className="flex-1">
                <h3 className="text-2xl text-white font-light mb-2">{steps[step-1].title}</h3>
                <p className="text-slate-400 mb-6">{steps[step-1].desc}</p>
                
                {/* Mock Inputs based on step */}
                <div className="space-y-4">
                  {step === 1 && (
                    <>
                      <input
                        type="text"
                        placeholder="输入性格关键词 (如: 理性, 幽默)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition-colors"
                        value={formData.personality}
                        onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      />
                      <div className="flex gap-2">
                        {['MBTI', '星座', '职业'].map(tag => (
                          <span key={tag} className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs border border-slate-700 cursor-pointer hover:border-cyan-500 hover:text-cyan-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <div className="h-32 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center text-slate-500 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer">
                      点击上传文档或连接 Notion/Twitter
                    </div>
                  )}
                  {step === 3 && (
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`aspect-square rounded-lg bg-slate-800 cursor-pointer hover:ring-2 hover:ring-cyan-500 transition-all ${i === 1 ? 'ring-2 ring-cyan-500' : ''}`}></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="p-6 border-t border-slate-800 flex justify-between">
            <button
              onClick={step > 1 ? () => setStep(step - 1) : onClose}
              className="text-slate-400 hover:text-white px-4 py-2"
            >
              {step === 1 ? '取消' : '上一步'}
            </button>
            <button
              onClick={handleNext}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
            >
              {step === 3 ? '启动生成' : '下一步'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

