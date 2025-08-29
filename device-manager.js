let ws;
let isScanning = false;
let connectedDevice = null;
let devices = new Map();
let currentHeartRate = '--';
let displayMode = 'desktop'; // 默认桌面显示模式

const elements = {
    status: document.getElementById('status'),
    scanBtn: document.getElementById('scanBtn'),
    stopBtn: document.getElementById('stopBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    deviceList: document.getElementById('deviceList'),
    connectionInfo: document.getElementById('connectionInfo'),
    heartDisplay: document.getElementById('heartDisplay'),
    heartRate: document.getElementById('heartRate'),
    footer: document.getElementById('footer')
};

function connectWebSocket() {
    updateFooter('正在连接通信服务...', 'connecting');
    
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        updateFooter('通信已连接', 'connected');
        // 初始状态显示，等待蓝牙状态
        updateStatus('等待蓝牙状态...', 'info');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error('解析消息错误:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        updateFooter('通信连接断开，正在重连...', 'error');
        enableControls(false);
        
        // 3秒后重连
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        updateFooter('通信连接失败', 'error');
        updateStatus('无法连接设备管理器，请确保应用正在运行', 'error');
        enableControls(false);
    };
}

function handleMessage(data) {
    console.log('📨 收到消息:', data.type, data);
    
    switch (data.type) {
        case 'deviceList':
            updateDeviceList(data.devices);
            break;
        case 'deviceFound':
            addDevice(data.device);
            break;
        case 'deviceUpdate':
            updateDevice(data.device);
            break;
        case 'scanStatus':
            updateScanStatus(data.scanning);
            break;
        case 'connectionStatus':
            updateConnectionStatus(data);
            break;
        case 'heartRate':
            updateHeartRate(data.value);
            break;
        case 'bluetoothStatus':
            updateBluetoothStatus(data);
            break;
        case 'connectionError':
            updateStatus(`连接错误: ${data.message}`, 'error');
            break;
        case 'displayModeSync':
            // 同步主进程的显示模式设置
            if (data.mode && (data.mode === 'desktop' || data.mode === 'icon')) {
                displayMode = data.mode;
                const radioButton = document.querySelector(`input[name="displayMode"][value="${data.mode}"]`);
                if (radioButton) {
                    radioButton.checked = true;
                }
            }
            break;
        case 'heartRateAnomalies':
            handleHeartRateAnomalies(data.anomalies);
            break;
        default:
            console.log('未知消息类型:', data.type);
    }
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        updateStatus('未连接到设备管理器', 'error');
    }
}

function updateStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
}

function updateFooter(message, type = 'info') {
    elements.footer.textContent = message;
    elements.footer.className = `footer ${type}`;
}

function enableControls(enabled) {
    // 只有在WebSocket连接且蓝牙可用时才启用扫描按钮
    if (enabled) {
        elements.scanBtn.disabled = false;
        // 停止和断开按钮根据当前状态决定
        elements.stopBtn.disabled = !isScanning;
        elements.disconnectBtn.disabled = !connectedDevice;
    } else {
        elements.scanBtn.disabled = true;
        elements.stopBtn.disabled = true;
        elements.disconnectBtn.disabled = true;
    }
}

function updateBluetoothStatus(data) {
    const { state, platform, error } = data;
    console.log('蓝牙状态:', state, platform);
    
    if (state === 'poweredOn') {
        updateStatus('蓝牙已就绪，可以开始扫描', 'success');
        elements.scanBtn.disabled = false;
        return;
    }
    
    // Windows 平台特殊处理
    if (platform === 'windows' && state === 'unsupported') {
        updateStatus('Windows 蓝牙不支持 - 请以管理员身份运行应用', 'error');
        showWindowsBluetoothHelp();
        elements.scanBtn.disabled = true;
        elements.stopBtn.disabled = true;
        return;
    }
    
    // 其他蓝牙状态
    const stateMessages = {
        'unknown': '蓝牙状态未知',
        'resetting': '蓝牙正在重置...',
        'unsupported': '设备不支持蓝牙',
        'unauthorized': '蓝牙权限被拒绝',
        'poweredOff': '蓝牙已关闭，请打开蓝牙'
    };
    
    const message = stateMessages[state] || `蓝牙状态: ${state}`;
    const statusType = (state === 'poweredOff') ? 'warning' : 'error';
    
    updateStatus(`${message} - 请检查蓝牙设置`, statusType);
    elements.scanBtn.disabled = true;
    elements.stopBtn.disabled = true;
}

