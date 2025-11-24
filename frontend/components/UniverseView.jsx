import { useState, useEffect, useRef } from 'react';
import { Atom, ChevronRight, Play, User, LogOut, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CosmicBackground from './CosmicBackground';
import NeuralMatching from './NeuralMatching';
import ChatInterface from './ChatInterface';
import CreationWizard from './CreationWizard';
import UserAgentStatus from './UserAgentStatus';
import { api } from '../services/api';

export default function UniverseView({ user }) {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [showUserStatus, setShowUserStatus] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [chatStarted, setChatStarted] = useState(false);
  const [hasDigitalTwin, setHasDigitalTwin] = useState(false);
  const [ws, setWs] = useState(null);
  const [agentsAdded, setAgentsAdded] = useState(false); // 跟踪是否已添加agents
  const [is1on1, setIs1on1] = useState(false);
  const [targetAgent, setTargetAgent] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const initRef = useRef(false); // 防止 StrictMode 重复执行

  useEffect(() => {
    if (initRef.current) return; // 已经初始化过，跳过
    initRef.current = true;

    checkDigitalTwin();

    // 初始化 WebSocket 连接（用于接收角色列表更新）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8001' : window.location.port;
    const clientId = Math.random().toString(36).substring(7);
    const websocket = new WebSocket(`${protocol}//${host}:${port}/ws/${clientId}`);

    websocket.onopen = () => {
      console.log('UniverseView WebSocket connected');
      setWs(websocket);
      // 请求角色列表
      websocket.send(JSON.stringify({ type: 'request_characters' }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'characters_list') {
        console.log('角色列表已更新:', data.data.characters);
      }
    };

    websocket.onerror = (error) => {
      console.error('UniverseView WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('UniverseView WebSocket disconnected');
      setWs(null);
    };

    return () => {
      websocket.close();
    };
  }, []);

  const checkDigitalTwin = async () => {
    try {
      console.log('检查数字孪生...');

      // 0. 首先清空沙盒中的所有旧预设agents（无论是否有数字孪生）
      console.log('清空沙盒中的所有旧agents（包括上次会话的残留）...');
      try {
        const clearResult = await api.clearPresetAgents();
        if (clearResult.success) {
          console.log(`✓ 已清空 ${clearResult.removed_count} 个旧agents`);
        }
      } catch (clearError) {
        console.warn('清空旧agents时出错:', clearError);
      }

      const result = await api.getDigitalTwin();
      if (result && result.success && result.agent_info) {
        console.log('发现已有数字孪生，role_code:', result.agent_info.role_code);
        setHasDigitalTwin(true);

        console.log('准备恢复用户agent到沙盒...');
        // 1. 恢复用户 agent 到沙盒
        try {
          const restoreResult = await api.restoreUserAgent(result.agent_info.role_code);
          if (restoreResult.success) {
            console.log('✓ 用户agent已恢复到沙盒:', restoreResult.agent_info.nickname);
          } else {
            console.warn('用户agent恢复失败（可能已存在）:', restoreResult.message);
          }
        } catch (error) {
          console.error('恢复用户agent时出错:', error);
        }

        // 2. 加载匹配结果并添加预设agents（loadMatches内部也会再次清空，确保双重保险）
        await loadMatches();
      } else {
        console.log('未发现数字孪生');
        setHasDigitalTwin(false);
        setAgentsAdded(false);
      }
    } catch (error) {
      console.error('Error checking digital twin:', error);
      setHasDigitalTwin(false);
      setAgentsAdded(false);
    }
  };

  const loadMatches = async () => {
    try {
      setIsConnecting(true); // Start connection status

      // 在匹配之前，先清空沙盒中的预设agents（保留用户agent）
      console.log('清空沙盒中的旧预设agents...');
      try {
        const clearResult = await api.clearPresetAgents();
        if (clearResult.success) {
          console.log(`✓ 已清空 ${clearResult.removed_count} 个旧预设agents`);
        }
      } catch (clearError) {
        console.warn('清空旧预设agents时出错（可能是首次加载）:', clearError);
      }

      // 重置agentsAdded标志，允许重新添加
      setAgentsAdded(false);

      // 调用神经匹配接口
      const result = await api.neuralMatch();

      if (result.success) {
        // 后端返回的是 matched_twins 和 random_twins，不是 matches
        const matchedTwins = result.matched_twins || [];
        const randomTwins = result.random_twins || [];

        // 合并并转换数据格式
        const allMatches = [...matchedTwins, ...randomTwins];

        const formattedAgents = allMatches.map(match => ({
          id: match.id,
          name: match.name,
          role: match.role,
          match: match.match,
          avatar: match.avatar || 'bg-gradient-to-br from-purple-500 to-indigo-600',
          description: match.role,
          role_code: null,  // ← 初始为 null，将由 addMatchedAgentsToSandbox 更新
          preset_id: match.preset?.id,
          disabled: false
        }));

        // 确保我们有5个推荐
        const allAgents = formattedAgents.slice(0, 5);

        setSelectedAgents(allAgents);

        // 自动将这些agents添加到沙盒
        await addMatchedAgentsToSandbox(allAgents);
        setAgentsAdded(true);
      }
    } catch (error) {
      console.error('加载匹配结果失败:', error);
    } finally {
      setIsConnecting(false); // End connection status
    }
  };

  const addMatchedAgentsToSandbox = async (agents) => {
    // 遍历添加预设agent到沙盒，并更新role_code
    const updatedAgents = [];
    for (const agent of agents) {
      try {
        if (agent.preset_id) {
          const result = await api.addPresetNPC(agent.preset_id, agent.name);
          if (result.success && result.agent_info) {
            // 使用后端返回的真实 role_code 更新 agent 信息
            updatedAgents.push({
              ...agent,
              role_code: result.agent_info.role_code  // ← 使用后端返回的真实 role_code
            });
            console.log(`✓ Added agent ${agent.name} with role_code: ${result.agent_info.role_code}`);
          } else {
            updatedAgents.push(agent);  // 如果失败，保留原始信息
          }
        } else {
          updatedAgents.push(agent);
        }
      } catch (e) {
        console.error(`添加Agent ${agent.name} 失败:`, e);
        updatedAgents.push(agent);  // 即使失败也保留agent
      }
    }

    // 更新selectedAgents为包含真实role_code的列表
    setSelectedAgents(updatedAgents);
  };

  const handleWizardComplete = async (agentInfo) => {
    console.log('数字孪生创建完成，agentInfo:', agentInfo);
    setShowWizard(false);
    setHasDigitalTwin(true);
    console.log('等待1秒，确保用户agent已经被创建并添加到沙盒...');
    // 等待一下，确保用户agent已经被创建并添加到沙盒
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('开始加载匹配结果...');
    // 加载匹配结果（会自动添加预设agents到沙盒）
    await loadMatches();
  };

  const handleStartChat = () => {
    if (selectedAgents.length > 0) {
      setChatStarted(true);
      setIs1on1(false);
      setTargetAgent(null);
    }
  };

  const handleBackToMatching = async () => {
    try {
      // 重置沙盒状态
      console.log('Resetting sandbox...');
      const resetResult = await api.resetSandbox();

      if (resetResult.success) {
        console.log('Sandbox reset successful');
        // 重置UI状态
        setChatStarted(false);
        setIs1on1(false);
        setTargetAgent(null);

        // 重新加载匹配列表
        await loadMatches();
      } else {
        alert('重置沙盒失败: ' + (resetResult.error || '未知错误'));
      }
    } catch (error) {
      console.error('重置沙盒时出错:', error);
      alert('重置沙盒时出错: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await api.logout();
      if (result.success) {
        // 跳转到登录页
        router.push('/login');
      } else {
        alert('退出登录失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('退出登录时出错:', error);
      alert('退出登录时出错');
    }
  };

  const handleToggleAgent = async (agent) => {
    const newDisabledState = !agent.disabled;

    // 乐观更新 UI
    setSelectedAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, disabled: newDisabledState } : a
    ));

    try {
      await api.toggleAgentSandbox(agent.role_code, !newDisabledState, agent.preset_id);
    } catch (error) {
      console.error('Toggle failed', error);
      // 失败回滚
      setSelectedAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, disabled: !newDisabledState } : a
      ));
      alert('操作失败: ' + error.message);
    }
  };

  const handleStart1on1Chat = async (agent) => {
    try {
      console.log('[1on1] Starting 1-on-1 chat with agent:', agent);

      // 验证agent有有效的role_code
      if (!agent.role_code) {
        console.error('[1on1] Agent missing role_code:', agent);
        alert('Agent尚未完全加载，请稍后再试');
        return;
      }

      console.log(`[1on1] Calling API with role_code: ${agent.role_code}, preset_id: ${agent.preset_id}`);
      await api.start1on1Chat(agent.role_code, agent.preset_id);

      setTargetAgent(agent);
      setIs1on1(true);
      setChatStarted(true);
      console.log('[1on1] 1-on-1 chat started successfully');
    } catch (error) {
      console.error('Start 1-on-1 chat failed', error);
      alert('无法开启私密对话: ' + error.message);
    }
  };

  if (!hasDigitalTwin) {
    return (
      <div className="relative w-full h-screen bg-black text-white overflow-hidden flex items-center justify-center">
        <CosmicBackground intensity={0.8} />
        <div className="z-10 text-center">
          <p className="text-slate-400 mb-6">请先创建你的数字孪生</p>
          <button
            onClick={() => setShowWizard(true)}
            className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            创建数字孪生
          </button>
        </div>
        {showWizard && (
          <CreationWizard
            onClose={() => setShowWizard(false)}
            onComplete={handleWizardComplete}
          />
        )}
      </div>
    );
  }

  if (chatStarted) {
    return (
      <div className="relative w-full h-screen bg-black text-white overflow-hidden flex">
        <CosmicBackground intensity={0.8} />
        <NeuralMatching
          matchedTwins={selectedAgents.slice(0, 3)}
          randomTwins={selectedAgents.slice(3)}
          onToggleAgent={handleToggleAgent}
          onStartChat={handleStart1on1Chat}
          chatStarted={chatStarted}
        />
        <ChatInterface
          selectedAgents={is1on1 && targetAgent ? [targetAgent] : selectedAgents.filter(a => !a.disabled)}
          onUserClick={() => setShowUserStatus(true)}
          onBackToMatching={handleBackToMatching}
          onLogout={handleLogout}
          isPrivateChat={is1on1}
        />
        {showUserStatus && (
          <UserAgentStatus
            isOpen={showUserStatus}
            onClose={() => setShowUserStatus(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden flex">
      <CosmicBackground intensity={0.8} />

      {/* 左侧边栏：匹配系统 */}
      <NeuralMatching
        matchedTwins={selectedAgents.slice(0, 3)}
        randomTwins={selectedAgents.slice(3)}
        onToggleAgent={handleToggleAgent}
        onStartChat={handleStart1on1Chat}
        chatStarted={chatStarted}
      />

      {/* 中央视图：宇宙 */}
      <div className="flex-1 relative z-10 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
            <span>SECTOR: {is1on1 ? 'PRIVATE' : 'ALPHA'}</span>
            <span className="text-slate-700">|</span>
            <span>NODES: {selectedAgents.filter(a => !a.disabled).length}</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowUserStatus(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="我的数字孪生"
            >
              <User className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 主体交互区 */}
        <main className="flex-1 relative overflow-hidden flex items-center justify-center">
          {/* 中央视觉元素 */}
          <div className="relative w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
            {/* 轨道圈动画 */}
            <div className={`absolute inset-0 border border-cyan-500/20 rounded-full ${isConnecting ? 'animate-[spin_2s_linear_infinite]' : 'animate-[spin_10s_linear_infinite]'}`}></div>
            <div className={`absolute inset-4 border border-purple-500/20 rounded-full ${isConnecting ? 'animate-[spin_3s_linear_infinite_reverse]' : 'animate-[spin_15s_linear_infinite_reverse]'}`}></div>
            <div className={`absolute inset-12 border-2 border-dashed border-slate-700/50 rounded-full ${isConnecting ? 'animate-[spin_5s_linear_infinite]' : 'animate-[spin_30s_linear_infinite]'}`}></div>

            {/* 核心文本 */}
            <div className="text-center z-10 p-8 backdrop-blur-sm rounded-full bg-black/20">
              <p className={`font-mono text-xs tracking-[0.2em] mb-2 ${isConnecting ? 'text-yellow-400 animate-pulse' : 'text-cyan-400'}`}>
                {isConnecting ? 'ESTABLISHING LINK...' : 'CONNECTION ESTABLISHED'}
              </p>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter">
                {isConnecting ? '连接中...' : (
                  selectedAgents.length > 1
                    ? '已连接'
                    : (selectedAgents.length > 0 ? selectedAgents[0].name : '等待匹配')
                )}
              </h1>
              <button
                onClick={handleStartChat}
                disabled={isConnecting || selectedAgents.filter(a => !a.disabled).length === 0}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-sm backdrop-blur-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader w-3 h-3 animate-spin"><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m7.8 16.2-2.9 2.9" /><path d="M6 12H2" /><path d="m7.8 7.8-2.9-2.9" /></svg> 正在连接...</>
                ) : (
                  <><Play className="w-3 h-3 fill-current" /> 开始对话</>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* 底部交互指引区 */}
        <div className="p-8 pb-12 flex justify-center pointer-events-none">
          <button
            onClick={() => setShowWizard(true)}
            className="pointer-events-auto group relative flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-full shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:shadow-[0_0_60px_rgba(6,182,212,0.6)] hover:-translate-y-1 transition-all duration-300"
          >
            <div className="relative">
              <Atom className="w-8 h-8 text-white animate-spin-slow" />
              <div className="absolute inset-0 bg-white rounded-full blur-md opacity-30 animate-pulse"></div>
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-lg">{hasDigitalTwin ? '重新创造数字孪生' : '创造数字孪生'}</div>
              <div className="text-cyan-200 text-xs font-mono">{hasDigitalTwin ? 'RE-GENERATE DIGITAL TWIN' : 'GENERATE DIGITAL TWIN'}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* 模态框 */}
      {showWizard && (
        <CreationWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}
      {showUserStatus && (
        <UserAgentStatus
          isOpen={showUserStatus}
          onClose={() => setShowUserStatus(false)}
        />
      )}
    </div>
  );
}

