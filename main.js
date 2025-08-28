const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const noble = require("@abandonware/noble");
const WebSocket = require('ws');

// 在最开始就设置应用名称
app.setName('Spark');

// 设置应用的用户数据目录名称
app.setPath('userData', path.join(app.getPath('appData'), 'Spark'));

let mainWindow;
let deviceManagerWindow;
let tray = null;
let currentHeartRate = '--';
let heartRateDisplayMode = 'desktop'; // 默认桌面显示模式
let defaultTrayIcon = null; // 保存默认托盘图标

// 蓝牙设备管理
const HEART_RATE_SERVICE_UUID = "180d";
const HEART_RATE_MEASUREMENT_UUID = "2a37";
const discoveredDevices = new Map();
let currentConnection = null;
let isScanning = false;
let wss;

// 启动WebSocket服务器
function startWebSocketServer() {
  wss = new WebSocket.Server({ port: 8080 });
  console.log('WebSocket服务器启动在端口8080');

  wss.on('connection', (ws) => {
    console.log('新的客户端连接');
    
    // 发送当前设备列表
    ws.send(JSON.stringify({
      type: 'deviceList',
      devices: Array.from(discoveredDevices.values()).map(d => ({
        id: d.id,
        name: d.name,
        address: d.address,
        rssi: d.rssi,
        hasHeartRate: d.hasHeartRate,
        deviceType: d.deviceType,
        serviceCount: d.serviceUuids ? d.serviceUuids.length : 0
      }))
    }));
    
    // 发送蓝牙状态
    ws.send(JSON.stringify({
      type: 'bluetoothStatus',
      state: noble.state
    }));
    
    // 发送当前心率显示模式设置
    ws.send(JSON.stringify({
      type: 'displayModeSync',
      mode: heartRateDisplayMode
    }));
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleClientMessage(data, ws);
      } catch (error) {
        console.error('处理客户端消息错误:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('客户端断开连接');
    });
  });
}