function showWindowsBluetoothHelp() {
    // 在设备列表区域显示 Windows 蓝牙帮助
    elements.deviceList.innerHTML = `
        <div class="windows-help">
            <div class="help-title">🔧 Windows 蓝牙配置帮助</div>
            <div class="help-content">
                <h4>解决步骤：</h4>
                <ol>
                    <li><strong>以管理员身份运行</strong><br>右键应用图标 → 以管理员身份运行</li>
                    <li><strong>检查蓝牙驱动</strong><br>设备管理器 → 蓝牙 → 确保驱动正常</li>
                    <li><strong>启用蓝牙服务</strong><br>Win+R → services.msc → 启动 "Bluetooth Support Service"</li>
                    <li><strong>重启蓝牙适配器</strong><br>设备管理器 → 禁用后重新启用蓝牙适配器</li>
                </ol>
                <div class="help-note">
                    💡 Windows 10/11 需要支持蓝牙 LE (低功耗蓝牙)
                </div>
            </div>
        </div>
    `;
}

function updateScanStatus(scanning) {
    isScanning = scanning;
    elements.scanBtn.disabled = scanning;
    elements.stopBtn.disabled = !scanning;
    
    if (scanning) {
        elements.scanBtn.textContent = '正在扫描...';
        elements.scanBtn.className = 'btn btn-primary scanning';
        updateStatus('正在扫描蓝牙设备...', 'info');
        
        // 开始扫描时重置设备计数
        scanStats = { total: 0, heartRate: 0, startTime: Date.now() };
        updateScanStats();
    } else {
        elements.scanBtn.textContent = '开始扫描设备';
        elements.scanBtn.className = 'btn btn-primary';
        updateStatus(`扫描完成，发现 ${scanStats.total} 个设备`, 'success');
    }
}

// 扫描统计
let scanStats = { total: 0, heartRate: 0, startTime: 0 };

function updateScanStats() {
    if (isScanning) {
        const elapsed = Math.floor((Date.now() - scanStats.startTime) / 1000);
        updateStatus(`扫描中... ${elapsed}s | 发现 ${scanStats.total} 个设备 (${scanStats.heartRate} 个心率设备)`, 'info');
    }
}

function updateConnectionStatus(data) {
    if (data.connected) {
        connectedDevice = data.device;
        elements.disconnectBtn.disabled = false;
        updateStatus(`已连接到 ${data.device.name}`, 'success');
        elements.connectionInfo.style.display = 'none';
        elements.heartDisplay.style.display = 'block';
        
        // 更新设备列表中的连接状态
        updateDeviceConnectionStatus(data.device.id, true);
    } else {
        connectedDevice = null;
        elements.disconnectBtn.disabled = true;
        elements.connectionInfo.style.display = 'block';
        elements.heartDisplay.style.display = 'none';
        elements.connectionInfo.textContent = '请先扫描并连接心率设备';
        
        // 清除所有设备的连接状态
        updateDeviceConnectionStatus(null, false);
    }
}

function updateHeartRate(value) {
    currentHeartRate = value; // 保存当前心率值
    elements.heartRate.textContent = value;
    
    // 根据心率调整动画速度
    const heartIcon = document.querySelector('.heart-beat');
    if (heartIcon && value > 0) {
        const duration = 60 / value; // 根据心率调整动画速度
        heartIcon.style.animationDuration = `${duration}s`;
    }
}


function updateDeviceList(deviceList) {
    console.log(`📋 更新设备列表: 收到 ${deviceList.length} 个设备`);
    devices.clear();
    scanStats.total = 0;
    scanStats.heartRate = 0;
    
    deviceList.forEach(device => {
        devices.set(device.id, device);
        scanStats.total++;
        if (device.hasHeartRate) {
            scanStats.heartRate++;
        }
        console.log(`  📱 加载设备: ${device.name} [${device.id}] ${device.hasHeartRate ? '❤️' : ''}`);
    });
    
    renderDeviceList();
    
    if (isScanning) {
        updateScanStats();
    }
}

function addDevice(device) {
    console.log(`➕ 添加设备: ${device.name} [${device.id}] ${device.hasHeartRate ? '❤️' : ''}`);
    
    if (!devices.has(device.id)) {
        // 新设备
        scanStats.total++;
        if (device.hasHeartRate) {
            scanStats.heartRate++;
        }
        updateScanStats();
    }
    
    devices.set(device.id, device);
    renderDeviceList();
    
    console.log(`📊 当前设备总数: ${devices.size}`);
}

