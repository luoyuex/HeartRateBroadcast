// 心率图表页面逻辑
let ws;
let chart;
let heartRateData = [];
let timeData = [];
const MAX_DATA_POINTS = 300; // 最多显示300条数据
let userZoomInteraction = false; // 用户是否进行了缩放操作
let currentZoomRange = { start: 70, end: 100 }; // 当前缩放范围

// DOM 元素
const elements = {
    currentHeartRate: document.getElementById('currentHeartRate'),
    avgHeartRate: document.getElementById('avgHeartRate'),
    maxHeartRate: document.getElementById('maxHeartRate'),
    dataCount: document.getElementById('dataCount'),
    connectionStatus: document.getElementById('connectionStatus'),
    // footer: document.getElementById('footer')
};

// 初始化图表
function initChart() {
    const chartDom = document.getElementById('heartRateChart');
    chart = echarts.init(chartDom);
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            position: function (pt) {
                return [pt[0], '10%'];
            },
            formatter: function(params) {
                const data = params[0];
                return `
                    <div style="padding: 8px;">
                        <div style="color: #dc3545; font-weight: bold; margin-bottom: 4px;">
                            ❤️ ${data.value} bpm
                        </div>
                        <div style="color: #666; font-size: 12px;">
                            ${data.axisValue}
                        </div>
                    </div>
                `;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#dc3545',
            borderWidth: 1,
            textStyle: {
                color: '#333'
            }
        },
        title: {
            left: 'center',
            text: '实时心率监测',
            textStyle: {
                color: '#666',
                fontSize: 16,
                fontWeight: 'normal'
            },
            top: 20
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '15%',
            top: '15%',
            containLabel: true
        },
        toolbox: {
            right: 20,
            top: 60,
            feature: {
                dataZoom: {
                    yAxisIndex: 'none',
                    title: {
                        zoom: '区域缩放',
                        back: '缩放还原'
                    }
                },
                restore: {
                    title: '还原'
                },
                saveAsImage: {
                    title: '保存为图片',
                    name: '心率数据图表'
                }
            },
            iconStyle: {
                normal: {
                    borderColor: '#666'
                },
                emphasis: {
                    borderColor: '#dc3545'
                }
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: [],
            axisLabel: {
                color: '#666',
                formatter: function(value) {
                    // 只显示时:分:秒
                    return value.split(' ')[1] || value;
                }
            },
            axisLine: {
                lineStyle: {
                    color: '#ddd'
                }
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: '#f0f0f0'
                }
            }
        },
        yAxis: {
            type: 'value',
            name: '心率 (bpm)',
            nameTextStyle: {
                color: '#666'
            },
            boundaryGap: [0, '20%'],
            min: function(value) {
                return Math.max(0, value.min - 10);
            },
            max: function(value) {
                return value.max + 10;
            },
            axisLabel: {
                color: '#666'
            },
            axisLine: {
                lineStyle: {
                    color: '#ddd'
                }
            },
            splitLine: {
                lineStyle: {
                    color: '#f0f0f0'
                }
            }
        },
        dataZoom: [
            {
                type: 'inside',
                start: currentZoomRange.start,
                end: currentZoomRange.end
            },
            {
                start: currentZoomRange.start,
                end: currentZoomRange.end,
                handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23.1h6.6V24.4z M13.3,19.6H6.7v-1.2h6.6V19.6z',
                handleSize: '80%',
                handleStyle: {
                    color: '#dc3545',
                    shadowBlur: 3,
                    shadowColor: 'rgba(0, 0, 0, 0.6)',
                    shadowOffsetX: 2,
                    shadowOffsetY: 2
                },
                textStyle: {
                    color: '#666'
                },
                borderColor: '#ddd'
            }
        ],
        series: [
            {
                name: '心率',
                type: 'line',
                symbol: 'circle',
                symbolSize: 4,
                sampling: 'lttb',
                itemStyle: {
                    color: '#dc3545'
                },
                lineStyle: {
                    color: '#dc3545',
                    width: 2
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: 'rgba(220, 53, 69, 0.3)'
                        },
                        {
                            offset: 1,
                            color: 'rgba(220, 53, 69, 0.05)'
                        }
                    ])
                },
                data: []
            }
        ]
    };

    chart.setOption(option);
    
    // 监听dataZoom事件，保存用户的缩放状态
    chart.on('dataZoom', function (params) {
        // 用户主动操作了缩放
        userZoomInteraction = true;
        if (params.batch && params.batch.length > 0) {
            const zoom = params.batch[0];
            currentZoomRange = { start: zoom.start, end: zoom.end };
        } else {
            currentZoomRange = { start: params.start, end: params.end };
        }
        console.log('📊 用户缩放操作:', currentZoomRange);
    });
    
    // 响应窗口大小变化
    window.addEventListener('resize', () => {
        chart.resize();
    });
}

