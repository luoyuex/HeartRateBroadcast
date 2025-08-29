// 窗口管理器 - 统一管理所有窗口
const { ipcMain } = require('electron');
const EventEmitter = require('events');
const HeartRateWindow = require('./heart-rate-window');
const DeviceManagerWindow = require('./device-manager-window');
const HeartRateChartWindow = require('./heart-rate-chart-window');
const { APP_CONSTANTS } = require('../config/constants');

class WindowManager extends EventEmitter {
  constructor(settings) {
    super();
    this.settings = settings;
    this.heartRateWindow = new HeartRateWindow();
    this.deviceManagerWindow = new DeviceManagerWindow();
    this.heartRateChartWindow = new HeartRateChartWindow();
    
    this.setupIpcHandlers();
  }

  // 设置IPC处理器
  setupIpcHandlers() {
    // 处理窗口拖拽
    ipcMain.on('move-window', (event, data) => {
      const heartRateWin = this.heartRateWindow.getWindow();
      if (heartRateWin) {
        if (data.deltaX !== undefined && data.deltaY !== undefined) {
          // 使用相对位移
          this.heartRateWindow.moveBy(data.deltaX, data.deltaY);
        } else if (data.x !== undefined && data.y !== undefined) {
          // 使用绝对位置（兼容旧版本）
          this.heartRateWindow.setPosition(data.x, data.y);
        }
      }
    });
  }

  // 创建设备管理器窗口
  createDeviceManager() {
    return this.deviceManagerWindow.create();
  }

  // 创建心率显示窗口
  createHeartRateWindow() {
    const displayMode = this.settings.getHeartRateDisplayMode();
    if (displayMode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP) {
      return this.heartRateWindow.create();
    }
    return null;
  }

  // 显示设备管理器
  showDeviceManager() {
    this.deviceManagerWindow.show();
  }

  // 显示心率窗口
  showHeartRateWindow() {
    this.heartRateWindow.show();
  }

  // 创建/显示心率图表窗口
  showHeartRateChart() {
    this.heartRateChartWindow.show();
  }

  // 处理显示模式变更
  handleDisplayModeChange(mode, trayManager) {
    console.log('窗口管理器: 切换心率显示模式到:', mode);
    
    if (mode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP) {
      // 桌面显示模式 - 显示心率窗口，恢复默认托盘图标
      if (!this.heartRateWindow.exists()) {
        this.createHeartRateWindow();
      } else {
        this.heartRateWindow.show();
      }
      
      // 恢复默认托盘图标
      if (trayManager) {
        trayManager.restoreDefaultIcon();
      }
    } else if (mode === APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.ICON) {
      // 托盘图标显示模式 - 隐藏心率窗口，使用动态心率图标
      this.heartRateWindow.hide();
      
      // 更新托盘图标
      if (trayManager) {
        trayManager.updateHeartRateIcon();
      }
    }
  }

  // 获取设备管理器窗口
  getDeviceManagerWindow() {
    return this.deviceManagerWindow.getWindow();
  }

  // 获取心率显示窗口
  getHeartRateWindow() {
    return this.heartRateWindow.getWindow();
  }

  // 检查心率窗口是否存在
  hasHeartRateWindow() {
    return this.heartRateWindow.exists();
  }

  // 检查设备管理器窗口是否存在
  hasDeviceManagerWindow() {
    return this.deviceManagerWindow.exists();
  }

  // 检查心率图表窗口是否存在
  hasHeartRateChartWindow() {
    return this.heartRateChartWindow.exists();
  }

  // 重新加载设备管理器
  reloadDeviceManager() {
    this.deviceManagerWindow.reload();
  }

  // 重新加载心率图表
  reloadHeartRateChart() {
    this.heartRateChartWindow.reload();
  }

  // 打开设备管理器开发者工具
  openDeviceManagerDevTools() {
    this.deviceManagerWindow.openDevTools();
  }

  // 打开心率图表开发者工具
  openHeartRateChartDevTools() {
    this.heartRateChartWindow.openDevTools();
  }

  // 关闭所有窗口
  closeAllWindows() {
    this.heartRateWindow.close();
    this.deviceManagerWindow.close();
    this.heartRateChartWindow.close();
  }

  // 隐藏所有窗口
  hideAllWindows() {
    this.heartRateWindow.hide();
    this.deviceManagerWindow.hide();
    this.heartRateChartWindow.hide();
  }

  // 设置托盘提示回调
  setTrayTipCallback(callback) {
    this.deviceManagerWindow.setTrayTipCallback(callback);
  }
}

module.exports = WindowManager;