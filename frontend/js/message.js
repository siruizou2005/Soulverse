// message.js
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.querySelector('.chat-messages');
    const textarea = document.querySelector('textarea');
    const sendButton = document.querySelector('.send-btn');
    const controlBtn = document.getElementById('controlBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportStoryBtn = document.getElementById('exportStoryBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');
    
    // 生成随机的客户端ID
    const clientId = Math.random().toString(36).substring(7);
    
    // WebSocket连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${clientId}`);
    window.ws = ws

    let isPlaying = false;
    let startButtonText =  translations[window.i18n.currentLang]['start'];
    // 全局编辑状态，避免为每条消息注册 document 监听
    let currentEditingMessage = null;
    let currentEditingOriginalText = '';
    // 用户选择的角色
    let selectedRoleName = null;
    let waitingForInput = false;
    const autoCompleteBtn = document.getElementById('autoCompleteBtn');
    // 控制按钮点击事件
    controlBtn.addEventListener('click', function() {
        if (!isPlaying) {
            // 开始
            ws.send(JSON.stringify({
                type: 'control',
                action: 'start'
            }));
            startButtonText =  translations[window.i18n.currentLang]['pause']
            controlBtn.innerHTML = `<i class="fas fa-pause"></i><span data-i18n="pause">${startButtonText}</span>`;
            isPlaying = true;
        } else {
            // 暂停
            ws.send(JSON.stringify({
                type: 'control',
                action: 'pause'
            }));
            startButtonText =  translations[window.i18n.currentLang]['start']
            controlBtn.innerHTML = `<i class="fas fa-play"></i><span data-i18n="pause">${startButtonText}</span>`;
            isPlaying = false;
        }
    });

    // 停止按钮点击事件
    stopBtn.addEventListener('click', function() {
        ws.send(JSON.stringify({
            type: 'control',
            action: 'stop'
        }));
        controlBtn.innerHTML = '<i class="fas fa-play"></i><span>开始</span>';
        isPlaying = false;
    });

    // WebSocket事件处理
    ws.onopen = function() {
        console.log('WebSocket连接已建立');
        addSystemMessage('连接已建立');
    };
    
    ws.onclose = function() {
        console.log('WebSocket连接已关闭');
        addSystemMessage('连接已断开');
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket错误:', error);
        addSystemMessage('连接错误');
    };
    
    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);
        
        // 处理系统重置消息（优先处理）
        if (message.type === 'system_reset') {
            addSystemMessage(message.message || '系统已重置');
            // 清空聊天记录
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            // 重置UI状态
            isPlaying = false;
            waitingForInput = false;
            selectedRoleName = null;
            window.selectedRoleName = null;
            controlBtn.innerHTML = '<i class="fas fa-play"></i><span data-i18n="start">开始</span>';
            // 延迟重新加载页面以完全重置状态
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            return;
        }
        
        // 创建自定义事件来分发 WebSocket 消息
        const wsEvent = new CustomEvent('websocket-message', {
            detail: message
        });
        window.dispatchEvent(wsEvent);

        // 消息处理逻辑
        if (message.type === 'waiting_for_user_input') {
            // 等待用户输入
            waitingForInput = true;
            textarea.placeholder = `请输入 ${message.data.role_name} 的内容...`;
            textarea.disabled = false;
            textarea.focus();
            // 更新发送按钮状态
            updateSendButtonState();
            // 显示AI自动完成按钮
            if (autoCompleteBtn) {
                autoCompleteBtn.style.display = 'flex';
                autoCompleteBtn.title = window.i18n?.get('autoComplete') ?? 'AI自动完成';
            }
            addSystemMessage(`等待输入：${message.data.role_name} - ${message.data.message}`);
        }
        else if (message.type === 'role_selected') {
            // 角色选择成功
            selectedRoleName = message.data.role_name;
            window.selectedRoleName = message.data.role_name;
            addSystemMessage(message.data.message);
            
            // 触发角色列表重新渲染，使选中的角色置顶
            if (window.characterProfiles && window.characterProfiles.characters) {
                window.characterProfiles.renderCharacters(window.characterProfiles.characters);
            }
            
            // 查找并显示选中的角色
            if (window.characterProfiles) {
                const allChars = window.characterProfiles.allCharacters || window.characterProfiles.characters || [];
                const selectedChar = allChars.find(c => 
                    (c.name && c.name === message.data.role_name) || 
                    (c.nickname && c.nickname === message.data.role_name)
                );
                if (selectedChar) {
                    showSelectedCharacter(selectedChar);
                } else {
                    // 如果找不到，从DOM中获取
                    const cards = document.querySelectorAll('.character-card');
                    cards.forEach(card => {
                        const nameEl = card.querySelector('.character-name');
                        if (nameEl && nameEl.textContent.trim() === message.data.role_name) {
                            const descEl = card.querySelector('.character-description');
                            const locationEl = card.querySelector('.character-location');
                            const goalEl = card.querySelector('.character-goal');
                            const stateEl = card.querySelector('.character-state');
                            
                            showSelectedCharacter({
                                name: message.data.role_name,
                                nickname: message.data.role_name,
                                description: descEl ? descEl.textContent.trim() : '',
                                location: locationEl ? locationEl.textContent.replace('📍', '').trim() : '',
                                goal: goalEl ? goalEl.textContent.replace('🎯', '').trim() : '',
                                state: stateEl ? stateEl.textContent.replace('⚡', '').trim() : ''
                            });
                        }
                    });
                }
            }
        }
        else if (message.type === 'characters_list') {
            // 收到角色列表，更新本地数据
            if (window.characterProfiles && message.data.characters) {
                window.characterProfiles.updateCharacters(message.data.characters);
            }
            // 同时更新Soulverse面板的Agent列表
            if (window.soulversePanel && typeof window.soulversePanel.updateAgentListFromData === 'function') {
                window.soulversePanel.updateAgentListFromData(message.data.characters);
            }
        }
        else if (message.type === 'error') {
            // 错误消息
            addSystemMessage(`错误: ${message.data.message}`);
            // 恢复自动完成按钮状态
            if (autoCompleteBtn && waitingForInput) {
                autoCompleteBtn.disabled = false;
                autoCompleteBtn.style.opacity = '1';
            }
        }
        else if (message.type === 'story_exported' || message.type === 'social_report_exported') {
            // 社交报告导出成功
            const reportText = message.data.report || message.data.story;
            const reportData = message.data.report_data; // 结构化数据（如果存在）
            const format = message.data.format || 'text'; // 报告格式
            
            // 恢复按钮状态
            if (exportStoryBtn) {
                exportStoryBtn.disabled = false;
                exportStoryBtn.innerHTML = '<i class="fas fa-file-alt"></i><span data-i18n="exportSocialReport">导出社交报告</span>';
            }
            
            if (format === 'json' && reportData && typeof window.showStoryModalWithCharts === 'function') {
                // 显示带图表的报告
                window.showStoryModalWithCharts(reportText, reportData, message.data.timestamp);
            } else if (format === 'json' && reportData) {
                // 如果函数在全局作用域，尝试直接调用
                if (typeof showStoryModalWithCharts === 'function') {
                    showStoryModalWithCharts(reportText, reportData, message.data.timestamp);
                } else {
                    // 降级到文本报告
                    showStoryModal(reportText, message.data.timestamp);
                }
            } else {
                // 显示文本报告
                showStoryModal(reportText, message.data.timestamp);
            }
        }
        else if (message.type === 'auto_complete_options') {
            // AI生成了多个选项
            showAutoOptionsModal(message.data.options);
        }
        else if (message.type === 'auto_complete_success') {
            // AI自动完成成功
            if (autoCompleteBtn) {
                autoCompleteBtn.disabled = false;
                autoCompleteBtn.style.opacity = '1';
            }
        }
        else if (message.type === 'story_ended') {
            // 故事结束
            addSystemMessage(message.data.message);
            isPlaying = false;
            controlBtn.innerHTML = '<i class="fas fa-play"></i><span data-i18n="start">开始</span>';
        }
        else if (message.type === 'message') {
            if (message.data.type === 'system') {
                addSystemMessage(message.data.text);
            } 
            else if (message.data.type === 'story') {
                // 为故事消息添加特殊样式
                const messageElement = document.createElement('div');
                messageElement.className = 'message story-message';
                messageElement.innerHTML = `
                    <div class="content">
                        <div class="header">
                            <span class="username">故事总结</span>
                            <span class="timestamp">${message.data.timestamp}</span>
                        </div>
                        <div class="text">${message.data.text}</div>
                    </div>
                `;
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            else {
                renderMessage(message.data);
            }
        }
        else if (message.type === 'initial_data') {
            // 清空现有消息，处理初始数据
            chatMessages.innerHTML = '';
            
            if (message.data.history_messages) {
                loadHistoryMessages(message.data.history_messages);
            }
            else {
                loadHistoryMessages([]);
            }
        }
    };

    function loadHistoryMessages(messages) {
        // 清空现有消息
        chatMessages.innerHTML = '';
        
        messages.forEach(message => {
            renderMessage(message);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        console.log(`Loaded ${messages.length} historical messages`);
    }

    // 渲染消息
    function renderMessage(message) {
        // 如果上一个消息是本地临时用户消息，则用服务器回显的用户消息替换之，避免重复
        if (message && message.is_user) {
            // 从后往前查找临时用户消息，匹配用户名和文本内容
            const children = Array.from(chatMessages.children).reverse();
            for (let i = 0; i < children.length; i++) {
                const last = children[i];
                if (last && last.classList.contains('message') && last.classList.contains('user') && last.dataset.temp === '1') {
                    // 检查用户名和文本内容是否匹配（允许文本内容有小差异，因为服务器可能做了处理）
                    const lastUsername = last.dataset.username || '';
                    const lastText = last.querySelector('.text')?.textContent?.trim() || '';
                    const msgUsername = message.username || '';
                    const msgText = message.text?.trim() || '';
                    
                    // 如果用户名匹配，且文本内容相同或相似（允许服务器做了长度补强），则替换
                    if (lastUsername === msgUsername && (lastText === msgText || msgText.includes(lastText) || lastText.includes(msgText))) {
                        // 替换内容
                        const updated = createMessageElement(message);
                        chatMessages.replaceChild(updated, last);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        return;
                    }
                    // 如果用户名匹配但文本不匹配，说明可能是不同的消息，继续查找下一个
                    // 但如果已经查找了最近3条消息都没匹配，就停止查找（避免替换错误的消息）
                    if (i >= 2) break;
                } else if (last && last.classList.contains('message') && !last.classList.contains('user')) {
                    // 遇到非用户消息，停止查找（临时消息应该在最后）
                    break;
                }
            }
        }
        const messageElement = createMessageElement(message);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 统一创建消息DOM（供渲染与乐观替换复用）
    function createMessageElement(message) {
    const messageElement = document.createElement('div');
    // 支持基于来源的样式：如果消息包含 from/is_user 字段，则加上 user/npc 类
    const srcClass = (message.from === 'user' || message.is_user) ? ' user' : ' npc';
    messageElement.className = 'message' + srcClass;
        messageElement.dataset.timestamp = message.timestamp;
        messageElement.dataset.username = message.username;
        
        // 添加场景属性
        if (message.scene !== undefined) {
            messageElement.dataset.scene = message.scene;
            console.log(`Rendering message for scene ${message.scene}`);
        }
        
        // Note: avatar/icon intentionally not rendered in chat (requirement: remove avatars)
        messageElement.innerHTML = `
            <div class="content">
                <div class="header">
                    <a href="#" class="username profile-link" data-username="${message.username}" data-role-code="${message.uuid || ''}">${message.username}</a>
                    <span class="timestamp">${message.timestamp}</span>
                </div>
                <div class="text-wrapper">
                    <div class="text">${message.text}</div>
                    <button class="edit-icon"><i class="fas fa-pen"></i></button>
                    <div class="edit-buttons" style="display: none;">
                        <button class="edit-btn save-btn">保存</button>
                        <button class="edit-btn cancel-btn">取消</button>
                    </div>
                </div>
            </div>
        `;
    
        // 获取元素引用
        const textElement = messageElement.querySelector('.text');
        const editButtons = messageElement.querySelector('.edit-buttons');
        const editIcon = messageElement.querySelector('.edit-icon');
        const usernameLink = messageElement.querySelector('.username.profile-link');
        
        // 为用户名链接添加点击事件
        if (usernameLink) {
            usernameLink.addEventListener('click', function(e) {
                e.preventDefault();
                const username = this.getAttribute('data-username');
                // 如果不是"User"，则显示角色信息
                if (username && username !== 'User' && username !== 'System') {
                    openProfileModalByName(username);
                }
            });
        }

        // 存储原始文本并使用全局编辑状态管理
        const originalText = message.text;

        // 点击铅笔图标进入编辑模式
        editIcon.addEventListener('click', () => {
            // 如果已有其他编辑中的消息，先退出它（回退）
            if (currentEditingMessage && currentEditingMessage !== messageElement) {
                exitEditMode(currentEditingMessage, true);
            }
            currentEditingMessage = messageElement;
            currentEditingOriginalText = originalText;
            editButtons.style.display = 'flex';
            textElement.classList.add('editing');
            textElement.setAttribute('contenteditable', 'true');
            textElement.focus();
        });

        // 保存按钮点击事件
        messageElement.querySelector('.save-btn').addEventListener('click', () => {
            const newText = textElement.textContent.trim();
            if (newText !== originalText) {
                ws.send(JSON.stringify({
                    type: 'edit_message',
                    data: { uuid: message.uuid, text: newText }
                }));
                currentEditingOriginalText = newText;
            }
            exitEditMode(messageElement, false);
        });

        // 取消按钮点击事件
        messageElement.querySelector('.cancel-btn').addEventListener('click', () => {
            textElement.textContent = currentEditingOriginalText || originalText;
            exitEditMode(messageElement, true);
        });

        // 处理快捷键（仅在编辑时）
        textElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                messageElement.querySelector('.save-btn').click();
            }
            if (e.key === 'Escape') {
                messageElement.querySelector('.cancel-btn').click();
            }
        });

        // 防止消息点击冒泡到全局点击（全局点击用于退出编辑）
        messageElement.addEventListener('click', function(event) {
            event.stopPropagation();
        });

        function exitEditMode(msgEl, revert) {
            if (!msgEl) return;
            const txtEl = msgEl.querySelector('.text');
            const btns = msgEl.querySelector('.edit-buttons');
            if (btns) btns.style.display = 'none';
            if (txtEl) {
                txtEl.classList.remove('editing');
                txtEl.removeAttribute('contenteditable');
                txtEl.blur();
                if (revert) txtEl.textContent = currentEditingOriginalText || originalText;
            }
            if (currentEditingMessage === msgEl) {
                currentEditingMessage = null;
                currentEditingOriginalText = '';
            }
        }
    
        return messageElement;
    }
    // 添加系统消息
    function addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.innerHTML = `
            <div class="content">
                <div class="text">${text}</div>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 发送消息
    function sendMessage() {
        // 只有在等待输入时（选择了角色且轮到该角色）才允许发送消息
        if (!waitingForInput) {
            alert('请先选择角色并等待轮到您行动时再发送消息');
            return;
        }
        
        const text = textarea.value.trim();
        if (!text) {
            // 空输入提示
                alert('请输入内容');
            return;
        }
        
        if (ws.readyState === WebSocket.OPEN) {
            // 立即在前端显示用户输入（乐观渲染），待服务器回显后“对齐/替换”
            const clientTimestamp = new Date().toLocaleString();
            appendLocalUserMessage({
                username: selectedRoleName || (window.selectedRoleName || 'User'),
                timestamp: clientTimestamp,
                text: text
            });

            const message = {
                type: 'user_message',
                text: text,
                timestamp: clientTimestamp
            };
            ws.send(JSON.stringify(message));
            textarea.value = '';
            
            // 如果正在等待输入，重置状态
            if (waitingForInput) {
                waitingForInput = false;
                textarea.placeholder = 'input';
                // 禁用发送按钮
                updateSendButtonState();
                // 隐藏AI自动完成按钮
                if (autoCompleteBtn) {
                    autoCompleteBtn.style.display = 'none';
                }
            }
        }
    }
    
    // 乐观渲染：立即追加一条本地用户消息，并标记为临时
    function appendLocalUserMessage(msg) {
        const tempMessage = {
            username: msg.username || 'User',
            type: 'role',
            timestamp: msg.timestamp || new Date().toLocaleString(),
            text: msg.text,
            is_user: true,
            uuid: ''  // 无uuid
        };
        const el = createMessageElement(tempMessage);
        // 标记为临时，用于后续服务器回显时对齐
        el.dataset.temp = '1';
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 更新发送按钮状态
    function updateSendButtonState() {
        if (sendButton) {
            if (waitingForInput) {
                sendButton.disabled = false;
                sendButton.style.opacity = '1';
                sendButton.style.cursor = 'pointer';
            } else {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.5';
                sendButton.style.cursor = 'not-allowed';
            }
        }
        if (textarea) {
            if (waitingForInput) {
                textarea.disabled = false;
            } else {
                textarea.disabled = true;
                textarea.placeholder = '请先选择角色并等待轮到您行动';
            }
        }
    }
    
    // 初始化发送按钮状态
    updateSendButtonState();

    // AI自动完成按钮点击事件
    if (autoCompleteBtn) {
        autoCompleteBtn.addEventListener('click', function() {
            if (waitingForInput && ws.readyState === WebSocket.OPEN) {
                // 发送自动完成请求
                ws.send(JSON.stringify({
                    type: 'auto_complete',
                    timestamp: new Date().toLocaleString()
                }));
                // 禁用按钮，防止重复点击
                autoCompleteBtn.disabled = true;
                autoCompleteBtn.style.opacity = '0.6';
                const generatingMsg = window.i18n?.get('generatingAction') ?? '正在生成AI行动...';
                addSystemMessage(generatingMsg);
            }
        });
    }

    // 角色选择按钮
    const selectRoleBtn = document.getElementById('selectRoleBtn');
    selectRoleBtn.addEventListener('click', function() {
        showRoleSelectModal();
    });
    
    // 显示角色选择模态框
    function showRoleSelectModal() {
        // 优先从window.characterProfiles获取完整数据
        let profiles = [];
        if (window.characterProfiles) {
            // 尝试多种方式获取角色列表
            if (window.characterProfiles.allCharacters && window.characterProfiles.allCharacters.length > 0) {
                profiles = window.characterProfiles.allCharacters;
            } else if (window.characterProfiles.characters && window.characterProfiles.characters.length > 0) {
                profiles = window.characterProfiles.characters;
            }
        }
        
        // 过滤：只显示用户创建的Agent（is_user_agent === true）
        profiles = profiles.filter(char => char.is_user_agent === true);
        
        console.log('角色选择 - window.characterProfiles:', window.characterProfiles);
        console.log('角色选择 - filtered user agents:', profiles.length);
        
        // 如果还没有，从DOM中获取
        if (profiles.length === 0) {
            const characterCards = document.querySelectorAll('.character-card');
            characterCards.forEach((card, idx) => {
                const nameEl = card.querySelector('.character-name');
                const descEl = card.querySelector('.character-description');
                const locationEl = card.querySelector('.character-location');
                const goalEl = card.querySelector('.character-goal');
                const stateEl = card.querySelector('.character-state');
                const iconEl = card.querySelector('.character-icon img');
                
                if (nameEl) {
                    const name = nameEl.textContent.trim();
                    const location = locationEl ? locationEl.textContent.replace('📍', '').trim() : '';
                    const goal = goalEl ? goalEl.textContent.replace('🎯', '').trim() : '';
                    const state = stateEl ? stateEl.textContent.replace('⚡', '').trim() : '';
                    const icon = iconEl ? iconEl.src : './frontend/assets/images/default-icon.jpg';
                    
                    // 提取描述
                    let description = '';
                    if (descEl) {
                        const fullDesc = descEl.querySelector('.full-desc');
                        const shortDesc = descEl.querySelector('.short-desc');
                        if (fullDesc && fullDesc.style.display !== 'none') {
                            description = fullDesc.textContent.trim();
                        } else if (shortDesc) {
                            description = shortDesc.textContent.trim();
                        } else {
                            description = descEl.textContent.trim();
                        }
                    }
                    
                    profiles.push({
                        name: name,
                        nickname: name,
                        description: description,
                        location: location,
                        goal: goal,
                        state: state,
                        icon: icon,
                        index: idx
                    });
                }
            });
        }
        
        // 显示模态框
        const modal = document.getElementById('role-select-modal');
        const container = document.getElementById('roleCardsContainer');
        
        if (!modal || !container) {
            console.error('角色选择模态框元素未找到');
            return;
        }
        
        // 清空容器
        container.innerHTML = '';
        
        if (profiles.length === 0) {
            // 显示空状态提示
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                    <div style="font-size: 48px; margin-bottom: 16px;">👤</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #334155;">还没有你的Agent</div>
                    <div style="font-size: 14px; margin-bottom: 20px;">请先在右侧"Soulverse"标签中创建你的Agent</div>
                    <div style="font-size: 12px; color: #94a3b8;">只有你创建的Agent才能被选择进行"灵魂降临"</div>
                </div>
            `;
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            
            // 设置关闭事件
            const closeBtn = modal.querySelector('.modal-close');
            const overlay = modal.querySelector('.modal-overlay');
            
            function closeModal() {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                closeBtn.removeEventListener('click', closeModal);
                overlay.removeEventListener('click', closeModal);
                document.removeEventListener('keydown', onKeyDown);
            }
            
            function onKeyDown(e) {
                if (e.key === 'Escape') closeModal();
            }
            
            closeBtn.addEventListener('click', closeModal);
            overlay.addEventListener('click', closeModal);
            document.addEventListener('keydown', onKeyDown);
            return;
        }
        
        // 创建角色卡片
        profiles.forEach((character) => {
            const card = createRoleSelectCard(character);
            container.appendChild(card);
        });
        
        // 显示模态框
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // 设置关闭事件
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        
        function closeModal() {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            closeBtn.removeEventListener('click', closeModal);
            overlay.removeEventListener('click', closeModal);
            document.removeEventListener('keydown', onKeyDown);
        }
        
        function onKeyDown(e) {
            if (e.key === 'Escape') closeModal();
        }
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        document.addEventListener('keydown', onKeyDown);
    }
    
    // 创建角色选择卡片
    function createRoleSelectCard(character) {
        const card = document.createElement('div');
        card.className = 'role-select-card';
        card.setAttribute('data-role-name', character.name || character.nickname);
        
        const name = character.name || character.nickname || 'Unknown';
        const description = character.description || character.brief || '';
        const icon = character.icon || './frontend/assets/images/default-icon.jpg';
        const location = character.location || '';
        const goal = character.goal || '';
        const state = character.state || character.status || '';
        
        card.innerHTML = `
            <div class="role-select-card-header">
                <img class="role-select-card-avatar" src="${icon}" alt="${name}" onerror="this.src='./frontend/assets/images/default-icon.jpg'">
                <h3 class="role-select-card-name">${name}</h3>
            </div>
            ${description ? `<p class="role-select-card-description">${description}</p>` : ''}
            ${(location || goal || state) ? `
                <div class="role-select-card-details">
                    ${location ? `<div class="role-select-card-detail"><span class="role-select-card-detail-icon">📍</span><span>${location}</span></div>` : ''}
                    ${goal ? `<div class="role-select-card-detail"><span class="role-select-card-detail-icon">🎯</span><span>${goal}</span></div>` : ''}
                    ${state ? `<div class="role-select-card-detail"><span class="role-select-card-detail-icon">⚡</span><span>${state}</span></div>` : ''}
                </div>
            ` : ''}
        `;
        
        // 添加点击事件
        card.addEventListener('click', function() {
            handleRoleSelection(name, character);
            // 关闭模态框
            const modal = document.getElementById('role-select-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
            }
        });
        
        return card;
    }
    
    // 处理角色选择的函数
    function handleRoleSelection(roleName, characterData) {
        selectedRoleName = roleName;
        
        // 发送角色选择消息
        ws.send(JSON.stringify({
            type: 'select_role',
            role_name: roleName
        }));
        
        // 更新按钮（添加取消选择功能）
        selectRoleBtn.innerHTML = `<i class="fas fa-user-check"></i><span>${roleName}</span> <i class="fas fa-times" style="margin-left: 8px; cursor: pointer; opacity: 0.7;" title="取消选择"></i>`;
        selectRoleBtn.style.background = '#1e293b';
        
        // 添加取消选择的事件监听（点击X图标）
        const cancelIcon = selectRoleBtn.querySelector('.fa-times');
        if (cancelIcon) {
            cancelIcon.addEventListener('click', function(e) {
                e.stopPropagation();
                clearRoleSelection();
            });
        }
        
        // 显示选中的角色在左侧栏顶部
        showSelectedCharacter(characterData);
        
        // 触发模式更新事件（模式由服务器根据角色类型自动决定）
        // 这个事件会被soulverse-panel.js监听并更新模式指示器
    }
    
    // 取消选择角色
    function clearRoleSelection() {
        selectedRoleName = null;
        window.selectedRoleName = null;
        
        // 发送取消选择消息
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'clear_role_selection'
            }));
        }
        
        // 更新按钮
        selectRoleBtn.innerHTML = `<i class="fas fa-user"></i><span>选择角色</span>`;
        selectRoleBtn.style.background = '';
        
        // 隐藏选中的角色显示
        const selectedSection = document.getElementById('selectedCharacterSection');
        if (selectedSection) {
            selectedSection.style.display = 'none';
        }
        
        // 重新渲染角色列表，移除选中状态
        if (window.characterProfiles && window.characterProfiles.characters) {
            window.characterProfiles.renderCharacters(window.characterProfiles.characters);
        }
        
        // 更新模式指示器
        if (window.soulversePanel && window.soulversePanel.updateModeIndicator) {
            window.soulversePanel.updateModeIndicator(null, false);
        }
    }
    
    // 显示选中的角色
    function showSelectedCharacter(character) {
        // 更新全局选中的角色名称，用于重新渲染时排序
        window.selectedRoleName = character.name || character.nickname || character.code || character.role_code || null;
        
        // 触发角色列表重新渲染，使选中的角色置顶
        if (window.characterProfiles && window.characterProfiles.characters) {
            window.characterProfiles.renderCharacters(window.characterProfiles.characters);
        }
        
        // 隐藏原来的选中区域（因为现在选中的卡片会置顶显示）
        const selectedSection = document.getElementById('selectedCharacterSection');
        if (selectedSection) {
            selectedSection.style.display = 'none';
            }
    }

    // 绑定发送按钮点击事件（阻止表单默认提交）
    sendButton.addEventListener('click', function(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        sendMessage();
    });

    // 绑定回车键发送
    textarea.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 角色名点击 -> 打开角色档案弹窗（弹窗内容不包含动机）
    document.addEventListener('click', function (e) {
        const target = e.target;
        if (target && target.classList && target.classList.contains('profile-link')) {
            e.preventDefault();
            const name = target.textContent.trim();
            openProfileModalByName(name);
        }
    });

    // 全局文档点击：用于退出任何打开的编辑模式（回退不保存）
    document.addEventListener('click', function (e) {
        if (currentEditingMessage && !currentEditingMessage.contains(e.target)) {
            const txt = currentEditingMessage.querySelector('.text');
            if (txt) txt.textContent = currentEditingOriginalText || txt.textContent;
            const btns = currentEditingMessage.querySelector('.edit-buttons');
            if (btns) btns.style.display = 'none';
            if (txt) {
                txt.classList.remove('editing');
                txt.removeAttribute('contenteditable');
            }
            currentEditingMessage = null;
            currentEditingOriginalText = '';
        }
    });

    function openProfileModalByName(name) {
        // 使用CharacterProfiles的showCharacterDetails方法
        if (window.characterProfiles && typeof window.characterProfiles.showCharacterDetails === 'function') {
            // 从角色列表中查找角色信息
            const profiles = window.characterProfiles.allCharacters || window.characterProfiles.characters || [];
            let character = null;
            
            // 首先尝试精确匹配name
            character = profiles.find(char => 
                char.name === name || 
                char.nickname === name ||
                char.role_name === name
            );
            
            // 如果没找到，尝试模糊匹配（去除"用户_"前缀等）
        if (!character) {
                const normalizedName = name.replace(/^用户_/, '').replace(/^用户/, '').trim();
                character = profiles.find(char => {
                    const charName = (char.name || '').replace(/^用户_/, '').replace(/^用户/, '').trim();
                    const charNickname = (char.nickname || '').replace(/^用户_/, '').replace(/^用户/, '').trim();
                    const charRoleName = (char.role_name || '').replace(/^用户_/, '').replace(/^用户/, '').trim();
                    return charName === normalizedName || 
                           charNickname === normalizedName ||
                           charRoleName === normalizedName;
                });
            }

        if (character) {
                // 使用CharacterProfiles的方法显示详细信息
                window.characterProfiles.showCharacterDetails(character);
        } else {
                console.warn('未找到角色信息:', name);
                // 如果找不到，显示基本提示
                alert(`未找到角色 "${name}" 的详细信息`);
        }
            } else {
            console.warn('CharacterProfiles未初始化或showCharacterDetails方法不存在');
        }
    }

    // 添加导出社交报告按钮的点击事件
    exportStoryBtn.addEventListener('click', function() {
        if (ws && ws.readyState === WebSocket.OPEN) {
        // 显示加载状态
        exportStoryBtn.disabled = true;
        exportStoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>生成中...</span>';
        
            // 如果当前选择了Agent，导出该Agent的报告；否则导出所有Agent的报告
            const selectedAgentCode = window.soulversePanel?.currentAgentCode || null;
            
            // 请求JSON格式的报告（包含图表数据）
        ws.send(JSON.stringify({
                type: 'generate_social_report',
                agent_code: selectedAgentCode,
                format: 'json'  // 请求JSON格式，包含图表数据
        }));
        }
    });
    
    // 添加重置所有按钮的点击事件
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', function() {
            // 显示确认对话框
            if (confirm('确定要重置所有内容吗？\n\n这将清除：\n- 所有创建的Agent\n- 所有历史记录\n- 所有聊天记录\n\n此操作无法撤销！')) {
                // 用户确认后执行重置
                resetAllBtn.disabled = true;
                resetAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>重置中...</span>';
                
                // 调用后端API
                fetch('/api/reset-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // 清空聊天记录
                        if (chatMessages) {
                            chatMessages.innerHTML = '';
                        }
                        
                        // 重置UI状态
                        isPlaying = false;
                        waitingForInput = false;
                        selectedRoleName = null;
                        window.selectedRoleName = null;
                        
                        // 更新控制按钮
                        controlBtn.innerHTML = '<i class="fas fa-play"></i><span data-i18n="start">开始</span>';
                        
                        // 清除角色选择
                        if (typeof clearRoleSelection === 'function') {
                            clearRoleSelection();
                        }
                        
                        // 显示系统消息
                        addSystemMessage('系统已重置，所有数据已清除');
                        
                        // 重新加载页面以完全重置状态
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } else {
                        throw new Error(data.message || '重置失败');
                    }
                })
                .catch(error => {
                    console.error('重置失败:', error);
                    alert('重置失败：' + error.message);
                    
                    // 恢复按钮状态
                    resetAllBtn.disabled = false;
                    resetAllBtn.innerHTML = '<i class="fas fa-trash-alt"></i><span data-i18n="resetAll">重置所有</span>';
                });
            }
        });
    }
    
    // 显示故事模态框
    function showStoryModal(storyText, timestamp) {
        const modal = document.getElementById('story-modal');
        const content = document.getElementById('storyContent');
        
        if (!modal || !content) {
            console.error('故事模态框元素未找到');
            return;
        }
        
        // 恢复按钮状态
        exportStoryBtn.disabled = false;
        exportStoryBtn.innerHTML = '<i class="fas fa-book"></i><span data-i18n="exportStory">输出故事</span>';
        
        // 清空并重建结构：头部 + markdown内容
        content.innerHTML = '';
        
        const container = document.createElement('div');
        container.className = 'social-report-container';
        
        const header = document.createElement('div');
        header.className = 'report-header';
        header.innerHTML = `
            <h1>社交报告</h1>
            <div class="report-meta">
                <span><i class="fas fa-calendar"></i> ${timestamp || ''}</span>
            </div>
        `;
        container.appendChild(header);
        
        const section = document.createElement('div');
        section.className = 'report-section';
        
        const mdWrapper = document.createElement('div');
        mdWrapper.className = 'report-markdown';
        mdWrapper.style.lineHeight = '1.8';
        mdWrapper.style.color = '#334155';
        mdWrapper.innerHTML = renderMarkdown(storyText || '暂无内容');
        
        section.appendChild(mdWrapper);
        container.appendChild(section);
        content.appendChild(container);
        
        // 显示模态框
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // 设置关闭事件
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        
        function closeModal() {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            closeBtn && closeBtn.removeEventListener('click', closeModal);
            if (overlay) overlay.removeEventListener('click', closeModal);
            document.removeEventListener('keydown', onKeyDown);
        }
        
        function onKeyDown(e) {
            if (e.key === 'Escape') closeModal();
        }
        
        closeBtn && closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);
        document.addEventListener('keydown', onKeyDown);
    }
    
    // 更友好的Markdown渲染（基础标题、列表、粗斜体、换行）
    function renderMarkdown(md) {
        if (!md) return '';
        let html = md;
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html
            .replace(/^# (.*)$/gim, '<h1 style="margin: 20px 0 12px; font-size: 24px; font-weight: 700; color:#1e293b;">$1</h1>')
            .replace(/^## (.*)$/gim, '<h2 style="margin: 18px 0 10px; font-size: 20px; font-weight: 600; color:#334155;">$1</h2>')
            .replace(/^### (.*)$/gim, '<h3 style="margin: 14px 0 8px; font-size: 16px; font-weight: 600; color:#475569;">$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>');
        // 列表：将以 * 或 - 开头的行包裹到 <ul>
        const lines = html.split('\n');
        let inList = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*([*-])\s+/.test(line)) {
                const item = line.replace(/^\s*([*-])\s+/, '');
                lines[i] = `<li style="margin:6px 0; padding-left:4px; list-style: disc;">${item}</li>`;
                if (!inList) {
                    lines[i] = `<ul style="padding-left:20px; margin: 8px 0;">` + lines[i];
                    inList = true;
                }
            } else {
                if (inList) {
                    lines[i - 1] = lines[i - 1] + `</ul>`;
                    inList = false;
                }
            }
        }
        if (inList && lines.length > 0) {
            lines[lines.length - 1] = lines[lines.length - 1] + `</ul>`;
            inList = false;
        }
        // 段落换行
        html = lines.join('\n').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        return html;
    }
    
    // 显示AI选项选择模态框
    function showAutoOptionsModal(options) {
        const modal = document.getElementById('auto-options-modal');
        const container = document.getElementById('autoOptionsContainer');
        
        if (!modal || !container) {
            console.error('AI选项模态框元素未找到');
            return;
        }
        
        // 恢复按钮状态
        if (autoCompleteBtn) {
            autoCompleteBtn.disabled = false;
            autoCompleteBtn.style.opacity = '1';
        }
        
        // 清空容器
        container.innerHTML = '';
        
        // 创建选项卡片
        options.forEach((option, index) => {
            const card = createOptionCard(option, index);
            container.appendChild(card);
        });
        
        // 显示模态框
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // 设置关闭事件
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        
        function closeModal() {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            closeBtn.removeEventListener('click', closeModal);
            if (overlay) overlay.removeEventListener('click', closeModal);
            document.removeEventListener('keydown', onKeyDown);
        }
        
        function onKeyDown(e) {
            if (e.key === 'Escape') closeModal();
        }
        
        closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);
        document.addEventListener('keydown', onKeyDown);
    }
    
    // 创建选项卡片
    function createOptionCard(option, index) {
        const card = document.createElement('div');
        card.className = 'auto-option-card';
        card.setAttribute('data-option-index', index);
        
        const styleIcons = {
            'aggressive': '⚔️',
            'balanced': '⚖️',
            'conservative': '🛡️'
        };
        
        const styleColors = {
            'aggressive': '#dc2626',
            'balanced': '#2563eb',
            'conservative': '#059669'
        };
        
        const icon = styleIcons[option.style] || '💭';
        const color = styleColors[option.style] || '#64748b';
        
        card.innerHTML = `
            <div class="option-header">
                <div class="option-style-badge" style="background: ${color}20; color: ${color}; border-color: ${color}40;">
                    <span class="option-icon">${icon}</span>
                    <span class="option-name">${option.name}</span>
                </div>
                <div class="option-description">${option.description}</div>
            </div>
            <div class="option-content">${option.text}</div>
            <button class="option-select-btn" style="border-color: ${color}; color: ${color};">
                选择此方案
            </button>
        `;
        
        // 添加点击事件
        const selectBtn = card.querySelector('.option-select-btn');
        selectBtn.addEventListener('click', function() {
            // 发送选中的选项
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'select_auto_option',
                    selected_text: option.text
                }));
            }
            
            // 关闭模态框
            const modal = document.getElementById('auto-options-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
            }
        });
        
        // 卡片点击也可以选择
        card.addEventListener('click', function(e) {
            if (e.target !== selectBtn && !selectBtn.contains(e.target)) {
                selectBtn.click();
            }
        });
        
        return card;
    }
});