function updateDevice(deviceUpdate) {
    const device = devices.get(deviceUpdate.id);
    if (device) {
        Object.assign(device, deviceUpdate);
        renderDeviceList();
    }
}

function updateDeviceConnectionStatus(deviceId, connected) {
    const deviceItems = document.querySelectorAll('.device-item');
    deviceItems.forEach(item => {
        if (connected && item.dataset.deviceId === deviceId) {
            item.classList.add('connected');
        } else {
            item.classList.remove('connected');
        }
    });
}

function renderDeviceList() {
    const deviceArray = Array.from(devices.values());
    
    console.log(`📱 渲染设备列表: ${deviceArray.length} 个设备`);
    deviceArray.forEach(device => {
        console.log(`  - ${device.name} [${device.id}] ${device.hasHeartRate ? '❤️' : ''}`);
    });
    
    if (deviceArray.length === 0) {
        elements.deviceList.innerHTML = '<div class="empty-state">暂无发现设备</div>';
        return;
    }
    
    // 优先级排序：心率设备 > 可穿戴设备 > 其他设备，然后按信号强度排序
    deviceArray.sort((a, b) => {
        // 首先按是否支持心率服务排序
        if (a.hasHeartRate !== b.hasHeartRate) {
            return b.hasHeartRate ? 1 : -1;
        }
        
        // 然后按设备类型重要性排序
        const typeWeight = {
            'heartrate': 10,
            'wearable': 8,
            'fitness': 6,
            'smart': 4,
            'device': 2,
            'mobile': 1,
            'audio': 1,
            'unknown': 0
        };
        
        const aWeight = a.deviceType ? typeWeight[a.deviceType.category] || 0 : 0;
        const bWeight = b.deviceType ? typeWeight[b.deviceType.category] || 0 : 0;
        
        if (aWeight !== bWeight) {
            return bWeight - aWeight;
        }
        
        // 最后按RSSI排序（信号强度从强到弱）
        return (b.rssi || -100) - (a.rssi || -100);
    });
    
    const html = deviceArray.map(device => {
        const deviceType = device.deviceType || { icon: '📡', name: '蓝牙设备' };
        const heartIcon = device.hasHeartRate ? '<span class="heart-icon">❤️</span>' : '';
        const rssiColor = getRssiColor(device.rssi);
        
        // 设备标识
        const typeIndicator = device.hasHeartRate ? 
            `<span class="device-type heartrate">❤️ 心率设备</span>` :
            `<span class="device-type">${deviceType.icon} ${deviceType.name}</span>`;
        
        // 服务信息
        const serviceInfo = device.serviceCount ? 
            `<span class="service-count">${device.serviceCount} 个服务</span>` : 
            '';
        
        return `
            <div class="device-item ${device.hasHeartRate ? 'priority' : ''}" data-device-id="${device.id}" onclick="connectDevice('${device.id}')">
                <div class="device-header">
                    <div class="device-name">
                        ${device.name} ${heartIcon}
                    </div>
                    <div class="device-rssi" style="background: ${rssiColor}">
                        ${device.rssi || 'N/A'} dBm
                    </div>
                </div>
                <div class="device-info">
                    <div class="device-address">${device.address}</div>
                    ${typeIndicator}
                    ${serviceInfo}
                </div>
            </div>
        `;
    }).join('');
    
    elements.deviceList.innerHTML = html;
}

function getRssiColor(rssi) {
    if (!rssi) return 'rgba(255, 255, 255, 0.2)';
    if (rssi > -50) return 'rgba(0, 255, 0, 0.3)'; // 绿色 - 信号很强
    if (rssi > -70) return 'rgba(255, 255, 0, 0.3)'; // 黄色 - 信号一般
    return 'rgba(255, 0, 0, 0.3)'; // 红色 - 信号较弱
}

function startScan() {
    sendMessage({ type: 'startScan' });
    devices.clear();
    scanStats = { total: 0, heartRate: 0, startTime: Date.now() };
    renderDeviceList();
    
    // 每秒更新扫描统计
    const progressTimer = setInterval(() => {
        if (isScanning) {
            updateScanStats();
        } else {
            clearInterval(progressTimer);
        }
    }, 1000);
}

