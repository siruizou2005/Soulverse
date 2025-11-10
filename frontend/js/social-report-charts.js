// 社交报告图表展示功能

// HTML转义函数（需要在其他函数之前定义）
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示带图表的社交报告模态框（全局函数）- 简化版本，只显示文本报告
window.showStoryModalWithCharts = function(storyText, reportData, timestamp) {
    const modal = document.getElementById('story-modal');
    const storyContent = document.getElementById('storyContent');
    
    if (!modal || !storyContent) return;
    
    // 清空内容
    storyContent.innerHTML = '';
    
    // 创建报告容器
    const reportContainer = document.createElement('div');
    reportContainer.className = 'social-report-container';
    
    // 报告内容（直接使用后端生成的完整报告文本，不添加额外标题）
    const contentSection = document.createElement('div');
    contentSection.className = 'report-section';
    contentSection.style.padding = '24px';
    contentSection.style.background = '#ffffff';
    contentSection.style.borderRadius = '12px';
    contentSection.style.marginBottom = '24px';

    // 直接使用后端生成的报告文本，进行Markdown转换
    if (storyText) {
        let html = storyText.trim()
            .replace(/^# (.*$)/gim, '<h1 style="margin: 20px 0 16px 0; font-size: 24px; font-weight: 700; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 style="margin: 18px 0 12px 0; font-size: 20px; font-weight: 600; color: #334155;">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 style="margin: 16px 0 10px 0; font-size: 16px; font-weight: 600; color: #475569;">$1</h3>')
            .replace(/^\* (.*$)/gim, '<li style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">$1</li>')
            .replace(/^- (.*$)/gim, '<li style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">$1</li>')
            .replace(/\n\n/g, '</p><p style="margin: 12px 0; line-height: 1.8; color: #334155;">')
            .replace(/\n/g, '<br>');
        
        // 包装在p标签中
        html = '<p style="margin: 12px 0; line-height: 1.8; color: #334155;">' + html + '</p>';
        const mdDiv = document.createElement('div');
        mdDiv.innerHTML = html;
        contentSection.appendChild(mdDiv);
    } else {
        const empty = document.createElement('div');
        empty.innerHTML = '<p style="margin: 12px 0; line-height: 1.8; color: #64748b; font-style: italic;">暂无报告内容</p>';
        contentSection.appendChild(empty);
    }
    reportContainer.appendChild(contentSection);
    
    storyContent.appendChild(reportContainer);
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

function createBehaviorAnalysisSection(behaviorAnalysis) {
    const section = document.createElement('div');
    section.className = 'report-section behavior-analysis';
    
    const insights = behaviorAnalysis.behavior_insights || {};
    const stats = behaviorAnalysis.stats || {};
    const patterns = behaviorAnalysis.interaction_patterns || {};
    
    const analysisText = insights.analysis || '暂无分析数据';
    const activityLevel = insights.social_activity_level || '未知';
    const interactionStyle = insights.interaction_style || '未知';
    const locationPreference = insights.location_preference || '未知';
    const initiationRate = ((patterns.initiation_rate || 0) * 100).toFixed(0);
    
    section.innerHTML = `
        <h2><i class="fas fa-brain"></i> AI行为特点分析</h2>
        <div class="analysis-content">
            <div class="analysis-text">
                ${escapeHtml(analysisText)}
            </div>
            <div class="analysis-metrics">
                <div class="metric-item">
                    <span class="metric-label">社交活跃度</span>
                    <span class="metric-value ${getActivityLevelClass(activityLevel)}">${escapeHtml(activityLevel)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">互动风格</span>
                    <span class="metric-value">${escapeHtml(interactionStyle)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">位置偏好</span>
                    <span class="metric-value">${escapeHtml(locationPreference)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">主动发起率</span>
                    <span class="metric-value">${initiationRate}%</span>
                </div>
            </div>
        </div>
    `;
    
    return section;
}

function createChartsSection(chartData) {
    const section = document.createElement('div');
    section.className = 'report-section charts-section';
    section.innerHTML = '<h2><i class="fas fa-chart-bar"></i> 数据可视化</h2>';
    
    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid';
    
    // 初始化图表存储
    if (!window.reportCharts) {
        window.reportCharts = {};
    }
    
    // 1. 互动统计图表
    if (chartData.interaction_stats) {
        const chartContainer = createChartContainer('互动统计', 'interactionStatsChart');
        const canvas = chartContainer.querySelector('canvas');
        if (canvas && window.Chart) {
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                window.reportCharts.interactionStats = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartData.interaction_stats.labels,
                        datasets: [{
                            label: '数量',
                            data: chartData.interaction_stats.values,
                            backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'],
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }, 100);
        }
        chartsGrid.appendChild(chartContainer);
    }
    
    // 2. 时间段活跃度图表
    if (chartData.time_activity) {
        const chartContainer = createChartContainer('时间段活跃度', 'timeActivityChart');
        const canvas = chartContainer.querySelector('canvas');
        if (canvas && window.Chart) {
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                window.reportCharts.timeActivity = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: chartData.time_activity.labels,
                        datasets: [{
                            data: chartData.time_activity.values,
                            backgroundColor: ['#FFB74D', '#4CAF50', '#2196F3', '#9E9E9E']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }, 100);
        }
        chartsGrid.appendChild(chartContainer);
    }
    
    // 3. 位置偏好图表
    if (chartData.location_preferences && chartData.location_preferences.labels && chartData.location_preferences.labels.length > 0) {
        const chartContainer = createChartContainer('位置偏好', 'locationPreferencesChart');
        const canvas = chartContainer.querySelector('canvas');
        if (canvas && window.Chart) {
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                window.reportCharts.locationPreferences = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: chartData.location_preferences.labels,
                        datasets: [{
                            data: chartData.location_preferences.values,
                            backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }, 100);
        }
        chartsGrid.appendChild(chartContainer);
    }
    
    // 4. 投缘度排行榜
    if (chartData.compatibility_ranking && chartData.compatibility_ranking.labels && chartData.compatibility_ranking.labels.length > 0) {
        const chartContainer = createChartContainer('投缘度排行榜', 'compatibilityRankingChart');
        const canvas = chartContainer.querySelector('canvas');
        if (canvas && window.Chart) {
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                window.reportCharts.compatibilityRanking = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartData.compatibility_ranking.labels,
                        datasets: [{
                            label: '投缘度 (%)',
                            data: chartData.compatibility_ranking.values,
                            backgroundColor: function(context) {
                                const value = context.parsed.y;
                                if (value >= 80) return '#4CAF50';
                                if (value >= 60) return '#8BC34A';
                                if (value >= 40) return '#FFC107';
                                return '#FF9800';
                            },
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                beginAtZero: true,
                                max: 100
                            }
                        }
                    }
                });
            }, 100);
        }
        chartsGrid.appendChild(chartContainer);
    }
    
    // 5. 互动模式分布
    if (chartData.interaction_patterns) {
        const chartContainer = createChartContainer('互动模式分布', 'interactionPatternsChart');
        const canvas = chartContainer.querySelector('canvas');
        if (canvas && window.Chart) {
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                window.reportCharts.interactionPatterns = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: chartData.interaction_patterns.labels,
                        datasets: [{
                            data: chartData.interaction_patterns.values,
                            backgroundColor: ['#2196F3', '#4CAF50']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }, 100);
        }
        chartsGrid.appendChild(chartContainer);
    }
    
    section.appendChild(chartsGrid);
    return section;
}