// 广播消息到所有客户端
function broadcast(message) {
  if (!wss) return;
  
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 处理客户端消息
async function handleClientMessage(data, ws) {
  switch (data.type) {
    case 'startScan':
      await startDeviceScan();
      break;
    case 'stopScan':
      stopDeviceScan();
      break;
    case 'connectDevice':
      await connectToDevice(data.deviceId);
      break;
    case 'disconnect':
      await disconnectDevice();
      break;
    case 'displayModeChange':
      handleDisplayModeChange(data.mode);
      break;
    default:
      console.log('未知消息类型:', data.type);
  }
}

// 处理显示模式变更
function handleDisplayModeChange(mode) {
  console.log('切换心率显示模式到:', mode);
  heartRateDisplayMode = mode;
  
  // 保存设置到文件
  saveHeartRateDisplayMode(mode);
  
  if (mode === 'desktop') {
    // 桌面显示模式 - 显示心率窗口，恢复默认托盘图标
    if (!mainWindow) {
      createHeartRateWindow();
    } else {
      mainWindow.show();
    }
    // 恢复默认托盘图标
    restoreDefaultTrayIcon();
  } else if (mode === 'icon') {
    // 托盘图标显示模式 - 隐藏心率窗口，使用动态心率图标
    if (mainWindow) {
      mainWindow.hide();
    }
    updateTrayIcon();
  }
}

// 启动设备扫描
async function startDeviceScan() {
  if (isScanning) return;
  
  console.log("🔍 开始扫描蓝牙设备...");
  console.log(`📋 清空设备列表 (之前有 ${discoveredDevices.size} 个设备)`);
  
  discoveredDevices.clear();
  isScanning = true;
  
  broadcast({
    type: 'scanStatus',
    scanning: true
  });
  
  // 广播清空设备列表
  broadcast({
    type: 'deviceList',
    devices: []
  });
  
  if (noble.state === 'poweredOn') {
    // 持续扫描，不限制特定服务，允许重复发现
    console.log("📡 启动蓝牙扫描（允许重复发现）");
    await noble.startScanningAsync([], true);
    
    // 设置扫描超时，30秒后自动停止
    setTimeout(() => {
      if (isScanning) {
        console.log("⏰ 扫描超时，自动停止");
        stopDeviceScan();
      }
    }, 30000);
  } else {
    console.log("❌ 蓝牙未就绪，状态:", noble.state);
  }
}

// 停止设备扫描
function stopDeviceScan() {
  if (!isScanning) return;
  
  console.log("🛑 停止扫描");
  console.log(`📊 扫描结果: 发现 ${discoveredDevices.size} 个设备`);
  
  // 列出所有发现的设备 - 添加调试信息
  const devices = Array.from(discoveredDevices.values());
  console.log(`🔍 Map中实际设备数量: ${devices.length}`);
  
  devices.forEach((device, index) => {
    console.log(`  📱 [${index + 1}] ${device.name} [${device.address}] ${device.hasHeartRate ? '❤️' : ''} (ID: ${device.id})`);
  });
  
  noble.stopScanning();
  isScanning = false;
  
  broadcast({
    type: 'scanStatus',
    scanning: false
  });
}

// 连接到指定设备
async function connectToDevice(deviceId) {
  const device = discoveredDevices.get(deviceId);
  if (!device || !device.peripheral) {
    console.log('设备不存在:', deviceId);
    return;
  }
  
  try {
    // 断开现有连接
    await disconnectDevice();
    
    console.log(`连接设备: ${device.name} [${device.address}]`);
    stopDeviceScan();
    
    await device.peripheral.connectAsync();
    currentConnection = device.peripheral;
    
    broadcast({
      type: 'connectionStatus',
      connected: true,
      device: {
        id: deviceId,
        name: device.name,
        address: device.address
      }
    });
    
    // 发现心率服务
    const { characteristics } = await device.peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [HEART_RATE_SERVICE_UUID],
      [HEART_RATE_MEASUREMENT_UUID]
    );
    
    if (characteristics.length > 0) {
      const hrChar = characteristics[0];
      hrChar.on("data", (data) => {
        let hrValue;
        if ((data[0] & 0x01) === 0) {
          hrValue = data.readUInt8(1);
        } else {
          hrValue = data.readUInt16LE(1);
        }
        
        console.log(`❤️ 心率: ${hrValue} bpm`);
        currentHeartRate = hrValue; // 保存当前心率值
        
        broadcast({
          type: 'heartRate',
          value: hrValue,
          timestamp: Date.now()
        });
        
        // 根据显示模式更新相应的界面
        if (heartRateDisplayMode === 'icon') {
          updateTrayIcon();
        }
      });
      
      await hrChar.subscribeAsync();
      console.log("开始监听心率数据...");
    } else {
      console.log("未找到心率测量特征");
    }
    
  } catch (error) {
    console.error('连接设备失败:', error);
    broadcast({
      type: 'connectionError',
      message: error.message
    });
  }
}

// 断开设备连接
async function disconnectDevice() {
  if (currentConnection) {
    try {
      await currentConnection.disconnectAsync();
      console.log('设备已断开连接');
    } catch (error) {
      console.error('断开连接错误:', error);
    }
    
    currentConnection = null;
    currentHeartRate = '--'; // 重置心率值
    
    broadcast({
      type: 'connectionStatus',
      connected: false
    });
    
    // 根据显示模式更新相应的界面
    if (heartRateDisplayMode === 'icon') {
      updateTrayIcon();
    }
  }
}

