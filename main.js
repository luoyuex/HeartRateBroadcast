// Spark 心率监测器主程序
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 导入重构后的模块
const BluetoothManager = require('./src/bluetooth/bluetooth-manager');
const WebSocketServer = require('./src/websocket/websocket-server');
const WindowManager = require('./src/windows/window-manager');
const TrayManager = require('./src/ui/tray-manager');
const MenuBuilder = require('./src/ui/menu-builder');
const Settings = require('./src/config/settings');
const IconUtils = require('./src/utils/icon-utils');
const { APP_CONSTANTS } = require('./src/config/constants');

// 全局变量
let bluetoothManager;
let webSocketServer;
let windowManager;
let trayManager;
let menuBuilder;
let settings;

// 应用初始化
function initializeApplication() {
  console.log(`🚀 启动 ${APP_CONSTANTS.APP_NAME} 心率监测器...`);
  console.log(`📱 应用名称: ${app.getName()}`);
  
  // 在最开始就设置应用名称
  app.setName(APP_CONSTANTS.APP_NAME);
  app.setPath('userData', path.join(app.getPath('appData'), APP_CONSTANTS.APP_NAME));
  
  // 初始化设置
  settings = new Settings();
  
  // 初始化各个管理器
  bluetoothManager = new BluetoothManager();
  windowManager = new WindowManager(settings);
  webSocketServer = new WebSocketServer(bluetoothManager, settings);
  trayManager = new TrayManager(windowManager);
  menuBuilder = new MenuBuilder(windowManager);
}

// 设置应用图标
function setupApplicationIcon() {
  IconUtils.setAppIcon(app);
}

// 设置蓝牙和WebSocket事件处理
function setupEventHandlers() {
  // 蓝牙管理器事件转发到WebSocket客户端
  bluetoothManager.on('scanStatus', (data) => {
    webSocketServer.broadcast({ type: 'scanStatus', ...data });
  });
  
  bluetoothManager.on('deviceList', (data) => {
    webSocketServer.broadcast({ type: 'deviceList', ...data });
  });
  
  bluetoothManager.on('deviceFound', (data) => {
    webSocketServer.broadcast({ type: 'deviceFound', ...data });
  });
  
  bluetoothManager.on('deviceUpdate', (data) => {
    webSocketServer.broadcast({ type: 'deviceUpdate', ...data });
  });
  
  bluetoothManager.on('connectionStatus', (data) => {
    webSocketServer.broadcast({ type: 'connectionStatus', ...data });
  });
  
  bluetoothManager.on('connectionError', (data) => {
    webSocketServer.broadcast({ type: 'connectionError', ...data });
  });
  
  bluetoothManager.on('bluetoothStatus', (data) => {
    webSocketServer.broadcast({ type: 'bluetoothStatus', ...data });
  });
  
  bluetoothManager.on('heartRate', (data) => {
    webSocketServer.broadcast({ type: 'heartRate', ...data });
    // 保存心率数据到历史记录
    webSocketServer.handleHeartRateData(data.value, data.timestamp);
    // 更新托盘图标
    trayManager.setHeartRate(data.value);
  });
  
  bluetoothManager.on('heartRateReset', () => {
    trayManager.setHeartRate(APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE);
  });
  
  // WebSocket服务器显示模式变更事件
  webSocketServer.on('displayModeChanged', (mode) => {
    trayManager.setDisplayMode(mode);
    windowManager.handleDisplayModeChange(mode, trayManager);
  });
  
  // WebSocket服务器打开心率图表事件
  webSocketServer.on('openHeartRateChart', () => {
    windowManager.showHeartRateChart();
  });
}

// 启动应用服务
function startServices() {
  // 初始化蓝牙
  bluetoothManager.init();
  
  // 启动WebSocket服务器
  webSocketServer.start();
  
  // 创建系统托盘
  trayManager.create();
  
  // 根据保存的显示模式设置托盘
  const displayMode = settings.getHeartRateDisplayMode();
  trayManager.setDisplayMode(displayMode);
}

// 创建窗口
function createWindows() {
  // 创建设备管理器窗口
  windowManager.createDeviceManager();
  
  // 延迟创建心率窗口，确保只创建一次，但只有在桌面模式时才创建
  setTimeout(() => {
    const displayMode = settings.getHeartRateDisplayMode();
    if (!windowManager.hasHeartRateWindow() && 
        displayMode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP) {
      windowManager.createHeartRateWindow();
    }
  }, 1000);
}

// 应用准备就绪时的处理
app.whenReady().then(async () => {
  // 初始化应用
  initializeApplication();
  
  // 设置应用图标
  setupApplicationIcon();
  
  // 设置事件处理器
  setupEventHandlers();
  
  // 启动服务
  startServices();
  
  // 创建窗口
  createWindows();
  
  // 创建应用菜单
  menuBuilder.createApplicationMenu();
  
  console.log('✅ 应用已启动，一键即用！');
});

// 应用退出前的清理
app.on('before-quit', async () => {
  console.log('正在关闭应用...');
  app.isQuiting = true;
  
  // 清理蓝牙资源
  if (bluetoothManager) {
    bluetoothManager.cleanup();
  }
  
  // 关闭WebSocket服务器
  if (webSocketServer) {
    webSocketServer.close();
  }
  
  // 销毁托盘
  if (trayManager) {
    trayManager.destroy();
  }
});

// 所有窗口关闭时的处理
app.on('window-all-closed', () => {
  // 所有平台都允许窗口关闭而不退出应用（因为有托盘）
  console.log('所有窗口已关闭，应用继续在托盘中运行');
});

// macOS 激活应用时的处理
app.on('activate', () => {
  // macOS 下点击 dock 图标时重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createDeviceManager();
  } else {
    // 显示已存在的设备管理器窗口
    windowManager.showDeviceManager();
  }
});