function createChartContainer(title, chartId) {
    const container = document.createElement('div');
    container.className = 'chart-container';
    container.innerHTML = `
        <h3>${title}</h3>
        <div class="chart-wrapper">
            <canvas id="${chartId}"></canvas>
        </div>
    `;
    return container;
}

function createCompatibilitySection(compatibilities) {
    const section = document.createElement('div');
    section.className = 'report-section compatibility-section';
    
    // 按投缘度排序
    const sorted = [...compatibilities].sort((a, b) => 
        (b.overall_compatibility || 0) - (a.overall_compatibility || 0)
    );
    
    if (sorted.length === 0) {
        section.innerHTML = `
            <h2><i class="fas fa-heart"></i> 与其他Agent的投缘度分析</h2>
            <div class="empty-state">
                <p>暂无投缘度数据</p>
            </div>
        `;
        return section;
    }
    
    section.innerHTML = `
        <h2><i class="fas fa-heart"></i> 与其他Agent的投缘度分析</h2>
        <div class="compatibility-intro">
            <p>基于兴趣相似度、MBTI兼容度、互动频率和社交目标匹配度计算的综合投缘度</p>
        </div>
        <div class="compatibility-grid">
            ${sorted.slice(0, 10).map(comp => {
                const overall = (comp.overall_compatibility || 0) * 100;
                const scores = comp.scores || {};
                const agent2Name = comp.agent2_name || comp.agent2_code || '未知';
                return `
                    <div class="compatibility-card">
                        <div class="compatibility-header">
                            <h3>${escapeHtml(agent2Name)}</h3>
                            <div class="compatibility-score ${getCompatibilityClass(overall)}">
                                ${overall.toFixed(0)}%
                            </div>
                        </div>
                        <div class="compatibility-details">
                            <div class="compatibility-bars">
                                <div class="bar-item">
                                    <span class="bar-label">兴趣相似度</span>
                                    <div class="bar">
                                        <div class="bar-fill" style="width: ${Math.min((scores.interests || 0) * 100, 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${((scores.interests || 0) * 100).toFixed(0)}%</span>
                                </div>
                                <div class="bar-item">
                                    <span class="bar-label">MBTI兼容度</span>
                                    <div class="bar">
                                        <div class="bar-fill" style="width: ${Math.min((scores.mbti || 0) * 100, 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${((scores.mbti || 0) * 100).toFixed(0)}%</span>
                                </div>
                                <div class="bar-item">
                                    <span class="bar-label">互动频率</span>
                                    <div class="bar">
                                        <div class="bar-fill" style="width: ${Math.min((scores.interaction || 0) * 100, 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${((scores.interaction || 0) * 100).toFixed(0)}%</span>
                                </div>
                                <div class="bar-item">
                                    <span class="bar-label">目标匹配度</span>
                                    <div class="bar">
                                        <div class="bar-fill" style="width: ${Math.min((scores.goals || 0) * 100, 100)}%"></div>
                                    </div>
                                    <span class="bar-value">${((scores.goals || 0) * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            ${comp.description ? `<div class="compatibility-desc">${escapeHtml(comp.description)}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
}


function createStatsSection(stats) {
    const section = document.createElement('div');
    section.className = 'report-section stats-section';
    
    const totalInteractions = stats.total_interactions || 0;
    const uniqueContacts = stats.unique_contacts_count || 0;
    const totalMovements = stats.total_movements || 0;
    const behaviorStats = window.reportData?.behavior_analysis?.stats || {};
    const initiatedInteractions = behaviorStats.initiated_interactions || 0;
    const receivedInteractions = behaviorStats.received_interactions || 0;
    
    section.innerHTML = `
        <h2><i class="fas fa-chart-line"></i> 统计信息</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-comments"></i></div>
                <div class="stat-value">${totalInteractions}</div>
                <div class="stat-label">总互动次数</div>
            </div>
            ${initiatedInteractions > 0 || receivedInteractions > 0 ? `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
                <div class="stat-value">${initiatedInteractions}</div>
                <div class="stat-label">发起互动</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-user-check"></i></div>
                <div class="stat-value">${receivedInteractions}</div>
                <div class="stat-label">接收互动</div>
            </div>
            ` : ''}
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-value">${uniqueContacts}</div>
                <div class="stat-label">接触的Agent数</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-walking"></i></div>
                <div class="stat-value">${totalMovements}</div>
                <div class="stat-label">移动次数</div>
            </div>
        </div>
    `;
    
    return section;
}

function createTimelineSection(keyEvents) {
    const section = document.createElement('div');
    section.className = 'report-section timeline-section';
    
    if (!keyEvents || keyEvents.length === 0) {
        section.innerHTML = `
            <h2><i class="fas fa-clock"></i> 关键事件时间线</h2>
            <div class="empty-state">
                <p>暂无关键事件</p>
            </div>
        `;
        return section;
    }
    
    const eventsToShow = keyEvents.slice(0, 20);
    
    section.innerHTML = `
        <h2><i class="fas fa-clock"></i> 关键事件时间线</h2>
        <div class="timeline-info">
            <p>显示最近 ${eventsToShow.length} 个关键事件</p>
        </div>
        <div class="timeline">
            ${eventsToShow.map(event => {
                const eventType = event.type === 'interaction' ? '💬 互动' :
                                 event.type === 'movement' ? '🚶 移动' :
                                 event.type === 'goal' ? '🎯 目标' : '📝 事件';
                const eventTime = escapeHtml(event.time || '');
                const eventDetail = escapeHtml(event.detail || '');
                return `
                    <div class="timeline-item">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-time">${eventTime}</div>
                            <div class="timeline-type">${eventType}</div>
                            <div class="timeline-detail">${eventDetail}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
}

function getActivityLevelClass(level) {
    const classMap = {
        '非常活跃': 'very-active',
        '活跃': 'active',
        '中等': 'moderate',
        '较低': 'low'
    };
    return classMap[level] || '';
}

function getCompatibilityClass(score) {
    if (score >= 80) return 'very-high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    return 'low';
};

// 导出函数供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showStoryModalWithCharts: window.showStoryModalWithCharts,
        createBehaviorAnalysisSection,
        createChartsSection,
        createCompatibilitySection,
        createStatsSection,
        createTimelineSection,
        getActivityLevelClass,
        getCompatibilityClass
    };
}
