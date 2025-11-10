/**
 * Soulverse功能面板
 * 包含：创建Agent、观察者模式、灵魂降临模式、社交日报等功能
 */
class SoulversePanel {
    constructor() {
        this.currentAgentCode = null;
        this.possessionMode = false;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.createModeIndicator();
    }

    createModeIndicator() {
        // 在顶部创建模式指示器（只显示状态，不提供切换按钮）
        // 初始状态隐藏，只有在选择角色后才显示
        const indicator = document.createElement('div');
        indicator.className = 'mode-indicator';
        indicator.id = 'modeIndicator';
        indicator.style.display = 'none';  // 初始隐藏
        indicator.innerHTML = `
            <span class="mode-badge" id="modeBadge">未选择角色</span>
            <span class="mode-role-name" id="modeRoleName" style="display: none;"></span>
        `;
        document.body.appendChild(indicator);
    }

    createUI() {
        // 在右侧工具栏添加"创建Agent"和"加载预设NPC"按钮
        const rightToolbar = document.querySelector('.right-toolbar');
        if (rightToolbar) {
            const createBtn = document.createElement('button');
            createBtn.className = 'tab-btn';
            createBtn.id = 'createAgentBtnMain';
            createBtn.innerHTML = '<i class="fas fa-plus-circle"></i> 创建我的Agent';
            createBtn.style.cssText = 'background: #4CAF50; color: white; border: none;';
            // 插入到第一个位置
            rightToolbar.insertBefore(createBtn, rightToolbar.firstChild);
            
            const loadPresetBtn = document.createElement('button');
            loadPresetBtn.className = 'tab-btn';
            loadPresetBtn.id = 'loadPresetNPCBtn';
            loadPresetBtn.innerHTML = '<i class="fas fa-users"></i> 加载预设NPC';
            loadPresetBtn.style.cssText = 'background: #2196F3; color: white; border: none;';
            // 插入到第二个位置
            rightToolbar.insertBefore(loadPresetBtn, rightToolbar.children[1]);
        }

        // 创建创建Agent的模态框
        this.createAgentModal();
        
        // 创建加载预设NPC的模态框
        this.createPresetNPCModal();
    }

