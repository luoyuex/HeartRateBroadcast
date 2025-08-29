// 图标相关工具函数
const path = require('path');
const fs = require('fs');
const { nativeImage } = require('electron');
const { ICON_CONSTANTS } = require('../config/constants');

class IconUtils {
  // 获取应用图标路径
  static getAppIconPath() {
    const iconPath = process.platform === 'darwin' 
      ? path.join(__dirname, '../../', ICON_CONSTANTS.APP_ICONS.DARWIN)
      : path.join(__dirname, '../../', ICON_CONSTANTS.APP_ICONS.OTHER);
    
    try {
      fs.accessSync(iconPath, fs.constants.F_OK);
      console.log(`✅ 找到图标文件: ${iconPath}`);
      return iconPath;
    } catch (error) {
      console.log(`⚠️  图标文件不存在: ${iconPath}，使用默认图标`);
      return null;
    }
  }

  // 创建托盘图标
  static createTrayIcon() {
    let trayIcon;
    
    try {
      // 尝试多种图标格式
      for (const iconName of ICON_CONSTANTS.TRAY_ICONS) {
        const iconPath = path.join(__dirname, '../../', iconName);
        try {
          fs.accessSync(iconPath, fs.constants.F_OK);
          trayIcon = nativeImage.createFromPath(iconPath);
          if (!trayIcon.isEmpty()) {
            console.log('✅ 托盘图标已加载:', iconPath);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!trayIcon || trayIcon.isEmpty()) {
        throw new Error('No valid tray icon found');
      }
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
    }
    
    return trayIcon;
  }

  // 设置应用图标
  static setAppIcon(app) {
    const iconPath = this.getAppIconPath();
    if (!iconPath) {
      console.log('⚠️  未找到应用图标文件');
      return false;
    }

    try {
      if (process.platform === 'darwin') {
        // macOS 使用 app.dock.setIcon() 设置 dock 图标
        try {
          // 先尝试使用PNG格式
          const pngIconPath = path.join(__dirname, '../../tray-icon.png');
          let iconToUse = iconPath;
          
          try {
            fs.accessSync(pngIconPath, fs.constants.F_OK);
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
            const pngIconPath = path.join(__dirname, '../../tray-icon.png');
            const icon = nativeImage.createFromPath(pngIconPath);
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
        app.setIcon(iconPath);
        console.log('✅ 应用图标已设置:', iconPath);
      }
      return true;
    } catch (error) {
      console.log('⚠️  设置应用图标失败:', error.message);
      return false;
    }
  }
}

module.exports = IconUtils;