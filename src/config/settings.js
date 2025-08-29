// 应用配置管理
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { APP_CONSTANTS } = require('./constants');

class Settings {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = this.loadSettings();
  }

  // 加载设置
  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const settings = JSON.parse(data);
        console.log('📋 设置已加载');
        return settings;
      }
    } catch (error) {
      console.log('⚠️  加载设置失败:', error.message);
    }
    
    return this.getDefaultSettings();
  }

  // 保存设置
  saveSettings() {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      console.log('💾 设置已保存');
    } catch (error) {
      console.log('⚠️  保存设置失败:', error.message);
    }
  }

  // 获取默认设置
  getDefaultSettings() {
    return {
      heartRateDisplayMode: APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP
    };
  }

  // 获取心率显示模式
  getHeartRateDisplayMode() {
    return this.settings.heartRateDisplayMode || APP_CONSTANTS.HEART_RATE_DISPLAY_MODES.DESKTOP;
  }

  // 设置心率显示模式
  setHeartRateDisplayMode(mode) {
    if (Object.values(APP_CONSTANTS.HEART_RATE_DISPLAY_MODES).includes(mode)) {
      this.settings.heartRateDisplayMode = mode;
      this.saveSettings();
      console.log('📋 心率显示模式已更新:', mode);
      return true;
    }
    return false;
  }

  // 获取所有设置
  getAllSettings() {
    return { ...this.settings };
  }

  // 更新设置
  updateSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }
}

module.exports = Settings;