// 连接WebSocket
function connectWebSocket() {
    updateFooter('正在连接心率数据服务...', 'connecting');
    
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('心率图表WebSocket连接已建立');
        updateFooter('已连接到心率数据服务', 'connected');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error('解析心率数据消息错误:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('心率图表WebSocket连接已关闭');
        updateFooter('连接断开，正在重连...', 'error');
        updateConnectionStatus(false);
        
        // 3秒后重连
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('心率图表WebSocket错误:', error);
        updateFooter('连接失败', 'error');
        updateConnectionStatus(false);
    };
}

// 处理接收到的消息
function handleMessage(data) {
    switch (data.type) {
        case 'heartRate':
            addHeartRateData(data.value, data.timestamp);
            break;
        case 'connectionStatus':
            updateConnectionStatus(data.connected);
            if (data.connected) {
                updateFooter('已连接到心率设备，正在接收数据...', 'connected');
            } else {
                updateFooter('心率设备已断开连接', 'error');
            }
            break;
        case 'heartRateHistory':
            // 加载历史数据
            if (data.history && Array.isArray(data.history)) {
                loadHistoryData(data.history);
            }
            break;
        case 'bluetoothStatus':
            // 处理蓝牙状态
            if (data.state === 'poweredOn') {
                updateFooter('蓝牙已就绪', 'connected');
            } else {
                updateFooter(`蓝牙状态: ${data.state}`, 'error');
                updateConnectionStatus(false);
            }
            break;
        case 'heartRateAnomalies':
            // 处理心率异常
            handleHeartRateAnomalies(data.anomalies);
            break;
        case 'heartRateStatistics':
            // 处理统计信息更新
            if (data.statistics) {
                updateAdvancedStatistics(data.statistics);
            }
            break;
        default:
            console.log('心率图表 - 未知消息类型:', data.type);
    }
}

// 添加心率数据
function addHeartRateData(heartRate, timestamp) {
    const time = new Date(timestamp || Date.now());
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
    
    // 添加新数据
    heartRateData.push(heartRate);
    timeData.push(timeStr);
    
    // 限制数据点数量
    if (heartRateData.length > MAX_DATA_POINTS) {
        heartRateData.shift();
        timeData.shift();
    }
    
    // 更新图表
    updateChart();
    
    // 更新统计信息
    updateStatistics();
    
    console.log(`📈 添加心率数据: ${heartRate} bpm at ${timeStr}`);
}

// 加载历史数据
function loadHistoryData(history) {
    console.log(`📊 加载历史心率数据: ${history.length} 条`);
    
    heartRateData = [];
    timeData = [];
    
    // 只取最新的300条数据
    const recentHistory = history.slice(-MAX_DATA_POINTS);
    
    recentHistory.forEach(item => {
        const time = new Date(item.timestamp);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
        
        heartRateData.push(item.value);
        timeData.push(timeStr);
    });
    
    // 更新图表和统计信息
    updateChart();
    updateStatistics();
}

