import { useState, useEffect, useRef } from 'react';
import { Play, Square, User, Bot, UserCircle, FileText, X, Loader, LogOut, ArrowLeft, Trash2 } from 'lucide-react';

export default function ChatInterface({ selectedAgents = [], onUserClick, onBackToMatching, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiControlEnabled, setAiControlEnabled] = useState(true); // true=用户控制, false=AI自由行动
  const [waitingForInput, setWaitingForInput] = useState(false); // 是否正在等待用户输入
  const [waitingRoleName, setWaitingRoleName] = useState(''); // 等待输入的角色名称
  const [ws, setWs] = useState(null);
  const [userAgentRoleCode, setUserAgentRoleCode] = useState(null); // 用户agent的role_code
  const [reportData, setReportData] = useState(null); // 社交报告数据
  const [showReport, setShowReport] = useState(false); // 是否显示报告模态框
  const [generatingReport, setGeneratingReport] = useState(false); // 是否正在生成报告
  const [aiSuggestions, setAiSuggestions] = useState(null); // AI建议的选项
  const [loadingSuggestions, setLoadingSuggestions] = useState(false); // 是否正在加载建议
  const messagesEndRef = useRef(null);
  const clientId = useRef(Math.random().toString(36).substring(7));

  useEffect(() => {
    // 初始化 WebSocket 连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8001' : window.location.port;
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
      if (data.data.role_code) {
        setUserAgentRoleCode(data.data.role_code);
      }
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
    } else if (data.type === 'social_report_exported') {
      // 社交报告已生成
      console.log('✓ 社交报告已生成:', data.data);
      setReportData(data.data);
      setShowReport(true);
      setGeneratingReport(false);
    } else if (data.type === 'error') {
      // 错误消息，可能需要保持等待状态或取消
      console.error('错误:', data.data);
      if (generatingReport) {
        setGeneratingReport(false);
      }
      if (loadingSuggestions) {
        setLoadingSuggestions(false);
      }
    } else if (data.type === 'auto_complete_options') {
      // AI建议选项已生成
      console.log('✓ AI建议已生成:', data.data);
      setAiSuggestions(data.data.options);
      setLoadingSuggestions(false);
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

  const handleGenerateReport = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket未连接');
      return;
    }

    // 如果没有role_code，尝试从API获取
    let roleCode = userAgentRoleCode;
    if (!roleCode) {
      try {
        const userResult = await fetch('/api/user/me', { credentials: 'include' });
        if (userResult.ok) {
          const userData = await userResult.json();
          if (userData.success && userData.user) {
            // 尝试从数字孪生获取role_code
            const twinResult = await fetch('/api/user/digital-twin', { credentials: 'include' });
            if (twinResult.ok) {
              const twinData = await twinResult.json();
              if (twinData.success && twinData.agent_info && twinData.agent_info.role_code) {
                roleCode = twinData.agent_info.role_code;
                setUserAgentRoleCode(roleCode);
              }
            }
          }
        }
      } catch (error) {
        console.error('获取用户agent信息失败:', error);
      }
    }

    if (!roleCode) {
      alert('无法获取用户agent信息，请确保已创建数字孪生');
      return;
    }

    // 发送生成报告请求
    setGeneratingReport(true);
    ws.send(JSON.stringify({
      type: 'generate_social_report',
      agent_code: roleCode,
      format: 'text'
    }));
  };

  const handleClearMessages = () => {
    if (window.confirm('确定要清除所有聊天消息吗？')) {
      setMessages([]);
    }
  };

  const handleBackToMatching = () => {
    if (window.confirm('确定要返回匹配页吗？这将暂停当前对话。')) {
      onBackToMatching?.();
    }
  };

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      onLogout?.();
    }
  };

  const handleRequestSuggestions = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!waitingForInput) return;

    setLoadingSuggestions(true);
    ws.send(JSON.stringify({
      type: 'auto_complete'
    }));
  };

  const handleSelectSuggestion = (text) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'select_auto_option',
      selected_text: text
    }));

    setAiSuggestions(null); // 清除建议
  };

  const handleCloseSuggestions = () => {
    setAiSuggestions(null);
    setLoadingSuggestions(false);
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
            className={`px-3 py-1.5 text-xs font-mono rounded-full transition-all flex items-center gap-1.5 ${aiControlEnabled
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
          {/* 生成社交报告按钮 */}
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={generatingReport ? "正在生成报告..." : "生成社交报告"}
          >
            {generatingReport ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </button>
          {/* 清除聊天内容按钮 */}
          <button
            onClick={handleClearMessages}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="清除聊天内容"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          {/* 返回匹配页按钮 */}
          {onBackToMatching && (
            <button
              onClick={handleBackToMatching}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="返回匹配页"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {/* 退出登录按钮 */}
          {onLogout && (
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
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
                <div className={`max-w-[75%] rounded-lg p-4 ${msg.is_user
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

        {/* AI建议按钮 - 仅在等待输入且用户控制模式下显示 */}
        {waitingForInput && aiControlEnabled && !aiSuggestions && (
          <div className="mb-3 flex justify-end">
            <button
              onClick={handleRequestSuggestions}
              disabled={loadingSuggestions}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="让AI生成三个回复建议"
            >
              {loadingSuggestions ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span>AI建议</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* AI建议选项卡片 */}
        {aiSuggestions && aiSuggestions.length > 0 && (
          <div className="mb-4 bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                ✨ AI建议 - 选择一个回复
              </h3>
              <button
                onClick={handleCloseSuggestions}
                className="text-slate-400 hover:text-white transition-colors"
                title="关闭建议"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {aiSuggestions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(option.text)}
                  className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-purple-500/50 rounded-lg transition-all group"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${option.style === 'aggressive'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : option.style === 'balanced'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-green-500/20 text-green-300 border border-green-500/40'
                      }`}>
                      {option.name}
                    </span>
                    <span className="text-xs text-slate-400 flex-1">{option.description}</span>
                  </div>
                  <p className="text-sm text-slate-200 group-hover:text-white transition-colors leading-relaxed">
                    {option.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={waitingForInput ? `为 ${waitingRoleName} 输入消息...` : '等待轮到你的角色发言...'}
            disabled={!waitingForInput}
            className={`flex-1 bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none resize-none transition-all ${waitingForInput
              ? 'border-cyan-500/50 focus:border-cyan-500'
              : 'border-slate-700 opacity-50 cursor-not-allowed'
              }`}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!waitingForInput || !inputText.trim() || !ws || ws.readyState !== WebSocket.OPEN}
            className={`px-6 py-3 font-bold rounded-lg transition-all ${waitingForInput && inputText.trim()
              ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
          >
            发送
          </button>
        </div>
      </div>

      {/* 社交报告模态框 */}
      {showReport && reportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col">
            {/* 模态框头部 */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">社交报告</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {reportData.agent_code || '用户Agent'} · {reportData.timestamp || new Date().toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowReport(false);
                  setReportData(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 报告内容 */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="prose prose-invert max-w-none">
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {reportData.report_text || reportData.report || '报告内容为空'}
                </div>
              </div>
            </div>

            {/* 模态框底部 */}
            <div className="p-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setShowReport(false);
                  setReportData(null);
                }}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