// 初始化蓝牙
function initBluetooth() {
  // 检查平台兼容性
  if (process.platform === 'win32') {
    console.log('⚠️  Windows 平台蓝牙提示：');
    console.log('1. 确保以管理员权限运行应用');
    console.log('2. 确保蓝牙已启用且驱动正常');
    console.log('3. Windows 10/11 需要蓝牙 LE 支持');
  }
  
  noble.on("stateChange", async (state) => {
    console.log(`蓝牙状态: ${state}`);
    
    // Windows 平台特殊处理
    if (process.platform === 'win32' && state === 'unsupported') {
      console.log('❌ Windows 蓝牙不支持');
      console.log('💡 解决方案：');
      console.log('   1. 右键以管理员身份运行应用');
      console.log('   2. 检查设备管理器中的蓝牙驱动');
      console.log('   3. 确保蓝牙服务正在运行');
      console.log('   4. 重启蓝牙适配器');
      
      broadcast({
        type: 'bluetoothStatus',
        state: state,
        platform: 'windows',
        error: 'Windows蓝牙不支持，请检查驱动和权限'
      });
      return;
    }
    
    broadcast({
      type: 'bluetoothStatus',
      state: state,
      platform: process.platform
    });
    
    if (state === "poweredOn" && isScanning) {
      // 重新启动扫描，允许重复发现
      await noble.startScanningAsync([], true);
    } else if (state !== "poweredOn") {
      noble.stopScanning();
      isScanning = false;
      broadcast({
        type: 'scanStatus',
        scanning: false
      });
    }
  });

  noble.on("discover", (peripheral) => {
    // 只在扫描状态下处理发现的设备
    if (!isScanning) return;
    
    const originalName = peripheral.advertisement.localName;
    const address = peripheral.address;
    // 使用地址和peripheral的uuid创建唯一ID，避免设备被覆盖
    const deviceId = `${address}_${peripheral.uuid || peripheral.id || Math.random().toString(36).substr(2, 9)}`;
    
    // 检查是否支持心率服务
    const serviceUuids = peripheral.advertisement.serviceUuids || [];
    const hasHeartRateService = serviceUuids.includes(HEART_RATE_SERVICE_UUID);
    
    // 设备类型分析（先用原始名称分析）
    const deviceType = analyzeDeviceType(originalName || '', serviceUuids, peripheral.advertisement);
    
    // 改进的设备名称处理
    let displayName = originalName;
    if (!originalName || originalName.trim() === '') {
      // 根据设备类型给未知设备更好的名称
      if (hasHeartRateService) {
        displayName = `心率设备 ${address.slice(-5)}`;
      } else if (deviceType.category !== 'unknown') {
        displayName = `${deviceType.name} ${address.slice(-5)}`;
      } else {
        displayName = `未知设备 ${address.slice(-5)}`;
      }
    }
    
    // 严格过滤：只显示心率相关的有价值设备
    const shouldShow = (
      hasHeartRateService || // 明确支持心率服务
      deviceType.category === 'wearable' || // 可穿戴设备
      deviceType.category === 'fitness' || // 健身设备
      deviceType.category === 'heartrate' || // 心率设备
      (originalName && originalName.trim() !== '' && 
       !originalName.includes('Unknown') && 
       deviceType.category !== 'unknown') // 有真实名称且不是未知类型
    );
    
    if (shouldShow) {
      const now = Date.now();
      
      if (!discoveredDevices.has(deviceId)) {
        // 新设备
        const deviceInfo = {
          id: deviceId,
          name: displayName,
          address: address,
          rssi: peripheral.rssi,
          hasHeartRate: hasHeartRateService,
          deviceType: deviceType,
          serviceUuids: serviceUuids,
          peripheral: peripheral,
          firstSeen: now,
          lastSeen: now,
          updateCount: 1
        };
        
        discoveredDevices.set(deviceId, deviceInfo);
        
        const typeIcon = deviceType.icon;
        const heartIcon = hasHeartRateService ? ' ❤️' : '';
        console.log(`🆕 发现新设备: ${displayName} [${address}] ${typeIcon} RSSI: ${peripheral.rssi}${heartIcon}`);
        
        broadcast({
          type: 'deviceFound',
          device: {
            id: deviceId,
            name: displayName,
            address: address,
            rssi: peripheral.rssi,
            hasHeartRate: hasHeartRateService,
            deviceType: deviceType,
            serviceCount: serviceUuids.length
          }
        });
      } else {
        // 更新现有设备信息
        const device = discoveredDevices.get(deviceId);
        const oldRssi = device.rssi;
        
        device.rssi = peripheral.rssi;
        device.lastSeen = now;
        device.updateCount++;
        device.peripheral = peripheral; // 更新peripheral引用
        
        // 只有RSSI变化较大时才广播更新（避免频繁更新UI）
        if (Math.abs(oldRssi - peripheral.rssi) >= 8) {
          console.log(`🔄 更新设备: ${displayName} RSSI: ${oldRssi} -> ${peripheral.rssi}`);
          broadcast({
            type: 'deviceUpdate',
            device: {
              id: deviceId,
              rssi: peripheral.rssi
            }
          });
        }
      }
    } else {
      // 记录被过滤的设备（开发调试用）
      // console.log(`❌ 过滤设备: ${originalName || '无名称'} [${address}] RSSI: ${peripheral.rssi} 服务: ${serviceUuids.length}`);
    }
  });
}

