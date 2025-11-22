import { useState, useEffect, useRef } from 'react';
import { Play, Square, User, Bot, UserCircle } from 'lucide-react';

export default function ChatInterface({ selectedAgents = [], onUserClick }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiControlEnabled, setAiControlEnabled] = useState(true); // true=用户控制, false=AI自由行动
  const [waitingForInput, setWaitingForInput] = useState(false); // 是否正在等待用户输入
  const [waitingRoleName, setWaitingRoleName] = useState(''); // 等待输入的角色名称
  const [ws, setWs] = useState(null);
  const messagesEndRef = useRef(null);
  const clientId = useRef(Math.random().toString(36).substring(7));

  useEffect(() => {
    // 初始化 WebSocket 连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '8001' : window.location.port;
    const websocket = new WebSocket(`${protocol}//${host}:${port}/ws/${clientId.current}`);
    
    websocket.onopen = async () => {
      console.log('WebSocket connected');
      setWs(websocket);
      
      // 1. 首先发送用户身份确认
      try {
        const userResult = await fetch('/api/user/me', { credentials: 'include' });
        if (userResult.ok) {
          const userData = await userResult.json();
          if (userData.success && userData.user) {
            console.log('发送用户身份确认:', userData.user.user_id);
            websocket.send(JSON.stringify({
              type: 'identify_user',
              user_id: userData.user.user_id
            }));
          }
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
      }
      
      // 2. 然后发送初始的 possession_mode 设置
      websocket.send(JSON.stringify({
        type: 'set_possession_mode',
        enabled: aiControlEnabled
      }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setWs(null);
    };

    return () => {
      websocket.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleWebSocketMessage = (data) => {
    if (data.type === 'message') {
      setMessages(prev => [...prev, {
        username: data.data.username,
        text: data.data.text,
        timestamp: data.data.timestamp,
        is_user: data.data.is_user || false
      }]);
      
      // 如果收到用户消息，取消等待状态
      if (data.data.is_user) {
        setWaitingForInput(false);
        setWaitingRoleName('');
      }
    } else if (data.type === 'characters_list') {
      // 处理角色列表更新
      console.log('Characters updated:', data.data.characters);
    } else if (data.type === 'user_agent_selected') {
      // 用户 agent 已选择
      console.log('✓ 用户Agent已选择:', data.data);
    } else if (data.type === 'waiting_for_user_input') {
      // 等待用户输入
      console.log('⏳ 等待用户输入:', data.data);
      setWaitingForInput(true);
      setWaitingRoleName(data.data.role_name || '你的角色');
    } else if (data.type === 'possession_mode_updated') {
      // Possession mode 已更新
      console.log('🔄 控制模式已更新:', data.data);
      // 如果切换到AI自由行动模式，取消等待状态
      if (!data.data.enabled) {
        setWaitingForInput(false);
        setWaitingRoleName('');
      }
    } else if (data.type === 'error') {
      // 错误消息，可能需要保持等待状态或取消
      console.error('错误:', data.data);
    }
  };

  const handleTogglePlayPause = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    if (isPlaying) {
      // 当前正在播放，点击停止
      setIsPlaying(false);
      ws.send(JSON.stringify({
        type: 'control',
        action: 'stop'
      }));
    } else {
      // 当前已停止，点击开始
      setIsPlaying(true);
      ws.send(JSON.stringify({
        type: 'control',
        action: 'start'
      }));
    }
  };

  const handleToggleAiControl = () => {
    const newValue = !aiControlEnabled;
    setAiControlEnabled(newValue);
    
    // 发送模式切换到后端
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_possession_mode',
        enabled: newValue
      }));
    }
    
    console.log(`切换到${newValue ? '用户控制' : 'AI自由行动'}模式`);
  };

  const handleSend = () => {
    // 只有在等待输入时才能发送
    if (!waitingForInput) {
      console.warn('当前不是用户输入时间，无法发送消息');
      return;
    }
    
    if (!inputText.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    // 发送用户输入
    ws.send(JSON.stringify({
      type: 'user_message',  // 注意：后端期望的是 'user_message' 而不是 'user_input'
      text: inputText.trim()
    }));

    setInputText('');
    // 注意：等待状态会在收到服务器确认消息后取消
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 relative z-10 flex flex-col bg-black">
      {/* 顶部导航栏 */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
          <span>SECTOR: ALPHA</span>
          <span className="text-slate-700">|</span>
          <span>NODES: {selectedAgents.length}</span>
        </div>
        <div className="flex gap-2 items-center">
          {/* AI控制模式切换 */}
          <button
            onClick={handleToggleAiControl}
            className={`px-3 py-1.5 text-xs font-mono rounded-full transition-all flex items-center gap-1.5 ${
              aiControlEnabled
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
            }`}
            title={aiControlEnabled ? "当前：用户控制模式（点击切换为AI自由行动）" : "当前：AI自由行动模式（点击切换为用户控制）"}
          >
            {aiControlEnabled ? (
              <>
                <UserCircle className="w-3.5 h-3.5" />
                <span>用户控制</span>
              </>
            ) : (
              <>
                <Bot className="w-3.5 h-3.5" />
                <span>AI行动</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleTogglePlayPause}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title={isPlaying ? "停止" : "开始"}
          >
            {isPlaying ? (
              <Square className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          {onUserClick && (
            <button
              onClick={onUserClick}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="我的数字孪生"
            >
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 聊天消息区域 */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <p className="text-lg mb-2">开始对话</p>
              <p className="text-sm">选择角色并点击开始按钮</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.is_user ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] rounded-lg p-4 ${
                  msg.is_user
                    ? 'bg-cyan-500/20 border border-cyan-500/30 text-white'
                    : 'bg-slate-900/50 border border-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{msg.username}</span>
                    <span className="text-xs text-slate-500">{msg.timestamp}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* 底部输入区域 */}
      <div className="p-6 border-t border-white/5">
        {waitingForInput ? (
          <div className="mb-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <p className="text-sm text-cyan-400">
              ⏳ 轮到 <span className="font-semibold">{waitingRoleName}</span> 发言，请输入内容...
            </p>
          </div>
        ) : (
          <div className="mb-3 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              {aiControlEnabled ? '💬 等待轮到你的角色发言...' : '🤖 AI自由行动模式，观察对话中...'}
            </p>
          </div>
        )}
        <div className="flex gap-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={waitingForInput ? `为 ${waitingRoleName} 输入消息...` : '等待轮到你的角色发言...'}
            disabled={!waitingForInput}
            className={`flex-1 bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none resize-none transition-all ${
              waitingForInput
                ? 'border-cyan-500/50 focus:border-cyan-500'
                : 'border-slate-700 opacity-50 cursor-not-allowed'
            }`}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!waitingForInput || !inputText.trim() || !ws || ws.readyState !== WebSocket.OPEN}
            className={`px-6 py-3 font-bold rounded-lg transition-all ${
              waitingForInput && inputText.trim()
                ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