// 更新图表
function updateChart() {
    if (!chart) return;
    
    // 只更新数据，不重置缩放
    chart.setOption({
        xAxis: {
            data: timeData
        },
        series: [{
            data: heartRateData
        }]
    });
    
    // 只有在用户没有进行过缩放操作时才自动滚动到最新数据
    if (!userZoomInteraction && heartRateData.length > 50) {
        const endPercent = 100;
        const startPercent = Math.max(0, 100 - (50 / heartRateData.length * 100));
        
        currentZoomRange = { start: startPercent, end: endPercent };
        
        chart.setOption({
            dataZoom: [
                {
                    start: startPercent,
                    end: endPercent
                },
                {
                    start: startPercent,
                    end: endPercent
                }
            ]
        });
    }
}

let anomalyMarkers = []; // 存储异常标记

// 处理心率异常
function handleHeartRateAnomalies(anomalies) {
    console.log('📊 收到心率异常信息:', anomalies);
    
    if (!chart) return;
    
    // 在图表上标记异常点
    const currentTime = timeData[timeData.length - 1];
    const currentValue = heartRateData[heartRateData.length - 1];
    
    anomalies.forEach(anomaly => {
        const marker = {
            time: currentTime,
            value: currentValue,
            anomaly: anomaly,
            timestamp: Date.now()
        };
        
        anomalyMarkers.push(marker);
        
        // 限制异常标记数量
        if (anomalyMarkers.length > 50) {
            anomalyMarkers.shift();
        }
        
        // 显示异常通知
        showAnomalyNotification(anomaly);
    });
    
    // 更新图表标记
    updateChartMarkers();
}

// 更新图表标记
function updateChartMarkers() {
    if (!chart || anomalyMarkers.length === 0) return;
    
    // 创建异常点的标记数据
    const markPointData = anomalyMarkers
        .filter(marker => timeData.includes(marker.time))
        .map(marker => {
            const timeIndex = timeData.indexOf(marker.time);
            if (timeIndex !== -1) {
                return {
                    coord: [timeIndex, marker.value],
                    value: marker.anomaly.type,
                    symbol: 'triangle',
                    symbolSize: 8,
                    itemStyle: {
                        color: marker.anomaly.severity === 'critical' ? '#dc3545' : 
                               marker.anomaly.severity === 'warning' ? '#ffc107' : '#17a2b8'
                    },
                    label: {
                        show: false
                    }
                };
            }
        })
        .filter(Boolean);
    
    // 更新图表
    chart.setOption({
        series: [{
            markPoint: {
                data: markPointData,
                symbol: 'triangle',
                symbolSize: 8
            }
        }]
    });
}

// 更新高级统计信息
function updateAdvancedStatistics(statistics) {
    if (statistics) {
        // 更新现有的统计显示
        elements.currentHeartRate.textContent = statistics.current || '--';
        elements.avgHeartRate.textContent = statistics.average || '--';
        elements.maxHeartRate.textContent = statistics.max || '--';
        elements.dataCount.textContent = statistics.count || '0';
        
        // 可以在这里添加更多高级统计信息的显示
        console.log('📊 高级统计信息:', statistics);
    }
}

// 更新统计信息
function updateStatistics() {
    if (heartRateData.length === 0) {
        elements.currentHeartRate.textContent = '--';
        elements.avgHeartRate.textContent = '--';
        elements.maxHeartRate.textContent = '--';
        elements.dataCount.textContent = '0';
        return;
    }
    
    const current = heartRateData[heartRateData.length - 1];
    const avg = Math.round(heartRateData.reduce((sum, val) => sum + val, 0) / heartRateData.length);
    const max = Math.max(...heartRateData);
    const count = heartRateData.length;
    
    elements.currentHeartRate.textContent = current;
    elements.avgHeartRate.textContent = avg;
    elements.maxHeartRate.textContent = max;
    elements.dataCount.textContent = count;
}

