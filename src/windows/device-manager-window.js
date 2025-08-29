// 设备管理窗口
const { BrowserWindow } = require('electron');
const { WINDOW_CONSTANTS } = require('../config/constants');
const IconUtils = require('../utils/icon-utils');

class DeviceManagerWindow {
  constructor() {
    this.window = null;
    this.hasShownTrayTip = false;
  }

  // 创建设备管理器窗口
  create() {
    if (this.window) {
      console.log('设备管理窗口已存在');
      return this.window;
    }

    const iconPath = IconUtils.getAppIconPath();
    const windowOptions = {
      ...WINDOW_CONSTANTS.DEVICE_MANAGER,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    };
    
    if (iconPath) {
      windowOptions.icon = iconPath;
    }
    
    this.window = new BrowserWindow(windowOptions);
    this.window.loadFile('device-manager.html');
    
    this.setupEventHandlers();
    
    console.log('✅ 设备管理窗口已创建');
    return this.window;
  }

  // 设置事件处理器
  setupEventHandlers() {
    if (!this.window) return;

    // Windows 下关闭窗口时隐藏而不退出
    this.window.on('close', (event) => {
      const { app } = require('electron');
      if (!app.isQuiting && process.platform === 'win32') {
        event.preventDefault();
        this.window.hide();
        
        // 首次隐藏时显示提示
        if (!this.hasShownTrayTip) {
          this.showTrayTip();
          this.hasShownTrayTip = true;
        }
        return false;
      }
    });
    
    this.window.on('closed', () => {
      this.window = null;
      console.log('设备管理窗口已关闭');
    });
  }

  // 显示托盘提示
  showTrayTip() {
    const { Tray } = require('electron');
    // 这里需要从外部传入tray实例，或者通过事件通知
    // 暂时输出到控制台
    console.log('💡 应用已最小化到系统托盘，点击托盘图标可重新打开');
  }

  // 显示窗口
  show() {
    if (this.window) {
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
      this.window.show();
      this.window.focus();
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

  // 设置托盘提示回调
  setTrayTipCallback(callback) {
    this.showTrayTip = callback;
  }
}

module.exports = DeviceManagerWindow;