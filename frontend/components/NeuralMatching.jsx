import { Sparkles, Globe, MessageSquare, User } from 'lucide-react';

export default function NeuralMatching({ matchedTwins = [], randomTwins = [], onAgentSelect }) {

  return (
    <div className="w-80 h-full bg-slate-950/80 backdrop-blur-md border-r border-slate-800 z-20 flex flex-col transform transition-transform duration-300">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
          神经元匹配
        </h2>
        <p className="text-xs text-slate-500 mt-1">基于你的数字指纹</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* 最佳匹配 */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-yellow-500" /> 完美共鸣 (Top 3)
          </h3>
          <div className="space-y-3">
            {matchedTwins.map(twin => (
              <div
                key={twin.id}
                className="group p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 transition-all cursor-pointer"
                onClick={() => onAgentSelect && onAgentSelect(twin)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${twin.avatar} flex items-center justify-center text-xs font-bold shadow-lg`}>
                    {twin.name.substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm text-slate-200">{twin.name}</span>
                      <span className="text-xs font-mono text-cyan-400">{twin.match}%</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{twin.role}</div>
                  </div>
                </div>
                {/* Interaction Bar */}
                <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex-1 py-1 text-xs bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/40">
                    连接
                  </button>
                  <button className="px-2 py-1 text-xs bg-slate-700 rounded hover:bg-slate-600">
                    <MessageSquare className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 随机遭遇 */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe className="w-3 h-3 text-slate-400" /> 随机遭遇
          </h3>
          <div className="space-y-3">
            {randomTwins.map(twin => (
              <div
                key={twin.id}
                className="p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 hover:border-slate-600 transition-all cursor-pointer opacity-75 hover:opacity-100"
                onClick={() => onAgentSelect && onAgentSelect(twin)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${twin.avatar} grayscale group-hover:grayscale-0 flex items-center justify-center text-[10px] font-bold`}>
                    {twin.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm text-slate-300">{twin.name}</div>
                    <div className="text-[10px] text-slate-600">匹配度: {twin.match}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 用户状态 */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-slate-400 flex items-center justify-center">
            <User className="w-4 h-4 text-black" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">User_001</div>
            <div className="text-xs text-cyan-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              链接稳定
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