function stopScan() {
    sendMessage({ type: 'stopScan' });
}

function connectDevice(deviceId) {
    const device = devices.get(deviceId);
    if (!device) return;
    
    updateStatus(`正在连接到 ${device.name}...`, 'info');
    sendMessage({ type: 'connectDevice', deviceId: deviceId });
}

function disconnect() {
    sendMessage({ type: 'disconnect' });
    updateStatus('正在断开连接...', 'info');
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
    // 初始化按钮状态
    elements.scanBtn.disabled = true;
    elements.stopBtn.disabled = true;
    elements.disconnectBtn.disabled = true;
    
    // 加载保存的显示模式设置
    const savedMode = localStorage.getItem('heartRateDisplayMode');
    if (savedMode && (savedMode === 'desktop' || savedMode === 'icon')) {
        displayMode = savedMode;
        // 更新界面中的单选按钮状态
        const radioButton = document.querySelector(`input[name="displayMode"][value="${savedMode}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }
    
    updateStatus('正在启动应用...', 'info');
    updateFooter('启动通信服务...', 'connecting');
    connectWebSocket();
});

// 切换心率显示模式
function changeDisplayMode(mode) {
    displayMode = mode;
    console.log('心率显示模式已切换到:', mode);
    
    // 发送设置变更消息到主进程
    sendMessage({
        type: 'displayModeChange',
        mode: mode,
        currentHeartRate: currentHeartRate
    });
    
    // 保存设置到本地存储
    localStorage.setItem('heartRateDisplayMode', mode);
}

// 打开心率图表窗口
function openHeartRateChart() {
    console.log('打开心率图表窗口');
    
    // 发送消息到主进程请求打开图表窗口
    sendMessage({
        type: 'openHeartRateChart'
    });
}

// ========== 异常提醒功能 ==========

let alertBannerTimeout = null;

// 处理心率异常
function handleHeartRateAnomalies(anomalies) {
    console.log('⚠️ 收到心率异常:', anomalies);
    
    if (!anomalies || anomalies.length === 0) return;
    
    // 显示最严重的异常
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    const warningAnomalies = anomalies.filter(a => a.severity === 'warning');
    const infoAnomalies = anomalies.filter(a => a.severity === 'info');
    
    let mostSevereAnomaly;
    if (criticalAnomalies.length > 0) {
        mostSevereAnomaly = criticalAnomalies[0];
    } else if (warningAnomalies.length > 0) {
        mostSevereAnomaly = warningAnomalies[0];
    } else {
        mostSevereAnomaly = infoAnomalies[0];
    }
    
    if (mostSevereAnomaly) {
        showAlertBanner(mostSevereAnomaly);
    }
}

// 显示异常横幅
function showAlertBanner(anomaly) {
    const banner = document.getElementById('alertBanner');
    const icon = document.getElementById('alertBannerIcon');
    const text = document.getElementById('alertBannerText');
    
    if (!banner || !icon || !text) return;
    
    const severityEmojis = {
        'info': 'ℹ️',
        'warning': '⚠️',
        'critical': '🚨'
    };
    
    const emoji = severityEmojis[anomaly.severity] || '⚠️';
    
    // 设置内容
    icon.textContent = emoji;
    text.textContent = anomaly.message;
    
    // 设置样式
    banner.className = `alert-banner ${anomaly.severity}`;
    
    // 显示横幅
    banner.style.display = 'flex';
    
    // 清除之前的自动隐藏定时器
    if (alertBannerTimeout) {
        clearTimeout(alertBannerTimeout);
    }
    
    // 根据严重程度设置自动隐藏时间
    const autoHideTime = {
        'info': 8000,      // 8秒
        'warning': 12000,   // 12秒
        'critical': 20000   // 20秒
    };
    
    const hideTime = autoHideTime[anomaly.severity] || 10000;
    
    alertBannerTimeout = setTimeout(() => {
        closeAlertBanner();
    }, hideTime);
    
    console.log(`🚨 显示异常横幅: ${anomaly.message} (${anomaly.severity})`);
}

// 关闭异常横幅
function closeAlertBanner() {
    const banner = document.getElementById('alertBanner');
    if (banner) {
        banner.style.display = 'none';
    }
    
    if (alertBannerTimeout) {
        clearTimeout(alertBannerTimeout);
        alertBannerTimeout = null;
    }
}