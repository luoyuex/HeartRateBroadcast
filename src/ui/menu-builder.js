// 菜单构建器
const { Menu } = require('electron');

class MenuBuilder {
  constructor(windowManager) {
    this.windowManager = windowManager;
  }

  // 创建应用菜单
  createApplicationMenu() {
    const template = [
      {
        label: '窗口',
        submenu: [
          {
            label: '设备管理器',
            click: () => {
              this.windowManager.showDeviceManager();
            }
          },
          {
            label: '心率显示',
            click: () => {
              this.windowManager.showHeartRateWindow();
            }
          },
          { type: 'separator' },
          {
            label: '重新加载',
            accelerator: 'CmdOrCtrl+R',
            click: (item, focusedWindow) => {
              if (focusedWindow) {
                focusedWindow.reload();
              } else {
                this.windowManager.reloadDeviceManager();
              }
            }
          },
          {
            label: '开发者工具',
            accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
            click: (item, focusedWindow) => {
              if (focusedWindow) {
                focusedWindow.webContents.openDevTools();
              } else {
                this.windowManager.openDeviceManagerDevTools();
              }
            }
          }
        ]
      }
    ];

    // macOS 特殊菜单处理
    if (process.platform === 'darwin') {
      const { app } = require('electron');
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
    
    console.log('✅ 应用菜单已创建');
  }

  // 创建托盘上下文菜单
  createTrayContextMenu() {
    const { dialog, app } = require('electron');
    
    return Menu.buildFromTemplate([
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
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
  }

  // 更新菜单项状态
  updateMenuStatus(status) {
    // 可以根据应用状态更新菜单项的启用/禁用状态
    // 例如蓝牙连接状态、设备扫描状态等
  }
}

module.exports = MenuBuilder;