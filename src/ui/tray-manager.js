// 系统托盘管理器
const { Tray, Menu, nativeImage } = require('electron');
const EventEmitter = require('events');
const IconUtils = require('../utils/icon-utils');
const { APP_CONSTANTS } = require('../config/constants');

class TrayManager extends EventEmitter {
  constructor(windowManager) {
    super();
    this.windowManager = windowManager;
    this.tray = null;
    this.defaultTrayIcon = null;
    this.currentHeartRate = APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE;
    this.heartRateDisplayMode = APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP;
  }

  // 创建系统托盘
  create() {
    if (this.tray) {
      console.log('系统托盘已存在');
      return this.tray;
    }

    const trayIcon = IconUtils.createTrayIcon();
    this.tray = new Tray(trayIcon);
    this.defaultTrayIcon = trayIcon; // 保存默认图标的引用
    
    // 设置托盘提示文字
    this.tray.setToolTip('心率监测器 - 点击打开设备管理器');
    
    // 创建托盘菜单
    this.updateMenu();
    
    // 设置托盘点击事件
    this.setupTrayEvents();
    
    // 设置窗口管理器的托盘提示回调
    this.windowManager.setTrayTipCallback((title, content) => {
      this.tray.displayBalloon({ title, content });
    });
    
    console.log('✅ 系统托盘已创建');
    return this.tray;
  }

  // 设置托盘事件
  setupTrayEvents() {
    if (!this.tray) return;

    // 单击托盘图标打开设备管理器
    this.tray.on('click', () => {
      this.windowManager.showDeviceManager();
    });
    
    // 双击托盘图标打开心率显示
    this.tray.on('double-click', () => {
      this.windowManager.showHeartRateWindow();
    });
  }

  // 更新托盘菜单
  updateMenu() {
    if (!this.tray) return;
    
    const { dialog } = require('electron');
    
    // 创建简化的托盘菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '心率显示',
        click: () => {
          this.windowManager.showHeartRateWindow();
        }
      },
      {
        label: '设备管理器',
        click: () => {
          this.windowManager.showDeviceManager();
        }
      },
      { type: 'separator' },
      {
        label: '关于',
        click: () => {
          const focusedWindow = this.windowManager.getDeviceManagerWindow() || 
                               this.windowManager.getHeartRateWindow();
          dialog.showMessageBox(focusedWindow, {
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
          const { app } = require('electron');
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
  }

  // 恢复默认托盘图标
  restoreDefaultIcon() {
    if (!this.tray || !this.defaultTrayIcon) return;
    
    try {
      this.tray.setImage(this.defaultTrayIcon);
      this.tray.setTitle(''); // 清除文字
      this.tray.setToolTip('心率监测器 - 点击打开设备管理器');
      console.log('✅ 托盘图标已恢复默认');
    } catch (error) {
      console.error('恢复默认托盘图标失败:', error);
    }
  }

  // 更新托盘图标（用于托盘图标显示模式）
  updateHeartRateIcon() {
    if (!this.tray || this.heartRateDisplayMode !== APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.ICON) {
      return;
    }
    
    try {
      // 直接更新托盘的标题文字
      let displayText = `${this.currentHeartRate}`;
      if (this.currentHeartRate === APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE || this.currentHeartRate === 0) {
        displayText = APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE;
      }
      
      // 添加空格作为间隔，让文字离图标远一点
      const spacedText = ` ${displayText}`;
      
      // 设置托盘标题为心率文字
      this.tray.setTitle(spacedText);
      this.tray.setToolTip(`心率监测器 - 当前心率: ${this.currentHeartRate} bpm`);
      console.log(`✅ 托盘文字已更新: ${displayText}`);
      
    } catch (error) {
      console.error('❌ 更新托盘文字失败:', error.message);
      if (this.tray) {
        this.tray.setToolTip(`心率监测器 - 当前心率: ${this.currentHeartRate} bpm`);
      }
    }
  }

  // 设置心率值
  setHeartRate(heartRate) {
    this.currentHeartRate = heartRate;
    // 如果当前是图标显示模式，立即更新图标
    if (this.heartRateDisplayMode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.ICON) {
      this.updateHeartRateIcon();
    }
  }

  // 设置显示模式
  setDisplayMode(mode) {
    this.heartRateDisplayMode = mode;
    if (mode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.ICON) {
      this.updateHeartRateIcon();
    } else {
      this.restoreDefaultIcon();
    }
  }

  // 显示气泡通知
  showBalloon(title, content) {
    if (this.tray) {
      this.tray.displayBalloon({ title, content });
    }
  }

  // 销毁托盘
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.defaultTrayIcon = null;
      console.log('系统托盘已销毁');
    }
  }

  // 获取托盘
  getTray() {
    return this.tray;
  }

  // 检查托盘是否存在
  exists() {
    return !!this.tray;
  }
}

module.exports = TrayManager;