// 初始化心率显示模式设置
function initHeartRateDisplayMode() {
  try {
    const fs = require('fs');
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.heartRateDisplayMode && 
          (settings.heartRateDisplayMode === 'desktop' || 
           settings.heartRateDisplayMode === 'icon')) {
        heartRateDisplayMode = settings.heartRateDisplayMode;
        console.log('📋 加载保存的心率显示模式:', heartRateDisplayMode);
        
        // 如果是托盘图标模式，立即更新图标
        if (heartRateDisplayMode === 'icon') {
          setTimeout(() => {
            updateTrayIcon();
          }, 500);
        }
      }
    }
  } catch (error) {
    console.log('⚠️  加载显示模式设置失败:', error.message);
  }
}

// 保存心率显示模式设置
function saveHeartRateDisplayMode(mode) {
  try {
    const fs = require('fs');
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    settings.heartRateDisplayMode = mode;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('💾 心率显示模式已保存:', mode);
  } catch (error) {
    console.log('⚠️  保存显示模式设置失败:', error.message);
  }
}

// 获取应用图标路径的通用函数
function getAppIconPath() {
  // macOS 使用 icns 文件，其他平台使用 ico 文件
  const iconPath = process.platform === 'darwin' 
    ? path.join(__dirname, 'icon.icns')
    : path.join(__dirname, 'icon.ico');
  
  // 检查图标文件是否存在
  try {
    require('fs').accessSync(iconPath, require('fs').constants.F_OK);
    console.log(`✅ 找到图标文件: ${iconPath}`);
    return iconPath;
  } catch (error) {
    console.log(`⚠️  图标文件不存在: ${iconPath}，使用默认图标`);
    return null;
  }
}
function analyzeDeviceType(name, serviceUuids, advertisement) {
  const nameLower = name.toLowerCase();
  
  // 明确的心率设备
  if (serviceUuids.includes('180d')) {
    return { category: 'heartrate', name: '心率设备', icon: '❤️' };
  }
  
  // 常见的可穿戴设备品牌和名称
  const wearablePatterns = [
    'watch', 'band', 'tracker', 'fit', 'health',
    'apple', 'samsung', 'huawei', 'xiaomi', 'mi', 'vivo', 'oppo',
    'polar', 'garmin', 'fitbit', 'amazfit', 'honor',
    '手环', '手表', '心率', '运动'
  ];
  
  if (wearablePatterns.some(pattern => nameLower.includes(pattern))) {
    return { category: 'wearable', name: '可穿戴设备', icon: '⌚' };
  }
  
  // 健身设备
  const fitnessPatterns = [
    'treadmill', 'bike', 'cycle', 'elliptical', 'rower',
    '跑步机', '单车', '椭圆机'
  ];
  
  if (fitnessPatterns.some(pattern => nameLower.includes(pattern))) {
    return { category: 'fitness', name: '健身设备', icon: '🏃' };
  }
  
  // 手机和平板
  const mobilePatterns = ['iphone', 'android', 'phone', 'ipad', 'tablet'];
  if (mobilePatterns.some(pattern => nameLower.includes(pattern))) {
    return { category: 'mobile', name: '移动设备', icon: '📱' };
  }
  
  // 耳机和音响
  const audioPatterns = ['airpods', 'headphone', 'speaker', 'earbuds', '耳机', '音响'];
  if (audioPatterns.some(pattern => nameLower.includes(pattern))) {
    return { category: 'audio', name: '音频设备', icon: '🎧' };
  }
  
  // 根据服务判断
  if (serviceUuids.length > 0) {
    // 有服务的设备可能是智能设备
    return { category: 'smart', name: '智能设备', icon: '📟' };
  }
  
  // 有意义名称的未知设备
  if (name.length > 2 && !name.includes('未知')) {
    return { category: 'device', name: '蓝牙设备', icon: '📡' };
  }
  
  return { category: 'unknown', name: '未知设备', icon: '❓' };
}

