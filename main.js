const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const noble = require("@abandonware/noble");
const WebSocket = require('ws');

let mainWindow;
let deviceManagerWindow;

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
    default:
      console.log('未知消息类型:', data.type);
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
        broadcast({
          type: 'heartRate',
          value: hrValue,
          timestamp: Date.now()
        });
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
    broadcast({
      type: 'connectionStatus',
      connected: false
    });
  }
}

// 初始化蓝牙
function initBluetooth() {
  noble.on("stateChange", async (state) => {
    console.log(`蓝牙状态: ${state}`);
    broadcast({
      type: 'bluetoothStatus',
      state: state
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

// 分析设备类型
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

function createWindow() {
  // 创建设备管理窗口
  deviceManagerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  deviceManagerWindow.loadFile('device-manager.html');
  
  deviceManagerWindow.on('closed', () => {
    deviceManagerWindow = null;
    // 不再强制关闭心率窗口，让它独立存在
    // 用户可以通过菜单重新打开设备管理器
  });

  // 创建心率显示悬浮窗
  setTimeout(() => {
    createHeartRateWindow();
  }, 1000);
}

function createHeartRateWindow() {
  mainWindow = new BrowserWindow({
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
  });

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
              createWindow();
            }
          }
        },
        {
          label: '心率显示',
          click: () => {
            if (mainWindow) {
              mainWindow.focus();
            } else if (deviceManagerWindow) {
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
  console.log('🚀 启动心率监测器...');
  
  // 启动蓝牙服务
  initBluetooth();
  
  // 启动WebSocket服务器
  startWebSocketServer();
  
  // 创建窗口
  createWindow();
  createMenu();
  
  console.log('✅ 应用已启动，一键即用！');
});

// 清理资源
app.on('before-quit', async () => {
  console.log('正在关闭应用...');
  await disconnectDevice();
  noble.stopScanning();
  if (wss) {
    wss.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
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