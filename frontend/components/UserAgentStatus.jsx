import { useState, useEffect } from 'react';
import { User, X, Brain, Shield, Sparkles, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import PersonalityRadar from './PersonalityRadar';

export default function UserAgentStatus({ isOpen, onClose }) {
  const [agentInfo, setAgentInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAgentInfo();
    }
  }, [isOpen]);

  const loadAgentInfo = async () => {
    try {
      setLoading(true);
      const result = await api.getDigitalTwin();
      if (result.success) {
        setAgentInfo(result.agent_info);
      }
    } catch (error) {
      console.error('Error loading agent info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Helper to safely get nested data
  const getPersonalityData = () => {
    if (!agentInfo) return null;
    return agentInfo.generated_profile?.core_traits?.big_five ||
      agentInfo.personality?.big_five ||
      null;
  };

  const getValues = () => {
    if (!agentInfo) return [];
    return agentInfo.generated_profile?.core_traits?.values ||
      agentInfo.personality?.values ||
      [];
  };

  const getDefenseMechanism = () => {
    if (!agentInfo) return null;
    return agentInfo.generated_profile?.core_traits?.defense_mechanism ||
      agentInfo.personality?.defense_mechanism;
  };

  const getMbti = () => {
    if (!agentInfo) return null;
    return agentInfo.generated_profile?.core_traits?.mbti ||
      agentInfo.personality?.mbti ||
      (agentInfo.location ? agentInfo.location.replace('MBTI: ', '') : null);
  };

  const bigFiveData = getPersonalityData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">我的数字孪生</h2>
              <p className="text-xs text-cyan-400 font-mono tracking-wider">DIGITAL TWIN PROFILE</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-mono text-sm animate-pulse">LOADING NEURAL DATA...</p>
              </div>
            </div>
          ) : agentInfo ? (
            <div className="flex flex-col md:flex-row h-full">
              {/* Left Column: Visuals */}
              <div className="w-full md:w-5/12 p-8 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 flex flex-col items-center">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold text-white mb-2">{agentInfo.nickname || agentInfo.role_name}</h3>
                  <div className="inline-block px-4 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-sm">
                    {getMbti() || 'UNKNOWN TYPE'}
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center w-full min-h-[300px]">
                  {bigFiveData ? (
                    <PersonalityRadar data={bigFiveData} />
                  ) : (
                    <div className="text-slate-500 text-sm">暂无详细人格数据</div>
                  )}
                </div>

                <div className="w-full mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-slate-400 text-xs mb-1">同步率</div>
                    <div className="text-2xl font-bold text-cyan-400">98.4%</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="text-slate-400 text-xs mb-1">状态</div>
                    <div className="text-green-400 text-sm font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                      ONLINE
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Details */}
              <div className="w-full md:w-7/12 p-8 space-y-8">
                {/* Profile */}
                <section>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span>核心档案</span>
                  </h4>
                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 text-slate-300 leading-relaxed">
                    {agentInfo.profile || agentInfo.description || '暂无描述'}
                  </div>
                </section>

                {/* Values */}
                <section>
                  <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span>核心价值观</span>
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {getValues().map((value, i) => (
                      <span key={i} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm hover:border-cyan-500/50 transition-colors">
                        {value}
                      </span>
                    ))}
                    {getValues().length === 0 && <span className="text-slate-500 text-sm">未定义</span>}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Defense Mechanism */}
                  <section>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                      <Shield className="w-5 h-5 text-red-400" />
                      <span>防御机制</span>
                    </h4>
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                      <div className="text-red-200 font-medium mb-1">
                        {getDefenseMechanism() || '未检测到'}
                      </div>
                      <div className="text-xs text-red-400/60">心理防御模式</div>
                    </div>
                  </section>

                  {/* Speaking Style */}
                  <section>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                      <MessageSquare className="w-5 h-5 text-green-400" />
                      <span>语言风格</span>
                    </h4>
                    <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                      <div className="text-green-200 font-medium mb-1">
                        {agentInfo.speaking_style?.tone || '自然对话'}
                      </div>
                      <div className="text-xs text-green-400/60">
                        {agentInfo.speaking_style?.sentence_length || '多变'} · {agentInfo.speaking_style?.vocabulary || '标准'}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-24 h-24 rounded-full bg-slate-800 mb-4 flex items-center justify-center">
                <User className="w-12 h-12 text-slate-600" />
              </div>
              <p className="text-lg">尚未创建数字孪生</p>
              <p className="text-sm text-slate-600 mt-2">请先完成人格构建流程</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