// 更新连接状态
function updateConnectionStatus(connected) {
    const statusElement = elements.connectionStatus;
    
    if (connected) {
        statusElement.textContent = '已连接';
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.textContent = '未连接';
        statusElement.className = 'connection-status disconnected';
    }
}

// 更新页脚信息
function updateFooter(message, type = 'info') {
    // elements.footer.textContent = message;
    // elements.footer.className = `footer ${type}`;
}

// 请求历史数据
function requestHistoryData() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'requestHeartRateHistory'
        }));
    }
}

// 页面加载完成时初始化
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 心率图表页面已加载');
    
    // 初始化图表
    initChart();
    
    // 连接WebSocket
    connectWebSocket();
    
    // 延迟请求历史数据
    setTimeout(() => {
        requestHistoryData();
    }, 1000);
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
    if (chart) {
        chart.dispose();
    }
});

// 增强异常通知显示
function showAnomalyNotification(anomaly) {
    const severityColors = {
        'info': '#17a2b8',
        'warning': '#ffc107', 
        'critical': '#dc3545'
    };
    
    const severityEmojis = {
        'info': 'ℹ️',
        'warning': '⚠️',
        'critical': '🚨'
    };
    
    const severityTitles = {
        'info': '心率信息提醒',
        'warning': '心率异常警告', 
        'critical': '严重心率异常'
    };
    
    const color = severityColors[anomaly.severity] || '#6c757d';
    const emoji = severityEmojis[anomaly.severity] || '⚠️';
    const title = severityTitles[anomaly.severity] || '心率提醒';
    
    // 显示强化弹窗提醒
    showAlertModal(anomaly, emoji, title);
    
    // 页面闪烁效果（仅严重异常）
    if (anomaly.severity === 'critical') {
        document.body.classList.add('page-flash');
        setTimeout(() => {
            document.body.classList.remove('page-flash');
        }, 1500);
    }
    
    // 播放提醒音效
    playAlertSound(anomaly.severity);
    
    // 在页脚显示异常信息
    updateFooter(`${emoji} ${anomaly.message}`, 'error');
    
    // 在控制台显示详细信息
    console.log(`${emoji} ${anomaly.severity.toUpperCase()}: ${anomaly.message}`);
    
    // 创建系统通知
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(`Spark - ${title}`, {
            body: `${emoji} ${anomaly.message}`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + color + '"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            tag: 'heart-rate-anomaly-' + Date.now(),
            requireInteraction: anomaly.severity === 'critical', // 严重异常需要用户手动关闭
            silent: false
        });
        
        // 点击通知时聚焦窗口
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        // 自动关闭通知
        if (anomaly.severity !== 'critical') {
            setTimeout(() => notification.close(), 5000);
        }
    }
    
    // 5秒后恢复正常状态显示
    setTimeout(() => {
        updateFooter('监测中...', 'connected');
    }, 5000);
}

// 全局变量
let alertMuted = false;
let alertQueue = [];
let currentAlert = null;