    createAgentModal() {
        // 创建模态框HTML
        const modalHTML = `
            <div id="createAgentModal" class="soulverse-modal hidden" aria-hidden="true">
                <div class="soulverse-modal-overlay"></div>
                <div class="soulverse-modal-card" id="createAgentModalCard">
                    <div class="soulverse-modal-loading" id="createAgentLoading">
                        <div class="loading-spinner"></div>
                        <div class="loading-text" id="loadingText">正在创建Agent...</div>
                        <div class="loading-subtext" id="loadingSubtext">这可能需要几秒钟时间，请稍候</div>
                    </div>
                    <button class="soulverse-modal-close" aria-label="关闭" id="createAgentModalClose">&times;</button>
                    <div class="soulverse-modal-content">
                        <div class="soulverse-modal-header">
                            <h2>创建我的AI Agent</h2>
                            <p class="modal-subtitle">创建一个代表你的数字孪生Agent，让它自主在虚拟世界中社交</p>
                        </div>
                        
                        <div class="soulverse-modal-body">
                            <!-- 创建方式选择 -->
                            <div class="create-method-tabs">
                                <button class="method-tab active" data-method="simple">
                                    <i class="fas fa-bolt"></i> 快速创建
                                </button>
                                <button class="method-tab" data-method="text">
                                    <i class="fas fa-file-text"></i> 从文本
                                </button>
                                <button class="method-tab" data-method="file">
                                    <i class="fas fa-upload"></i> 上传文件
                                </button>
                                <button class="method-tab" data-method="qa">
                                    <i class="fas fa-question-circle"></i> 问答创建
                                </button>
                            </div>
                            
                            <!-- 快速创建 -->
                            <div class="create-method-content" id="method-simple">
                                <div class="info-box">
                                    <i class="fas fa-info-circle"></i>
                                    <span>快速创建会随机生成一个Agent，适合快速体验。后续可以通过其他方式创建更个性化的Agent。</span>
                                </div>
                                <div class="form-group">
                                    <label>Agent名称 <span class="label-hint">(用于标识你的Agent)</span>:</label>
                                    <input type="text" id="userIdInput" placeholder="例如：我的第一个Agent" />
                                </div>
                                <button id="createAgentBtn" class="soulverse-btn primary">
                                    <i class="fas fa-magic"></i> 快速创建
                                </button>
                            </div>
                            
                            <!-- 从文本创建 -->
                            <div class="create-method-content" id="method-text" style="display: none;">
                                <div class="info-box">
                                    <i class="fas fa-info-circle"></i>
                                    <span>粘贴你的聊天记录、自述或其他文本，AI会自动分析你的兴趣、性格和社交目标。</span>
                                </div>
                                <div class="form-group">
                                    <label>Agent名称:</label>
                                    <input type="text" id="userIdInputText" placeholder="例如：我的AI分身" />
                                </div>
                                <div class="form-group">
                                    <label>输入文本:</label>
                                    <textarea id="textInput" rows="10" placeholder="粘贴你的聊天记录、自述或其他能表现你特点的文本...&#10;&#10;例如：&#10;我喜欢看电影，特别是科幻和悬疑类型的。平时也喜欢听音乐，主要是摇滚和民谣。周末喜欢去咖啡馆看书，或者和朋友一起旅行。我比较内向，但和志同道合的人在一起时会很健谈..."></textarea>
                                </div>
                                <button id="createFromTextBtn" class="soulverse-btn primary">
                                    <i class="fas fa-file-text"></i> 从文本创建
                                </button>
                            </div>
                            
                            <!-- 上传文件创建 -->
                            <div class="create-method-content" id="method-file" style="display: none;">
                                <div class="info-box">
                                    <i class="fas fa-info-circle"></i>
                                    <span>上传包含你聊天记录、自述或其他文本的文件，支持 .txt, .json, .jsonl 格式。</span>
                                </div>
                                <div class="form-group">
                                    <label>Agent名称 <span class="label-hint">(可选，留空自动生成)</span>:</label>
                                    <input type="text" id="userIdInputFile" placeholder="留空自动生成" />
                                </div>
                                <div class="form-group">
                                    <label>上传文件:</label>
                                    <div class="file-upload-area" id="fileUploadArea">
                                        <i class="fas fa-cloud-upload-alt"></i>
                                        <p>点击选择文件或拖拽文件到此处</p>
                                        <small>支持 .txt, .json, .jsonl 格式</small>
                                        <input type="file" id="fileInput" accept=".txt,.json,.jsonl" style="display: none;" />
                                    </div>
                                    <div id="fileInfo" class="file-info" style="display: none;"></div>
                                </div>
                                <button id="createFromFileBtn" class="soulverse-btn primary">
                                    <i class="fas fa-upload"></i> 从文件创建
                                </button>
                            </div>
                            
                            <!-- 问答创建 -->
                            <div class="create-method-content" id="method-qa" style="display: none;">
                                <div class="info-box">
                                    <i class="fas fa-info-circle"></i>
                                    <span>回答几个简单问题，AI会根据你的回答创建一个个性化的Agent。</span>
                                </div>
                                <div class="form-group">
                                    <label>Agent名称:</label>
                                    <input type="text" id="userIdInputQA" placeholder="例如：我的AI分身" />
                                </div>
                                <div class="qa-questions">
                                    <div class="form-group">
                                        <label>你的兴趣爱好是什么？</label>
                                        <textarea id="qaInterests" rows="3" placeholder="例如：我喜欢看电影、听音乐、旅行、阅读科幻小说..."></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>你的性格特点？</label>
                                        <textarea id="qaPersonality" rows="3" placeholder="例如：我比较内向，喜欢独处思考，但也喜欢和志同道合的人深度交流..."></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>你的社交目标？</label>
                                        <textarea id="qaSocialGoals" rows="3" placeholder="例如：我想找到一起看电影的朋友，讨论电影和文学，或者一起旅行..."></textarea>
                                    </div>
                                </div>
                                <button id="createFromQABtn" class="soulverse-btn primary">
                                    <i class="fas fa-question-circle"></i> 通过问答创建
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 设置事件监听
        this.setupModalEvents();
    }

    setupModalEvents() {
        const modal = document.getElementById('createAgentModal');
        const overlay = modal?.querySelector('.soulverse-modal-overlay');
        const closeBtn = modal?.querySelector('.soulverse-modal-close');
        const createBtnMain = document.getElementById('createAgentBtnMain');
        
        // 打开模态框
        if (createBtnMain) {
            createBtnMain.addEventListener('click', () => this.openModal());
        }
        
        // 关闭模态框
        const closeModal = () => this.closeModal();
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }

    openModal() {
        const modal = document.getElementById('createAgentModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeModal() {
        const modal = document.getElementById('createAgentModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            // 重置加载状态
            this.hideLoading();
        }
    }

    showLoading(message = '正在处理...', submessage = '这可能需要几秒钟时间，请稍候') {
        const loading = document.getElementById('createAgentLoading');
        const loadingText = document.getElementById('loadingText');
        const loadingSubtext = document.getElementById('loadingSubtext');
        const modalCard = document.getElementById('createAgentModalCard');
        const closeBtn = document.getElementById('createAgentModalClose');
        
        if (loading) {
            loadingText.textContent = message;
            loadingSubtext.textContent = submessage;
            loading.classList.add('active');
        }
        if (modalCard) {
            modalCard.classList.add('loading');
        }
        if (closeBtn) {
            closeBtn.style.pointerEvents = 'none';
            closeBtn.style.opacity = '0.5';
        }
    }

    hideLoading() {
        const loading = document.getElementById('createAgentLoading');
        const modalCard = document.getElementById('createAgentModalCard');
        const closeBtn = document.getElementById('createAgentModalClose');
        
        if (loading) {
            loading.classList.remove('active');
        }
        if (modalCard) {
            modalCard.classList.remove('loading');
        }
        if (closeBtn) {
            closeBtn.style.pointerEvents = '';
            closeBtn.style.opacity = '';
        }
    }

    createPresetNPCModal() {
        // 创建加载预设NPC的模态框HTML
        const modalHTML = `
            <div id="loadPresetNPCModal" class="soulverse-modal hidden" aria-hidden="true">
                <div class="soulverse-modal-overlay"></div>
                <div class="soulverse-modal-card">
                    <button class="soulverse-modal-close" aria-label="关闭">&times;</button>
                    <div class="soulverse-modal-content">
                        <div class="soulverse-modal-header">
                            <h2>加载预设NPC Agent</h2>
                            <p class="modal-subtitle">选择预设的NPC Agent加入沙盒，它们会与你的Agent进行社交互动</p>
                        </div>
                        
                        <div class="soulverse-modal-body">
                            <div class="info-box">
                                <i class="fas fa-info-circle"></i>
                                <span>预设NPC是已经配置好的Agent，用于丰富社交环境。你可以选择多个NPC加入沙盒，它们会自主与你的Agent互动。</span>
                            </div>
                            <div id="presetNPCList" class="preset-agents-grid">
                                <!-- 预设NPC卡片将动态加载 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 设置事件监听
        this.setupPresetNPCModalEvents();
    }