// 恢复默认托盘图标
function restoreDefaultTrayIcon() {
  if (!tray || !defaultTrayIcon) return;
  
  try {
    tray.setImage(defaultTrayIcon);
    tray.setTitle(''); // 清除文字
    tray.setToolTip('心率监测器 - 点击打开设备管理器');
  } catch (error) {
    console.error('恢复默认托盘图标失败:', error);
  }
}

// 更新托盘图标（用于托盘图标显示模式）
function updateTrayIcon() {
  if (!tray || heartRateDisplayMode !== 'icon') return;
  
  try {
    // 直接更新托盘的标题文字，添加间隔和调整字体
    let displayText = `${currentHeartRate}`;
    if (currentHeartRate === '--' || currentHeartRate === 0) {
      displayText = '--';
    }
    
    // 添加空格作为间隔，让文字离图标远一点
    const spacedText = ` ${displayText}`;
    
    // 设置托盘标题为心率文字
    tray.setTitle(spacedText);
    tray.setToolTip(`心率监测器 - 当前心率: ${currentHeartRate} bpm`);
    console.log(`✅ 托盘文字已更新: ${displayText}`);
    
  } catch (error) {
    console.error('❌ 更新托盘文字失败:', error.message);
    if (tray) {
      tray.setToolTip(`心率监测器 - 当前心率: ${currentHeartRate} bpm`);
    }
  }
}

// 更新托盘菜单
function updateTrayMenu() {
  if (!tray) return;
  
  // 创建简化的托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '心率显示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createHeartRateWindow();
        }
      }
    },
    {
      label: '设备管理器',
      click: () => {
        showDeviceManager();
      }
    },
    { type: 'separator' },
    {
      label: '关于',
      click: () => {
        require('electron').dialog.showMessageBox(deviceManagerWindow || mainWindow, {
          type: 'info',
          title: '关于心率监测器',
          message: '心率监测器 v1.0.2',
          detail: '一个简单的蓝牙心率监测桌面应用，有问题可以联系作者微信（注明来意）：luoyuecn'
        });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// 创建系统托盘
function createTray() {
  // 使用应用图标作为托盘图标
  let trayIcon;
  
  try {
    // 尝试多种图标格式，优先使用PNG
    let trayIconPath;
    const iconFormats = [
      path.join(__dirname, 'tray-icon-16.png'),
      path.join(__dirname, 'tray-icon.png'),  
      path.join(__dirname, 'icon.ico')
    ];
    
    for (const iconPath of iconFormats) {
      try {
        require('fs').accessSync(iconPath, require('fs').constants.F_OK);
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon.isEmpty()) {
          trayIconPath = iconPath;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!trayIcon || trayIcon.isEmpty()) {
      throw new Error('No valid tray icon found');
    }
    
    console.log('✅ 托盘图标已加载:', trayIconPath);
  } catch (error) {
    console.log('⚠️  托盘图标加载失败:', error.message);
    console.log('⚠️  使用默认托盘图标');
    // 创建简单的SVG图标作为备选
    trayIcon = nativeImage.createFromDataURL(
      'data:image/svg+xml,' + encodeURIComponent(`
        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <text x="8" y="12" font-family="Arial" font-size="12" text-anchor="middle" fill="#e74c3c">❤</text>
        </svg>
      `)
    );
  }
  
  // 调整图标大小适配不同平台
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
    
    // macOS 和 Windows 都使用彩色图标，不再使用模板图像
    // if (process.platform === 'darwin') {
    //   trayIcon.setTemplateImage(true);
    // }
  }
  
  tray = new Tray(trayIcon);
  defaultTrayIcon = trayIcon; // 保存默认图标的引用
  
  // 设置托盘提示文字
  tray.setToolTip('心率监测器 - 点击打开设备管理器');
  
  // 创建托盘菜单
  updateTrayMenu();
  
  // 单击托盘图标打开设备管理器
  tray.on('click', () => {
    showDeviceManager();
  });
  
  // 双击托盘图标打开心率显示
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createHeartRateWindow();
    }
  });
}

