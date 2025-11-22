import { useState } from 'react';
import { User, X } from 'lucide-react';
import { api } from '../services/api';
import { useEffect } from 'react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">我的数字孪生</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center text-slate-400">加载中...</div>
          ) : agentInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{agentInfo.nickname || agentInfo.role_name}</h3>
                  <p className="text-sm text-slate-400">{agentInfo.location || '未知位置'}</p>
                </div>
              </div>
              
              {agentInfo.profile && (
                <div>
                  <h4 className="text-sm font-bold text-slate-400 mb-2">简介</h4>
                  <p className="text-slate-300 text-sm">{agentInfo.profile}</p>
                </div>
              )}
              
              {agentInfo.extracted_profile && (
                <div>
                  <h4 className="text-sm font-bold text-slate-400 mb-2">兴趣</h4>
                  <div className="flex flex-wrap gap-2">
                    {(agentInfo.extracted_profile.interests || []).slice(0, 5).map((interest, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <p>尚未创建数字孪生</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