// 显示弹窗提醒
function showAlertModal(anomaly, emoji, title) {
    // 如果已静音且不是严重异常，则跳过
    if (alertMuted && anomaly.severity !== 'critical') {
        return;
    }
    
    // 如果当前有弹窗显示，加入队列
    if (currentAlert) {
        alertQueue.push({anomaly, emoji, title});
        return;
    }
    
    currentAlert = anomaly;
    
    // 获取DOM元素
    const modal = document.getElementById('alertModal');
    const content = document.getElementById('alertContent');
    const icon = document.getElementById('alertIcon');
    const titleEl = document.getElementById('alertTitle');
    const subtitle = document.getElementById('alertSubtitle');
    const message = document.getElementById('alertMessage');
    const details = document.getElementById('alertDetails');
    
    // 设置内容
    icon.textContent = emoji;
    titleEl.textContent = title;
    subtitle.textContent = `检测时间: ${new Date().toLocaleTimeString()}`;
    message.textContent = anomaly.message;
    
    // 设置详细信息
    let detailsText = `异常类型: ${getAnomalyTypeText(anomaly.type)}\n`;
    detailsText += `严重程度: ${getSeverityText(anomaly.severity)}\n`;
    if (anomaly.value !== undefined) {
        detailsText += `当前心率: ${anomaly.value} bpm\n`;
    }
    if (anomaly.threshold !== undefined) {
        detailsText += `阈值: ${anomaly.threshold}\n`;
    }
    if (anomaly.change !== undefined) {
        detailsText += `变化幅度: ${anomaly.change} bpm\n`;
    }
    
    details.textContent = detailsText;
    
    // 设置样式
    content.className = `alert-content alert-${anomaly.severity}`;
    
    // 显示弹窗
    modal.style.display = 'block';
    
    // 严重异常自动关闭时间更长
    const autoCloseTime = anomaly.severity === 'critical' ? 10000 : 6000;
    setTimeout(() => {
        if (currentAlert === anomaly) {
            acknowledgeAlert();
        }
    }, autoCloseTime);
}

// 确认警告
function acknowledgeAlert() {
    const modal = document.getElementById('alertModal');
    modal.style.display = 'none';
    currentAlert = null;
    
    // 处理队列中的下一个警告
    if (alertQueue.length > 0) {
        const next = alertQueue.shift();
        setTimeout(() => {
            showAlertModal(next.anomaly, next.emoji, next.title);
        }, 500);
    }
}

// 静音警告
function muteAlerts() {
    alertMuted = true;
    acknowledgeAlert();
    
    // 10分钟后自动取消静音
    setTimeout(() => {
        alertMuted = false;
        console.log('🔊 异常提醒已自动取消静音');
    }, 600000); // 10分钟
    
    console.log('🔇 异常提醒已静音10分钟');
}

// 播放提醒音效
function playAlertSound(severity) {
    try {
        // 创建音频上下文
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 根据严重程度选择不同频率和持续时间
        const frequencies = {
            'info': [800, 600],      // 温和的双音
            'warning': [1000, 800, 600], // 三音警告
            'critical': [1200, 1000, 800, 1000, 1200] // 急促五音
        };
        
        const durations = {
            'info': [200, 200],
            'warning': [300, 300, 300], 
            'critical': [150, 150, 150, 150, 150]
        };
        
        const freqs = frequencies[severity] || frequencies.warning;
        const durs = durations[severity] || durations.warning;
        
        let startTime = audioContext.currentTime;
        
        freqs.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, startTime);
            oscillator.type = 'sine';
            
            // 设置音量包络
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, startTime + durs[index] / 1000);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + durs[index] / 1000);
            
            startTime += durs[index] / 1000 + 0.1; // 音符间隔
        });
        
    } catch (error) {
        console.log('无法播放提醒音效:', error);
    }
}

// 辅助函数：获取异常类型文本
function getAnomalyTypeText(type) {
    const typeMap = {
        'high_heart_rate': '心率过高',
        'low_heart_rate': '心率过低',
        'elevated_heart_rate': '心率偏高',
        'rapid_change': '心率急剧变化',
        'low_variability': '心率变异性过低',
        'consecutive_high': '连续高心率',
        'consecutive_low': '连续低心率'
    };
    return typeMap[type] || type;
}

// 辅助函数：获取严重程度文本
function getSeverityText(severity) {
    const severityMap = {
        'info': '信息提醒',
        'warning': '需要注意',
        'critical': '严重异常'
    };
    return severityMap[severity] || severity;
}

// 页面加载时请求桌面通知权限
window.addEventListener('DOMContentLoaded', (event) => {
    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('通知权限状态:', permission);
        });
    }
});