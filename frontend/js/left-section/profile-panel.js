// profile-script.js
class CharacterProfiles {
    constructor() {
        // 移除默认角色数据，Soulverse模式下不显示预设角色
        this.defaultCharacters = [];
        this.characters = [];
        this.allCharacters = []; // 存储所有角色信息
        this.init();
    }
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            const container = document.querySelector('.profiles-container');
            if (!container) {
                console.error('找不到角色档案容器元素');
                return;
            }
            
            // Soulverse模式下不渲染默认数据，等待从服务器获取
            // this.updateCharacters(this.defaultCharacters);

            // WebSocket消息处理
            window.addEventListener('websocket-message', (event) => {
                const message = event.detail;

                if (message.type === 'initial_data') {
                    if (message.data.characters) this.updateCharacters(message.data.characters);
                    if (message.data.status) this.updateAllStatus(message.data.status);
                }

                if (message.type === 'scene_characters') {
                    // 处理服务器返回的场景角色数据
                    this.updateCharacters(message.data, true);
                }

                if (message.type === 'status_update') {
                    if (message.data.characters) this.updateCharacters(message.data.characters);
                    if (message.data.status) this.updateAllStatus(message.data.status);
                }
            });

            // 绑定点击事件
            container.addEventListener('click', (e) => this.handleCardClick(e));
        });
    }
    createCharacterCard(character) {
        const maxLength = 60; // 设置折叠时显示的最大字符数
        const needsExpand = character.description && character.description.length > maxLength;
        const shortDesc = needsExpand ? character.description.substring(0, maxLength) + '...' : (character.description || '');
        
        // MBTI显示
        const mbti = character.mbti || '';
        const mbtiDisplay = mbti ? this.createMBTIBadge(mbti) : '';
        
        // 兴趣标签
        const interests = character.interests || [];
        const interestsDisplay = interests.length > 0 ? this.createInterestsSection(interests) : '';
        
        // 性格特征
        const traits = character.traits || [];
        const traitsDisplay = traits.length > 0 ? this.createTraitsSection(traits) : '';
        
        // 社交目标
        const socialGoals = character.social_goals || [];
        const socialGoalsDisplay = socialGoals.length > 0 ? this.createSocialGoalsSection(socialGoals) : '';
        
        return `
            <div class="character-card" data-id="${character.id}">
                <div class="character-header">
                    <div class="character-name-section">
                        <div class="character-name">${character.name}</div>
                        ${mbtiDisplay}
                    </div>
                </div>
                
                ${character.description ? `
                <div class="character-description">
                    <span class="short-desc">${shortDesc}</span>
                    ${needsExpand ? `
                        <span class="full-desc" style="display: none;">${character.description}</span>
                        <span class="expand-btn">展开</span>
                    ` : ''}
                </div>
                ` : ''}
                
                ${interestsDisplay}
                ${traitsDisplay}
                ${socialGoalsDisplay}
                
                <div class="character-details">
                    <div class="detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${character.location || '未知位置'}</span>
                    </div>
                    ${character.state ? `
                    <div class="detail-item">
                        <i class="fas fa-bolt"></i>
                        <span>${character.state}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    createMBTIBadge(mbti) {
        // MBTI颜色映射
        const mbtiColors = {
            'INTJ': { bg: '#6366f1', color: '#fff' },
            'INTP': { bg: '#8b5cf6', color: '#fff' },
            'ENTJ': { bg: '#ec4899', color: '#fff' },
            'ENTP': { bg: '#f59e0b', color: '#fff' },
            'INFJ': { bg: '#06b6d4', color: '#fff' },
            'INFP': { bg: '#10b981', color: '#fff' },
            'ENFJ': { bg: '#3b82f6', color: '#fff' },
            'ENFP': { bg: '#f97316', color: '#fff' },
            'ISTJ': { bg: '#64748b', color: '#fff' },
            'ISFJ': { bg: '#14b8a6', color: '#fff' },
            'ESTJ': { bg: '#ef4444', color: '#fff' },
            'ESFJ': { bg: '#a855f7', color: '#fff' },
            'ISTP': { bg: '#475569', color: '#fff' },
            'ISFP': { bg: '#22c55e', color: '#fff' },
            'ESTP': { bg: '#f43f5e', color: '#fff' },
            'ESFP': { bg: '#fb923c', color: '#fff' }
        };
        
        const color = mbtiColors[mbti] || { bg: '#64748b', color: '#fff' };
        
        return `
            <div class="mbti-badge" style="background: ${color.bg}; color: ${color.color};">
                <span class="mbti-label">MBTI</span>
                <span class="mbti-value">${mbti}</span>
            </div>
        `;
    }

    createInterestsSection(interests) {
        const displayInterests = interests.slice(0, 6); // 最多显示6个
        const interestsHTML = displayInterests.map(interest => 
            `<span class="interest-tag">${interest}</span>`
        ).join('');
        const moreCount = interests.length > 6 ? `<span class="more-tag">+${interests.length - 6}</span>` : '';
        
        return `
            <div class="character-section interests-section">
                <div class="section-header">
                    <i class="fas fa-heart"></i>
                    <span class="section-title">兴趣</span>
                </div>
                <div class="section-content">
                    ${interestsHTML}
                    ${moreCount}
                </div>
            </div>
        `;
    }

    createTraitsSection(traits) {
        const displayTraits = traits.slice(0, 4); // 最多显示4个
        const traitsHTML = displayTraits.map(trait => 
            `<span class="trait-tag">${trait}</span>`
        ).join('');
        const moreCount = traits.length > 4 ? `<span class="more-tag">+${traits.length - 4}</span>` : '';
        
        return `
            <div class="character-section traits-section">
                <div class="section-header">
                    <i class="fas fa-star"></i>
                    <span class="section-title">性格特征</span>
                </div>
                <div class="section-content">
                    ${traitsHTML}
                    ${moreCount}
                </div>
            </div>
        `;
    }

    createSocialGoalsSection(socialGoals) {
        const goalsHTML = socialGoals.slice(0, 2).map(goal => 
            `<div class="goal-item"><i class="fas fa-check-circle"></i><span>${goal}</span></div>`
        ).join('');
        
        return `
            <div class="character-section goals-section">
                <div class="section-header">
                    <i class="fas fa-bullseye"></i>
                    <span class="section-title">社交目标</span>
                </div>
                <div class="section-content">
                    ${goalsHTML}
                </div>
            </div>
        `;
    }

    handleCardClick(e) {
        // 处理展开/收起按钮点击
        if (e.target.classList.contains('expand-btn')) {
            const descContainer = e.target.closest('.character-description');
            const shortDesc = descContainer.querySelector('.short-desc');
            const fullDesc = descContainer.querySelector('.full-desc');
            const expandBtn = descContainer.querySelector('.expand-btn');

            if (shortDesc.style.display !== 'none') {
                // 展开
                shortDesc.style.display = 'none';
                fullDesc.style.display = 'block';
                expandBtn.textContent = '收起';
                descContainer.classList.add('expanded');
            } else {
                // 收起
                shortDesc.style.display = 'block';
                fullDesc.style.display = 'none';
                expandBtn.textContent = '展开';
                descContainer.classList.remove('expanded');
            }
            return; // 防止触发卡片的其他点击事件
        }

        // 原有的卡片点击处理逻辑
        const card = e.target.closest('.character-card');
        if (card) {
            const characterId = card.dataset.id;
            const character = this.characters.find(c => c.id === parseInt(characterId));
            if (character) {
                this.showCharacterDetails(character);
            }
        }
    }
    updateCharacters(charactersData, scene = false) {
        if (scene) {
            if (charactersData) {
                this.renderCharacters(charactersData);
            }
            else{
                this.renderCharacters(this.allCharacters);
            }
        }
        else {
            this.characters = charactersData;
            this.allCharacters = [...charactersData];
            this.renderCharacters(this.characters);
        }

    }
    renderCharacters(characters) {
        const container = document.querySelector('.profiles-container');
        if (container) {
            container.innerHTML = '';
            
            // 如果角色列表为空，显示提示信息
            if (!characters || characters.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 20px; text-align: center; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 10px;">👤</div>
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">还没有Agent</div>
                        <div style="font-size: 14px; margin-bottom: 15px;">在右侧"Soulverse"标签中创建你的第一个Agent</div>
                        <div style="font-size: 12px; color: #999;">Soulverse是一个虚拟社交沙盒，你可以创建AI Agent并观察它们的自主互动</div>
                    </div>
                `;
                return;
            }
            
            characters.forEach(character => {
                container.innerHTML += this.createCharacterCard(character);
            });
        }
    }

    // 更新所有角色的状态字段（statusData 可以是数组或对象）
    updateAllStatus(statusData) {
        if (!statusData) return;
        // 支持数组或 map
        if (Array.isArray(statusData)) {
            statusData.forEach(s => {
                const id = s.id || s.character_id || s.name;
                const target = this.characters.find(c => String(c.id) === String(id) || String(c.name) === String(id) || String(c.nickname) === String(id));
                if (target) {
                    if (s.state) target.state = s.state;
                    if (s.status) target.state = s.status;
                    if (s.location) target.location = s.location;
                    if (s.goal) target.goal = s.goal;
                }
            });
        } else {
            // object map: key -> status
            Object.keys(statusData).forEach(key => {
                const s = statusData[key];
                const target = this.characters.find(c => String(c.id) === String(key) || String(c.name) === String(key) || String(c.nickname) === String(key));
                if (target) {
                    if (s.state) target.state = s.state;
                    if (s.status) target.state = s.status;
                    if (s.location) target.location = s.location;
                    if (s.goal) target.goal = s.goal;
                }
            });
        }
        // 重新渲染
        this.renderCharacters(this.characters);
    }

    // 显示角色详情到全局 modal（显示详细信息）
    showCharacterDetails(character) {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        
        // 基本信息
        const nameEl = modal.querySelector('.modal-name');
        const descEl = modal.querySelector('.modal-description');
        const avatarEl = modal.querySelector('.modal-avatar');
        const locEl = modal.querySelector('.modal-location');
        const goalEl = modal.querySelector('.modal-goal');
        const stateEl = modal.querySelector('.modal-state');

        nameEl.textContent = character.name || character.nickname || character.id || 'Unknown';
        descEl.textContent = character.description || character.brief || character.personality || '';
        avatarEl.src = character.icon || './frontend/assets/images/default-icon.jpg';
        locEl.textContent = character.location || '—';
        goalEl.textContent = character.goal || '—';
        stateEl.textContent = character.state || character.status || '—';
        
        // 显示/隐藏基本信息项
        const locationItem = document.getElementById('modalLocationItem');
        const goalItem = document.getElementById('modalGoalItem');
        const stateItem = document.getElementById('modalStateItem');
        if (locationItem) locationItem.style.display = character.location && character.location !== '—' ? 'inline-flex' : 'none';
        if (goalItem) goalItem.style.display = character.goal && character.goal !== '—' ? 'inline-flex' : 'none';
        if (stateItem) stateItem.style.display = (character.state || character.status) && character.state !== '—' && character.status !== '—' ? 'inline-flex' : 'none';
        
        // MBTI显示
        const mbtiSection = document.getElementById('modalMBTI');
        if (character.mbti && mbtiSection) {
            mbtiSection.style.display = 'block';
            mbtiSection.innerHTML = this.createMBTIBadge(character.mbti);
        } else if (mbtiSection) {
            mbtiSection.style.display = 'none';
        }
        
        // 兴趣标签
        const interestsSection = document.getElementById('modalInterests');
        const interestsTags = document.getElementById('modalInterestsTags');
        if (character.interests && character.interests.length > 0 && interestsSection && interestsTags) {
            interestsSection.style.display = 'block';
            interestsTags.innerHTML = character.interests.map(interest => 
                `<span class="modal-tag interest-tag">${interest}</span>`
            ).join('');
        } else if (interestsSection) {
            interestsSection.style.display = 'none';
        }
        
        // 性格特征
        const traitsSection = document.getElementById('modalTraits');
        const traitsTags = document.getElementById('modalTraitsTags');
        if (character.traits && character.traits.length > 0 && traitsSection && traitsTags) {
            traitsSection.style.display = 'block';
            traitsTags.innerHTML = character.traits.map(trait => 
                `<span class="modal-tag trait-tag">${trait}</span>`
            ).join('');
        } else if (traitsSection) {
            traitsSection.style.display = 'none';
        }
        
        // 社交目标
        const socialGoalsSection = document.getElementById('modalSocialGoals');
        const socialGoalsList = document.getElementById('modalSocialGoalsList');
        if (character.social_goals && character.social_goals.length > 0 && socialGoalsSection && socialGoalsList) {
            socialGoalsSection.style.display = 'block';
            socialGoalsList.innerHTML = character.social_goals.map(goal => 
                `<div class="modal-goal-item">
                    <i class="fas fa-check-circle"></i>
                    <span>${goal}</span>
                </div>`
            ).join('');
        } else if (socialGoalsSection) {
            socialGoalsSection.style.display = 'none';
        }

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        function close() {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            closeBtn.removeEventListener('click', close);
            overlay.removeEventListener('click', close);
            document.removeEventListener('keydown', onKeyDown);
        }
        function onKeyDown(e) { if (e.key === 'Escape') close(); }
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);
        document.addEventListener('keydown', onKeyDown);
    }


    
}
const characterProfiles = new CharacterProfiles();
window.characterProfiles = characterProfiles;