    setupPresetNPCModalEvents() {
        const modal = document.getElementById('loadPresetNPCModal');
        const overlay = modal?.querySelector('.soulverse-modal-overlay');
        const closeBtn = modal?.querySelector('.soulverse-modal-close');
        const loadPresetBtn = document.getElementById('loadPresetNPCBtn');
        
        // 打开模态框
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', () => this.openPresetNPCModal());
        }
        
        // 关闭模态框
        const closeModal = () => this.closePresetNPCModal();
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }

    openPresetNPCModal() {
        const modal = document.getElementById('loadPresetNPCModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            // 加载预设列表
            this.loadPresetNPCs();
        }
    }

    closePresetNPCModal() {
        const modal = document.getElementById('loadPresetNPCModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    setupEventListeners() {
        // 创建方式标签切换
        const methodTabs = document.querySelectorAll('.method-tab');
        methodTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const method = tab.getAttribute('data-method');
                this.switchCreateMethod(method);
            });
        });

        // 创建Agent按钮
        const createBtn = document.getElementById('createAgentBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createUserAgent());
        }

        // 从文本创建
        const createFromTextBtn = document.getElementById('createFromTextBtn');
        if (createFromTextBtn) {
            createFromTextBtn.addEventListener('click', () => this.createAgentFromText());
        }

        // 从文件创建
        const createFromFileBtn = document.getElementById('createFromFileBtn');
        if (createFromFileBtn) {
            createFromFileBtn.addEventListener('click', () => this.createAgentFromFile());
        }

        // 文件上传区域
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        if (fileUploadArea && fileInput) {
            fileUploadArea.addEventListener('click', () => fileInput.click());
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('drag-over');
            });
            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('drag-over');
            });
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }

        // 从问答创建
        const createFromQABtn = document.getElementById('createFromQABtn');
        if (createFromQABtn) {
            createFromQABtn.addEventListener('click', () => this.createAgentFromQA());
        }

        // 查看故事按钮
        const viewStoryBtn = document.getElementById('viewStoryBtn');
        if (viewStoryBtn) {
            viewStoryBtn.addEventListener('click', () => this.viewSocialStory());
        }

        // 查看日报按钮
        const viewDailyBtn = document.getElementById('viewDailyReportBtn');
        if (viewDailyBtn) {
            viewDailyBtn.addEventListener('click', () => this.viewDailyReport());
        }

        // 切换灵魂降临模式
        const toggleBtn = document.getElementById('togglePossessionBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.togglePossessionMode());
        }

        // Agent选择变化
        const agentSelect = document.getElementById('agentSelect');
        if (agentSelect) {
            agentSelect.addEventListener('change', (e) => {
                this.currentAgentCode = e.target.value;
                this.updateUI();
            });
        }

        // 监听WebSocket消息
        window.addEventListener('websocket-message', (event) => {
            const message = event.detail;
            if (message.type === 'role_selected') {
                this.handleRoleSelected(message.data);
            } else if (message.type === 'role_selection_cleared') {
                this.handleRoleSelectionCleared();
            } else if (message.type === 'possession_mode_changed') {
                // 保留兼容性，但通常不应该被触发
                this.handlePossessionModeChanged(message.data);
            }
        });
    }

    switchCreateMethod(method) {
        // 切换标签状态
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');

        // 切换内容显示
        document.querySelectorAll('.create-method-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`method-${method}`).style.display = 'block';
    }

    async loadPresetNPCs() {
        const presetList = document.getElementById('presetNPCList');
        if (!presetList) return;
        
        try {
            const response = await fetch('/api/list-preset-agents');
            const result = await response.json();
            
            if (result.success && result.templates) {
                this.renderPresetNPCs(result.templates);
            }
        } catch (error) {
            console.error('Error loading preset NPCs:', error);
        }
    }

    renderPresetNPCs(templates) {
        const presetList = document.getElementById('presetNPCList');
        if (!presetList) return;
        
        presetList.innerHTML = '';
        
        templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'preset-agent-card';
            card.setAttribute('data-preset-id', template.id);
            
            const tags = template.tags.map(tag => `<span class="preset-tag">${tag}</span>`).join('');
            const interests = template.interests.slice(0, 4).join(' · ');
            
            card.innerHTML = `
                <div class="preset-card-header">
                    <span class="preset-icon">${template.icon}</span>
                    <h3>${template.name}</h3>
                </div>
                <p class="preset-description">${template.description}</p>
                <div class="preset-details">
                    <div class="preset-detail-item">
                        <i class="fas fa-heart"></i>
                        <span>${interests}${template.interests.length > 4 ? '...' : ''}</span>
                    </div>
                    <div class="preset-detail-item">
                        <i class="fas fa-user"></i>
                        <span>${template.mbti}</span>
                    </div>
                    <div class="preset-detail-item">
                        <i class="fas fa-bullseye"></i>
                        <span>${template.social_goals[0]}</span>
                    </div>
                </div>
                <div class="preset-tags">${tags}</div>
                <div class="preset-card-actions">
                    <button class="preset-add-btn" data-preset-id="${template.id}">
                        <i class="fas fa-plus"></i> 加入沙盒
                    </button>
                </div>
            `;
            
            // 添加按钮点击事件
            const addBtn = card.querySelector('.preset-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addPresetNPC(template);
                });
            }
            
            presetList.appendChild(card);
        });
    }

    async addPresetNPC(template) {
        try {
            const response = await fetch('/api/add-preset-npc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    preset_id: template.id,
                    custom_name: null  // 使用预设名称
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.showSuccessMessage(`NPC Agent已加入沙盒！\n名称: ${result.agent_info.nickname}\n位置: ${result.agent_info.location}`);
                
                // 立即通过WebSocket请求更新角色列表
                if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                    window.ws.send(JSON.stringify({
                        type: 'request_characters'
                    }));
                }
                
                // 刷新Agent列表
                this.updateAgentList();
            } else {
                alert('添加失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            console.error('Error adding preset NPC:', error);
            alert('添加失败: ' + error.message);
        }
    }

    async createAgentFromText() {
        const userId = document.getElementById('userIdInputText')?.value;
        const text = document.getElementById('textInput')?.value;
        const createBtn = document.getElementById('createFromTextBtn');

        if (!userId || !userId.trim()) {
            alert('请填写Agent名称');
            return;
        }

        if (!text || !text.trim()) {
            alert('请输入文本内容');
            return;
        }

        // 显示加载状态
        this.showLoading('正在分析文本...', 'AI正在从文本中提取你的兴趣、性格和社交目标，请稍候');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.classList.add('loading');
        }

        try {
            const response = await fetch('/api/create-agent-from-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId.trim(),
                    text: text.trim()
                })
            });

            // 更新加载提示
            this.showLoading('正在创建Agent...', '正在将提取的信息转换为Agent配置');

            const result = await response.json();
            
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }

            if (result.success) {
                this.showSuccessMessage(`Agent创建成功！\n名称: ${result.agent_info.nickname}\n位置: ${result.agent_info.location}`);
                // 清空输入
                document.getElementById('textInput').value = '';
                // 关闭模态框
                this.closeModal();
                
                // 如果响应中包含角色列表，立即更新
                if (result.characters && Array.isArray(result.characters)) {
                    // 直接更新角色列表
                    if (window.characterProfiles) {
                        window.characterProfiles.updateCharacters(result.characters);
                    }
                    this.updateAgentListFromData(result.characters);
                } else {
                    // 否则通过WebSocket请求更新
                    this.refreshCharacterList();
                }
            } else {
                alert('创建失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            console.error('Error creating agent from text:', error);
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }
            alert('创建失败: ' + error.message);
        }
    }

    async createAgentFromFile() {
        const fileInput = document.getElementById('fileInput');
        const userId = document.getElementById('userIdInputFile')?.value;
        const createBtn = document.getElementById('createFromFileBtn');

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('请选择文件');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        if (userId && userId.trim()) {
            formData.append('user_id', userId.trim());
        }

        // 显示加载状态
        this.showLoading('正在上传文件...', `正在上传 "${file.name}"，请稍候`);
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.classList.add('loading');
        }

        try {
            // 更新加载提示
            this.showLoading('正在分析文件内容...', 'AI正在从文件中提取你的兴趣、性格和社交目标，这可能需要几秒钟');

            const response = await fetch('/api/create-agent-from-file', {
                method: 'POST',
                body: formData
            });

            // 更新加载提示
            this.showLoading('正在创建Agent...', '正在将提取的信息转换为Agent配置');

            const result = await response.json();
            
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }

            if (result.success) {
                this.showSuccessMessage(`Agent创建成功！\n名称: ${result.agent_info.nickname}\n位置: ${result.agent_info.location}`);
                // 清空文件选择
                fileInput.value = '';
                // 关闭模态框
                this.closeModal();
                
                // 如果响应中包含角色列表，立即更新
                if (result.characters && Array.isArray(result.characters)) {
                    // 直接更新角色列表
                    if (window.characterProfiles) {
                        window.characterProfiles.updateCharacters(result.characters);
                    }
                    this.updateAgentListFromData(result.characters);
                } else {
                    // 否则通过WebSocket请求更新
                    this.refreshCharacterList();
                }
            } else {
                alert('创建失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            console.error('Error creating agent from file:', error);
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }
            alert('创建失败: ' + error.message);
        }
    }

    async createAgentFromQA() {
        const userId = document.getElementById('userIdInputQA')?.value;
        const interests = document.getElementById('qaInterests')?.value;
        const personality = document.getElementById('qaPersonality')?.value;
        const socialGoals = document.getElementById('qaSocialGoals')?.value;
        const createBtn = document.getElementById('createFromQABtn');

        if (!userId || !userId.trim()) {
            alert('请填写Agent名称');
            return;
        }

        const answers = {};
        if (interests && interests.trim()) {
            answers.interests = interests.trim();
        }
        if (personality && personality.trim()) {
            answers.personality = personality.trim();
        }
        if (socialGoals && socialGoals.trim()) {
            answers.social_goals = socialGoals.trim();
        }

        if (Object.keys(answers).length === 0) {
            alert('请至少填写一个问题');
            return;
        }

        // 显示加载状态
        this.showLoading('正在分析回答...', 'AI正在从你的回答中提取兴趣、性格和社交目标，请稍候');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.classList.add('loading');
        }

        try {
            const response = await fetch('/api/create-agent-from-qa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId.trim(),
                    answers: answers
                })
            });

            // 更新加载提示
            this.showLoading('正在创建Agent...', '正在将提取的信息转换为Agent配置');

            const result = await response.json();
            
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }

            if (result.success) {
                this.showSuccessMessage(`Agent创建成功！\n名称: ${result.agent_info.nickname}\n位置: ${result.agent_info.location}`);
                // 清空输入
                document.getElementById('qaInterests').value = '';
                document.getElementById('qaPersonality').value = '';
                document.getElementById('qaSocialGoals').value = '';
                // 关闭模态框
                this.closeModal();
                
                // 如果响应中包含角色列表，立即更新
                if (result.characters && Array.isArray(result.characters)) {
                    // 直接更新角色列表
                    if (window.characterProfiles) {
                        window.characterProfiles.updateCharacters(result.characters);
                    }
                    this.updateAgentListFromData(result.characters);
                } else {
                    // 否则通过WebSocket请求更新
                    this.refreshCharacterList();
                }
            } else {
                alert('创建失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            console.error('Error creating agent from QA:', error);
            // 隐藏加载状态
            this.hideLoading();
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.classList.remove('loading');
            }
            alert('创建失败: ' + error.message);
        }
    }

    async createUserAgent() {
        const userId = document.getElementById('userIdInput')?.value;

        if (!userId || !userId.trim()) {
            alert('请填写Agent名称');
            return;
        }
        
        // 自动生成roleCode
        const finalRoleCode = `agent_${userId.trim().replace(/\s+/g, '_')}_${Date.now()}`;

        try {
            const response = await fetch('/api/create-user-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId.trim(),
                    role_code: finalRoleCode
                })
            });

            const result = await response.json();
            if (result.success) {
                // 显示成功消息
                this.showSuccessMessage(`Agent创建成功！\n名称: ${result.agent_info.nickname}\n位置: ${result.agent_info.location}`);
                
                // 关闭模态框
                this.closeModal();
                
                // 如果响应中包含角色列表，立即更新
                if (result.characters && Array.isArray(result.characters)) {
                    // 直接更新角色列表
                    if (window.characterProfiles) {
                        window.characterProfiles.updateCharacters(result.characters);
                    }
                    this.updateAgentListFromData(result.characters);
                } else {
                    // 否则通过WebSocket请求更新
                    this.refreshCharacterList();
                }
                
                // 自动选择新创建的Agent
                this.currentAgentCode = finalRoleCode;
                const agentSelect = document.getElementById('agentSelect');
                if (agentSelect) {
                    agentSelect.value = finalRoleCode;
                }
                
                // 触发角色列表更新事件
                window.dispatchEvent(new CustomEvent('agent-created', {
                    detail: result.agent_info
                }));
                
                this.updateUI();
            } else {
                alert('创建失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('创建Agent错误:', error);
            alert('创建Agent时出错: ' + error.message);
        }
    }

    showSuccessMessage(message) {
        // 创建临时提示框
        const toast = document.createElement('div');
        toast.className = 'soulverse-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async viewSocialStory() {
        if (!this.currentAgentCode) {
            alert('请先选择Agent');
            return;
        }

        try {
            const response = await fetch(`/api/get-social-story/${this.currentAgentCode}?hours=24`);
            const result = await response.json();

            if (result.success) {
                const storyDisplay = document.getElementById('storyDisplay');
                const storyContent = document.getElementById('storyContent');
                
                if (storyDisplay && storyContent) {
                    // 改进的展示方式：时间线视图
                    const stats = result.data.stats || {};
                    const keyEvents = result.data.key_events || [];
                    
                    let html = `
                        <div class="story-header">
                            <h4>社交故事 (最近24小时)</h4>
                            <div class="story-stats">
                                <span class="stat-item">互动: ${stats.total_interactions || 0}次</span>
                                <span class="stat-item">朋友: ${stats.unique_contacts_count || 0}位</span>
                                <span class="stat-item">移动: ${stats.total_movements || 0}次</span>
                            </div>
                        </div>
                        <div class="timeline-container">
                    `;
                    
                    // 时间线展示
                    keyEvents.forEach(event => {
                        const eventType = event.type === 'interaction' ? '💬 互动' : 
                                         event.type === 'movement' ? '🚶 移动' : 
                                         event.type === 'goal' ? '🎯 目标' : '📝 事件';
                        html += `
                            <div class="timeline-item">
                                <div class="timeline-time">${event.time || ''}</div>
                                <div class="timeline-content">
                                    <div class="timeline-type">${eventType}</div>
                                    <div class="timeline-detail">${event.detail || ''}</div>
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                    
                    // 如果没有关键事件，显示完整故事文本
                    if (keyEvents.length === 0 && result.data.story_text) {
                        html += `
                            <div class="story-text">
                                <pre>${result.data.story_text}</pre>
                            </div>
                        `;
                    }
                    
                    storyContent.innerHTML = html;
                    storyDisplay.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('获取社交故事错误:', error);
            alert('获取社交故事时出错: ' + error.message);
        }
    }

    async viewDailyReport() {
        if (!this.currentAgentCode) {
            alert('请先选择Agent');
            return;
        }

        try {
            const response = await fetch(`/api/get-daily-report/${this.currentAgentCode}`);
            const result = await response.json();

            if (result.success) {
                const storyDisplay = document.getElementById('storyDisplay');
                const storyContent = document.getElementById('storyContent');
                
                if (storyDisplay && storyContent) {
                    storyContent.innerHTML = `
                        <div class="daily-report">
                            <h4>${result.data.date} 社交日报</h4>
                            <div class="report-summary">
                                <p>${result.data.summary}</p>
                            </div>
                            <div class="report-highlights">
                                <h5>今日亮点:</h5>
                                <ul>
                                    ${result.data.highlights.map(h => `<li>${h}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="report-text">
                                <pre>${result.data.report_text}</pre>
                            </div>
                        </div>
                    `;
                    storyDisplay.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('获取日报错误:', error);
            alert('获取日报时出错: ' + error.message);
        }
    }

    // 移除独立的模式切换功能，模式由角色选择自动决定
    // 如果需要切换模式，用户应该取消选择当前角色或选择其他角色

    handleRoleSelected(data) {
        this.currentAgentCode = data.role_code;
        this.possessionMode = data.possession_mode || false;
        this.updateModeIndicator(data.role_name, data.possession_mode);
        this.updateUI();
    }

    handleRoleSelectionCleared() {
        // 角色选择被清除
        this.currentAgentCode = null;
        this.possessionMode = false;
        this.updateModeIndicator(null, false);
        this.updateUI();
    }

    handlePossessionModeChanged(data) {
        // 这个事件现在不应该被独立触发，因为模式由角色选择决定
        // 但保留以兼容可能的其他调用
        this.possessionMode = data.possession_mode || false;
        this.updateUI();
    }

    updateModeIndicator(roleName = null, possessionMode = false) {
        const modeBadge = document.getElementById('modeBadge');
        const modeRoleName = document.getElementById('modeRoleName');
        const indicator = document.getElementById('modeIndicator');
        
        if (!modeBadge || !indicator) return;
        
        if (!roleName) {
            // 未选择角色 - 隐藏指示器
            indicator.style.display = 'none';
        } else {
            // 有角色选择 - 显示指示器
            indicator.style.display = 'flex';
            
            if (possessionMode) {
                // 灵魂降临模式（选择了用户Agent）
                modeBadge.textContent = '灵魂降临模式';
                modeBadge.className = 'mode-badge possession';
                if (modeRoleName) {
                    modeRoleName.textContent = `· ${roleName}`;
                    modeRoleName.style.display = 'inline';
                }
            } else {
                // 观察者模式（选择了其他角色）
                modeBadge.textContent = '观察者模式';
                modeBadge.className = 'mode-badge observer';
                if (modeRoleName) {
                    modeRoleName.textContent = `· ${roleName}`;
                    modeRoleName.style.display = 'inline';
                }
            }
        }
    }

    refreshCharacterList() {
        // 统一的方法：刷新角色列表
        // 通过WebSocket请求最新的角色列表
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            // 发送请求
            window.ws.send(JSON.stringify({
                type: 'request_characters'
            }));
            console.log('已请求更新角色列表');
        } else {
            console.warn('WebSocket未连接，无法刷新角色列表');
            // 如果WebSocket未连接，尝试直接使用REST API获取
            this.fetchCharacterListFromAPI();
        }
    }

    async fetchCharacterListFromAPI() {
        // 备用方案：通过REST API获取角色列表（如果WebSocket不可用）
        try {
            // 注意：目前没有REST API端点，所以这个方法暂时不实现
            // 如果未来需要，可以添加 /api/get-characters 端点
            console.warn('WebSocket不可用，无法获取角色列表');
        } catch (error) {
            console.error('获取角色列表失败:', error);
        }
    }

    updateAgentList() {
        // 从角色列表更新Agent选择下拉框
        // 这个方法现在只负责更新UI，不主动请求数据
        // 数据更新由refreshCharacterList()和WebSocket消息处理来完成
        const agentSelect = document.getElementById('agentSelect');
        if (!agentSelect) return;

        // 如果已有角色列表数据，直接更新
        if (window.characterProfiles && window.characterProfiles.characters) {
            this.updateAgentListFromData(window.characterProfiles.characters);
        }
    }

    updateAgentListFromData(characters) {
        // 直接从数据更新Agent列表（不发送WebSocket请求）
        const agentSelect = document.getElementById('agentSelect');
        if (!agentSelect) return;

        // 清空现有选项（除了第一个）
        while (agentSelect.children.length > 1) {
            agentSelect.removeChild(agentSelect.lastChild);
        }
        
        // 如果没有Agent，显示提示
        if (!characters || characters.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "-- 请先创建Agent --";
            option.disabled = true;
            agentSelect.appendChild(option);
            return;
        }
        
        // 只显示用户创建的Agent（is_user_agent === true）
        const userAgents = characters.filter(char => char.is_user_agent === true);
        
        if (userAgents.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "-- 请先创建你的Agent --";
            option.disabled = true;
            agentSelect.appendChild(option);
            return;
        }
        
        userAgents.forEach(char => {
            const option = document.createElement('option');
            option.value = char.code || char.name || char.id;
            option.textContent = char.name;
            agentSelect.appendChild(option);
        });
    }

    updateUI() {
        // 更新UI状态
        const observerSection = document.getElementById('observer-section');
        const possessionSection = document.getElementById('possession-section');
        const possessionStatus = document.getElementById('possessionStatus');
        const toggleBtn = document.getElementById('togglePossessionBtn');

        if (this.currentAgentCode) {
            if (observerSection) observerSection.style.display = 'block';
            if (possessionSection) possessionSection.style.display = 'block';
        }

        if (possessionStatus) {
            possessionStatus.textContent = `当前模式: ${this.possessionMode ? '灵魂降临' : '观察者'}`;
            possessionStatus.className = this.possessionMode ? 'possession-status active' : 'possession-status';
        }

        if (toggleBtn) {
            toggleBtn.textContent = this.possessionMode ? '退出灵魂降临' : '进入灵魂降临';
        }

        // 更新模式指示器
        this.updateModeIndicator();
    }
}

// 初始化Soulverse面板
document.addEventListener('DOMContentLoaded', () => {
    window.soulversePanel = new SoulversePanel();
});
