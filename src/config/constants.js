// 应用常量定义
const path = require('path');

// 蓝牙相关常量
const BLUETOOTH_CONSTANTS = {
  HEART_RATE_SERVICE_UUID: "180d",
  HEART_RATE_MEASUREMENT_UUID: "2a37",
  SCAN_TIMEOUT: 30000, // 30秒扫描超时
  RSSI_UPDATE_THRESHOLD: 8 // RSSI变化阈值
};

// WebSocket常量
const WEBSOCKET_CONSTANTS = {
  DEFAULT_PORT: 8080
};

// 应用设置常量
const APP_CONSTANTS = {
  APP_NAME: 'Spark',
  VERSION: '1.0.2',
  HEART_RATE_DISPLAY_MODES: {
    DESKTOP: 'desktop',
    ICON: 'icon'
  },
  DEFAULT_HEART_RATE_VALUE: '--'
};

// 窗口配置常量
const WINDOW_CONSTANTS = {
  DEVICE_MANAGER: {
    width: 800,
    height: 600,
    resizable: true
  },
  HEART_RATE_DISPLAY: {
    width: 200,
    height: 80,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true
  }
};

// 图标路径常量
const ICON_CONSTANTS = {
  TRAY_ICONS: [
    'tray-icon-16.png',
    'tray-icon.png',
    'icon.ico'
  ],
  APP_ICONS: {
    DARWIN: 'icon.icns',
    OTHER: 'icon.ico'
  }
};

module.exports = {
  BLUETOOTH_CONSTANTS,
  WEBSOCKET_CONSTANTS,
  APP_CONSTANTS,
  WINDOW_CONSTANTS,
  ICON_CONSTANTS
};