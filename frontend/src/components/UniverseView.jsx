import { useState, useEffect, useRef } from 'react';
import { Atom, ChevronRight, Play, User } from 'lucide-react';
import CosmicBackground from './CosmicBackground';
import NeuralMatching from './NeuralMatching';
import ChatInterface from './ChatInterface';
import CreationWizard from './CreationWizard';
import UserAgentStatus from './UserAgentStatus';
import { api } from '../services/api';

export default function UniverseView({ user }) {
  const [showWizard, setShowWizard] = useState(false);
  const [showUserStatus, setShowUserStatus] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [chatStarted, setChatStarted] = useState(false);
  const [hasDigitalTwin, setHasDigitalTwin] = useState(false);
  const [ws, setWs] = useState(null);
  const [agentsAdded, setAgentsAdded] = useState(false); // 跟踪是否已添加agents
  const initRef = useRef(false); // 防止 StrictMode 重复执行

  useEffect(() => {
    if (initRef.current) return; // 已经初始化过，跳过
    initRef.current = true;
    
    checkDigitalTwin();
    
    // 初始化 WebSocket 连接（用于接收角色列表更新）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '8001' : window.location.port;
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
      
      const result = await api.neuralMatch();
      console.log('神经匹配API返回结果:', result);
      
      if (result && result.success) {
        // 确保只取5个agents：Top 3 + 2随机
        const matchedTwins = result.matched_twins || [];
        const randomTwins = result.random_twins || [];
        
        console.log('完美共鸣agents:', matchedTwins.map(a => a.name));
        console.log('随机遭遇agents:', randomTwins.map(a => a.name));
        
        const allAgents = [
          ...matchedTwins.slice(0, 3), // 最多3个完美共鸣
          ...randomTwins.slice(0, 2)    // 最多2个随机遭遇
        ].slice(0, 5); // 确保总共不超过5个
        
        console.log(`将要添加到沙盒的agents (${allAgents.length}个):`, allAgents.map(a => `${a.name} (${a.preset?.id || 'no preset id'})`));
        setSelectedAgents(allAgents);
        
        // 自动将所有匹配到的预设agents添加到沙盒（只添加一次）
        if (allAgents.length > 0) {
          await addMatchedAgentsToSandbox(allAgents);
          setAgentsAdded(true);
        }
      }
    } catch (error) {
      console.error('Error loading matches:', error);
      // 即使匹配失败，也不阻塞界面
      setSelectedAgents([]);
    }
  };

  const addMatchedAgentsToSandbox = async (agents) => {
    console.log(`准备添加 ${agents.length} 个agents到沙盒`);
    console.log(`agents列表:`, agents.map(a => `${a.name} (preset_id: ${a.preset?.id})`));
    
    // 再次确认不会重复添加
    if (agentsAdded) {
      console.warn('agents已经添加过了，跳过重复添加');
      return;
    }
    
    // 遍历所有匹配到的agents，将它们添加到沙盒
    const addPromises = agents.map(async (agent, index) => {
      // 添加小延迟，避免同时添加太多导致服务器压力
      await new Promise(resolve => setTimeout(resolve, index * 300));
      
      if (agent.preset && agent.preset.id) {
        try {
          console.log(`正在添加: ${agent.name} (preset_id: ${agent.preset.id})`);
          const addResult = await api.addPresetNPC(agent.preset.id, agent.name);
          if (addResult.success) {
            console.log(`✓ 已添加预设agent到沙盒: ${agent.name}`);
            return { success: true, agent: agent.name };
          } else {
            console.warn(`✗ 添加预设agent失败: ${agent.name}`, addResult.message);
            return { success: false, agent: agent.name, error: addResult.message };
          }
        } catch (error) {
          console.error(`✗ 添加预设agent时出错: ${agent.name}`, error);
          return { success: false, agent: agent.name, error: error.message };
        }
      } else {
        console.warn(`✗ Agent ${agent.name} 缺少preset信息 (preset=${JSON.stringify(agent.preset)})，跳过添加`);
        return { success: false, agent: agent.name, error: '缺少preset信息' };
      }
    });
    
    const results = await Promise.all(addPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`添加完成: 成功 ${successCount}/${agents.length} 个预设agents`);
    
    // 标记agents已添加
    setAgentsAdded(true);
    
    // 添加完成后，通过WebSocket请求更新角色列表（如果WebSocket已连接）
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('通过WebSocket请求更新角色列表');
      ws.send(JSON.stringify({
        type: 'request_characters'
      }));
    }
  };

  const handleWizardComplete = async (agentInfo) => {
    console.log('数字孪生创建完成，agentInfo:', agentInfo);
    setShowWizard(false);
    setHasDigitalTwin(true);
    // 重置状态，允许添加新的agents
    setAgentsAdded(false);
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
          matchedTwins={selectedAgents.filter(a => a.match > 30)}
          randomTwins={selectedAgents.filter(a => a.match <= 30)}
          onAgentSelect={(agent) => console.log('Agent selected:', agent)} 
        />
        <ChatInterface 
          selectedAgents={selectedAgents} 
          onUserClick={() => setShowUserStatus(true)}
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
        matchedTwins={selectedAgents.filter(a => a.match > 30)}
        randomTwins={selectedAgents.filter(a => a.match <= 30)}
        onAgentSelect={(agent) => console.log('Agent selected:', agent)} 
      />

      {/* 中央视图：宇宙 */}
      <div className="flex-1 relative z-10 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
            <span>SECTOR: ALPHA</span>
            <span className="text-slate-700">|</span>
            <span>NODES: {selectedAgents.length}</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowUserStatus(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 主体交互区 */}
        <main className="flex-1 relative overflow-hidden flex items-center justify-center">
          {/* 中央视觉元素 */}
          <div className="relative w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
            {/* 轨道圈动画 */}
            <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
            <div className="absolute inset-4 border border-purple-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
            <div className="absolute inset-12 border-2 border-dashed border-slate-700/50 rounded-full animate-[spin_30s_linear_infinite]"></div>
            
            {/* 核心文本 */}
            <div className="text-center z-10 p-8 backdrop-blur-sm rounded-full bg-black/20">
              <p className="text-cyan-400 font-mono text-xs tracking-[0.2em] mb-2">TARGET ACQUIRED</p>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter">
                {selectedAgents.length > 0 ? selectedAgents[0].name : '等待匹配'}
              </h1>
              <button
                onClick={handleStartChat}
                disabled={selectedAgents.length === 0}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-sm backdrop-blur-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-3 h-3 fill-current" /> 开始对话
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
              <div className="text-white font-bold text-lg">创造数字孪生</div>
              <div className="text-cyan-200 text-xs font-mono">GENERATE DIGITAL TWIN</div>
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