// 显示设备管理器窗口
function showDeviceManager() {
  if (deviceManagerWindow) {
    deviceManagerWindow.show();
    deviceManagerWindow.focus();
  } else {
    createWindow();
  }
}

function createWindow() {
  // 创建设备管理窗口
  const iconPath = getAppIconPath();
  const windowOptions = {
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };
  
  if (iconPath) {
    windowOptions.icon = iconPath;
  }
  
  deviceManagerWindow = new BrowserWindow(windowOptions);

  deviceManagerWindow.loadFile('device-manager.html');
  
  // Windows 下关闭窗口时隐藏而不退出
  deviceManagerWindow.on('close', (event) => {
    if (!app.isQuiting && process.platform === 'win32') {
      event.preventDefault();
      deviceManagerWindow.hide();
      
      // 首次隐藏时显示提示
      if (!deviceManagerWindow.hasShownTrayTip) {
        tray.displayBalloon({
          title: '心率监测器',
          content: '应用已最小化到系统托盘，点击托盘图标可重新打开'
        });
        deviceManagerWindow.hasShownTrayTip = true;
      }
      return false;
    }
  });
  
  deviceManagerWindow.on('closed', () => {
    deviceManagerWindow = null;
    // 不再强制关闭心率窗口，让它独立存在
    // 用户可以通过菜单重新打开设备管理器
  });
  
  // 移除自动创建心率窗口的逻辑
}

