// 心率图表窗口管理
const { BrowserWindow } = require('electron');
const { WINDOW_CONSTANTS } = require('../config/constants');
const IconUtils = require('../utils/icon-utils');

class HeartRateChartWindow {
  constructor() {
    this.window = null;
  }

  // 创建心率图表窗口
  create() {
    if (this.window) {
      console.log('心率图表窗口已存在，聚焦显示');
      this.show();
      return this.window;
    }

    const iconPath = IconUtils.getAppIconPath();
    const windowOptions = {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: true,
      alwaysOnTop: false,
      transparent: false,
      resizable: true,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: '心率数据图表 - Spark'
    };
    
    if (iconPath) {
      windowOptions.icon = iconPath;
    }
    
    this.window = new BrowserWindow(windowOptions);
    this.window.loadFile('heart-rate-chart.html');
    
    // 开发环境下可以开启开发者工具
    // this.window.webContents.openDevTools();
    
    this.setupEventHandlers();
    
    console.log('✅ 心率图表窗口已创建');
    return this.window;
  }

  // 设置事件处理器
  setupEventHandlers() {
    if (!this.window) return;

    this.window.on('closed', () => {
      this.window = null;
      console.log('心率图表窗口已关闭');
    });

    this.window.on('ready-to-show', () => {
      this.window.show();
    });
  }

  // 显示窗口
  show() {
    if (this.window) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.show();
      this.window.focus();
    } else {
      this.create();
    }
  }

  // 隐藏窗口
  hide() {
    if (this.window) {
      this.window.hide();
    }
  }

  // 聚焦窗口
  focus() {
    if (this.window) {
      this.show();
    } else {
      this.create();
    }
  }

  // 关闭窗口
  close() {
    if (this.window) {
      this.window.close();
    }
  }

  // 重新加载窗口
  reload() {
    if (this.window) {
      this.window.reload();
    }
  }

  // 打开开发者工具
  openDevTools() {
    if (this.window) {
      this.window.webContents.openDevTools();
    }
  }

  // 获取窗口
  getWindow() {
    return this.window;
  }

  // 检查窗口是否存在
  exists() {
    return !!this.window;
  }

  // 检查窗口是否可见
  isVisible() {
    return this.window && this.window.isVisible();
  }

  // 发送消息到渲染进程
  sendMessage(message) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('message', message);
    }
  }
}

module.exports = HeartRateChartWindow;