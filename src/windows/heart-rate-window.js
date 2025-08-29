// 心率显示窗口管理
const { BrowserWindow } = require('electron');
const { WINDOW_CONSTANTS } = require('../config/constants');
const IconUtils = require('../utils/icon-utils');

class HeartRateWindow {
  constructor() {
    this.window = null;
  }

  // 创建心率显示窗口
  create() {
    if (this.window) {
      console.log('心率窗口已存在');
      return this.window;
    }

    const iconPath = IconUtils.getAppIconPath();
    const windowOptions = {
      ...WINDOW_CONSTANTS.HEART_RATE_DISPLAY,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    };
    
    if (iconPath) {
      windowOptions.icon = iconPath;
    }
    
    this.window = new BrowserWindow(windowOptions);
    this.window.loadFile('index.html');
    
    this.setupWindowBehavior();
    this.setupEventHandlers();
    
    console.log('✅ 心率显示窗口已创建');
    return this.window;
  }

  // 设置窗口行为
  setupWindowBehavior() {
    if (!this.window) return;

    // 强制设置最高层级 - 多重保险
    if (process.platform === 'darwin') {
      // macOS 使用最高级别
      this.window.setAlwaysOnTop(true, 'screen-saver', 1);
    } else if (process.platform === 'win32') {
      // Windows 需要特殊处理
      this.window.setAlwaysOnTop(true, 'screen-saver');
      this.window.setSkipTaskbar(false); // 确保任务栏显示
    } else {
      // Linux 使用屏保级别
      this.window.setAlwaysOnTop(true, 'screen-saver');
    }
    
    // 窗口加载完成后再次强制置顶
    this.window.webContents.once('dom-ready', () => {
      // 统一使用最高优先级参数
      if (process.platform === 'darwin') {
        this.window.setAlwaysOnTop(true, 'screen-saver', 1);
      } else {
        this.window.setAlwaysOnTop(true, 'screen-saver', 1); // Windows也使用级别1
      }
      
      this.window.showInactive(); // 显示但不抢焦点
      
      // 跨平台工作空间设置
      if (process.platform === 'darwin') {
        this.window.setVisibleOnAllWorkspaces(true);
      }
      
      // 延迟再次确保置顶
      setTimeout(() => {
        this.window.setAlwaysOnTop(true, 'screen-saver', 1);
      }, 500);
    });
  }

  // 设置事件处理器
  setupEventHandlers() {
    if (!this.window) return;

    this.window.on('closed', () => {
      this.window = null;
      console.log('心率显示窗口已关闭');
    });
  }

  // 显示窗口
  show() {
    if (this.window) {
      this.window.setAlwaysOnTop(true, 'screen-saver', 1);
      this.window.show();
      this.window.setVisibleOnAllWorkspaces(true);
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

  // 获取窗口
  getWindow() {
    return this.window;
  }

  // 检查窗口是否存在
  exists() {
    return !!this.window;
  }

  // 设置窗口位置
  setPosition(x, y) {
    if (this.window) {
      this.window.setPosition(Math.round(x), Math.round(y));
    }
  }

  // 移动窗口（相对位移）
  moveBy(deltaX, deltaY) {
    if (this.window) {
      const [currentX, currentY] = this.window.getPosition();
      this.window.setPosition(currentX + Math.round(deltaX), currentY + Math.round(deltaY));
    }
  }
}

module.exports = HeartRateWindow;