function createHeartRateWindow() {
  const iconPath = getAppIconPath();
  const windowOptions = {
    width: 200,
    height: 80,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    // 移除parent属性，让心率窗口独立显示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };
  
  if (iconPath) {
    windowOptions.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建菜单
function createMenu() {
  const template = [
    {
      label: '窗口',
      submenu: [
        {
          label: '设备管理器',
          click: () => {
            if (deviceManagerWindow) {
              deviceManagerWindow.focus();
            } else {
              // 创建设备管理器窗口，但不再自动创建心率窗口
              const iconPath = getAppIconPath();
              const windowOptions = {
                width: 800,
                height: 600,
                webPreferences: {
                  nodeIntegration: true,
                  contextIsolation: false
                }
              };
              
              if (iconPath) {
                windowOptions.icon = iconPath;
              }
              
              deviceManagerWindow = new BrowserWindow(windowOptions);
              
              deviceManagerWindow.loadFile('device-manager.html');
              
              deviceManagerWindow.on('closed', () => {
                deviceManagerWindow = null;
              });
            }
          }
        },
        {
          label: '心率显示',
          click: () => {
            if (mainWindow) {
              mainWindow.focus();
            } else {
              createHeartRateWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.reload();
          }
        },
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.openDevTools();
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: '关于 ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: '隐藏 ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: '隐藏其他',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: '显示全部',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // 设置应用名称和显示名称
  app.setName('Spark');
  
  // macOS 特殊处理：设置应用的展示名称
  if (process.platform === 'darwin') {
    try {
      // 尝试设置 NSApplication 的显示名称
      const { exec } = require('child_process');
      exec(`defaults write "${app.getPath('exe')}" CFBundleDisplayName "Spark"`);
      exec(`defaults write "${app.getPath('exe')}" CFBundleName "Spark"`);
    } catch (error) {
      console.log('⚠️  无法设置Bundle名称:', error.message);
    }
  }
  
  console.log('🚀 启动 Spark 心率监测器...');
  console.log(`📱 应用名称: ${app.getName()}`);
  
  // 设置应用图标（dock/任务栏图标）
  const iconPath = getAppIconPath();
  if (iconPath) {
    if (process.platform === 'darwin') {
      // macOS 使用 app.dock.setIcon() 设置 dock 图标
      try {
        // 先尝试使用PNG格式，更兼容
        const pngIconPath = path.join(__dirname, 'tray-icon.png');
        let iconToUse = iconPath;
        
        try {
          require('fs').accessSync(pngIconPath, require('fs').constants.F_OK);
          iconToUse = pngIconPath;
          console.log('🔄 尝试使用PNG格式的dock图标:', iconToUse);
        } catch (e) {
          console.log('📝 使用ICNS格式的dock图标:', iconToUse);
        }
        
        app.dock.setIcon(iconToUse);
        console.log('✅ macOS Dock图标已设置:', iconToUse);
      } catch (error) {
        console.log('⚠️  设置macOS Dock图标失败:', error.message);
        
        // 备用方案：直接使用nativeImage
        try {
          const pngIconPath = path.join(__dirname, 'tray-icon.png');
          const icon = require('electron').nativeImage.createFromPath(pngIconPath);
          if (!icon.isEmpty()) {
            app.dock.setIcon(icon);
            console.log('✅ 使用备用方案设置Dock图标成功');
          }
        } catch (e2) {
          console.log('⚠️  备用方案也失败:', e2.message);
        }
      }
    } else if (typeof app.setIcon === 'function') {
      // Windows 和 Linux 使用 app.setIcon()
      try {
        app.setIcon(iconPath);
        console.log('✅ 应用图标已设置:', iconPath);
      } catch (error) {
        console.log('⚠️  设置应用图标失败:', error.message);
      }
    }
  } else {
    console.log('⚠️  未找到应用图标文件');
  }
  
  // 启动蓝牙服务
  initBluetooth();
  
  // 启动WebSocket服务器
  startWebSocketServer();
  
  // 创建系统托盘
  createTray();
  
  // 加载保存的心率显示模式设置
  initHeartRateDisplayMode();
  
  // 分别创建窗口，避免重复创建
  createWindow(); // 创建设备管理器窗口
  
  // 延迟创建心率窗口，确保只创建一次，但只有在桌面模式时才创建
  setTimeout(() => {
    if (!mainWindow && heartRateDisplayMode === 'desktop') {
      createHeartRateWindow();
    }
  }, 1000);
  
  createMenu();
  
  console.log('✅ 应用已启动，一键即用！');
});

// 清理资源
app.on('before-quit', async () => {
  console.log('正在关闭应用...');
  app.isQuiting = true;
  await disconnectDevice();
  noble.stopScanning();
  if (wss) {
    wss.close();
  }
  if (tray) {
    tray.destroy();
  }
});

app.on('window-all-closed', () => {
  // 所有平台都允许窗口关闭而不退出应用（因为有托盘）
  // 应用继续在托盘中运行
  console.log('所有窗口已关闭，应用继续在托盘中运行');
});

app.on('activate', () => {
  // macOS 下点击 dock 图标时重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    // 显示已存在的设备管理器窗口
    showDeviceManager();
  }
});

// 处理窗口拖拽
ipcMain.on('move-window', (event, data) => {
  if (mainWindow) {
    const [currentX, currentY] = mainWindow.getPosition();
    if (data.deltaX !== undefined && data.deltaY !== undefined) {
      // 使用相对位移
      mainWindow.setPosition(currentX + Math.round(data.deltaX), currentY + Math.round(data.deltaY));
    } else if (data.x !== undefined && data.y !== undefined) {
      // 使用绝对位置（兼容旧版本）
      mainWindow.setPosition(Math.round(data.x), Math.round(data.y));
    }
  }
});