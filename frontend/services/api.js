const API_BASE = '/api';

export const api = {
  // 用户认证
  async login(userId, password, isGuest = false) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, password, is_guest: isGuest })
    });
    return response.json();
  },

  async register(userId, password, username) {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, password, username })
    });
    return response.json();
  },

  async getCurrentUser() {
    try {
      const response = await fetch(`${API_BASE}/user/me`, {
        credentials: 'include'
      });
      if (!response.ok) {
        // 401 或其他错误，返回未登录状态
        return { success: false, user: null };
      }
      return response.json();
    } catch (error) {
      console.error('getCurrentUser error:', error);
      // 网络错误或其他错误，返回未登录状态
      return { success: false, user: null };
    }
  },

  async logout() {
    try {
      const response = await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      return response.json();
    } catch (error) {
      console.error('logout error:', error);
      return { success: false, error: error.message };
    }
  },

  // 数字孪生
  async saveDigitalTwin(agentInfo) {
    const response = await fetch(`${API_BASE}/user/digital-twin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ agent_info: agentInfo })
    });
    return response.json();
  },

  async getDigitalTwin() {
    const response = await fetch(`${API_BASE}/user/digital-twin`, {
      credentials: 'include'
    });
    return response.json();
  },

  // 神经元匹配
  async neuralMatch() {
    const response = await fetch(`${API_BASE}/neural-match`, {
      method: 'POST',
      credentials: 'include'
    });
    return response.json();
  },

  // Agent 创建
  async createAgentFromText(userId, text) {
    const response = await fetch(`${API_BASE}/create-agent-from-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, text })
    });
    return response.json();
  },

  async createAgentFromQA(userId, answers) {
    const response = await fetch(`${API_BASE}/create-agent-from-qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, answers })
    });
    return response.json();
  },

  async createAgentFromFile(userId, file) {
    const formData = new FormData();
    formData.append('file', file);
    if (userId) formData.append('user_id', userId);

    const response = await fetch(`${API_BASE}/create-agent-from-file`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },

  async createUserAgent(userId) {
    // 生成唯一的role_code
    const roleCode = `user_${userId}_${Date.now()}`;
    const response = await fetch(`${API_BASE}/create-user-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        role_code: roleCode
      })
    });
    return response.json();
  },

  // 恢复用户 agent 到沙盒（从已保存的数字孪生数据）
  async restoreUserAgent(roleCode) {
    const response = await fetch(`${API_BASE}/restore-user-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role_code: roleCode })
    });
    return response.json();
  },

  // 添加预设NPC到沙盒
  async addPresetNPC(presetId, customName = null) {
    const response = await fetch(`${API_BASE}/add-preset-npc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset_id: presetId,
        custom_name: customName
      })
    });
    return response.json();
  },

  // 清空预设agents
  async clearPresetAgents() {
    const response = await fetch(`${API_BASE}/clear-preset-agents`, {
      method: 'POST',
      credentials: 'include'
    });
    return response.json();
  }
};

