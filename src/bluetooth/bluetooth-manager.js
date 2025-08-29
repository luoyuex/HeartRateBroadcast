// 蓝牙管理器 - 统一管理蓝牙功能
const noble = require("@abandonware/noble");
const EventEmitter = require('events');
const DeviceScanner = require('./device-scanner');
const HeartRateReader = require('./heart-rate-reader');
const { APP_CONSTANTS } = require('../config/constants');

class BluetoothManager extends EventEmitter {
  constructor() {
    super();
    this.deviceScanner = new DeviceScanner();
    this.heartRateReader = new HeartRateReader();
    this.currentHeartRate = APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE;
    this.initialized = false;
    
    this.setupEventHandlers();
  }

  // 设置事件处理器
  setupEventHandlers() {
    // 设备扫描器事件转发
    this.deviceScanner.on('scanStatus', (data) => {
      this.emit('scanStatus', data);
    });
    
    this.deviceScanner.on('deviceList', (devices) => {
      this.emit('deviceList', { devices });
    });
    
    this.deviceScanner.on('deviceFound', (device) => {
      this.emit('deviceFound', { device });
    });
    
    this.deviceScanner.on('deviceUpdate', (device) => {
      this.emit('deviceUpdate', { device });
    });

    // 心率读取器事件转发
    this.heartRateReader.on('connectionStatus', (data) => {
      this.emit('connectionStatus', data);
    });
    
    this.heartRateReader.on('heartRate', (data) => {
      this.currentHeartRate = data.value;
      this.emit('heartRate', data);
    });
    
    this.heartRateReader.on('error', (error) => {
      this.emit('connectionError', error);
    });
  }

  // 初始化蓝牙
  init() {
    if (this.initialized) return;

    // 检查平台兼容性
    this.checkPlatformCompatibility();
    
    noble.on("stateChange", async (state) => {
      console.log(`蓝牙状态: ${state}`);
      await this.handleStateChange(state);
    });

    noble.on("discover", (peripheral) => {
      this.deviceScanner.handleDeviceDiscovered(peripheral);
    });

    this.initialized = true;
  }

  // 检查平台兼容性
  checkPlatformCompatibility() {
    if (process.platform === 'win32') {
      console.log('⚠️  Windows 平台蓝牙提示：');
      console.log('1. 确保以管理员权限运行应用');
      console.log('2. 确保蓝牙已启用且驱动正常');
      console.log('3. Windows 10/11 需要蓝牙 LE 支持');
    }
  }

  // 处理蓝牙状态变化
  async handleStateChange(state) {
    // Windows 平台特殊处理
    if (process.platform === 'win32' && state === 'unsupported') {
      console.log('❌ Windows 蓝牙不支持');
      console.log('💡 解决方案：');
      console.log('   1. 右键以管理员身份运行应用');
      console.log('   2. 检查设备管理器中的蓝牙驱动');
      console.log('   3. 确保蓝牙服务正在运行');
      console.log('   4. 重启蓝牙适配器');
      
      this.emit('bluetoothStatus', {
        state: state,
        platform: 'windows',
        error: 'Windows蓝牙不支持，请检查驱动和权限'
      });
      return;
    }
    
    this.emit('bluetoothStatus', {
      state: state,
      platform: process.platform
    });
    
    if (state === "poweredOn" && this.deviceScanner.getIsScanning()) {
      // 重新启动扫描，允许重复发现
      await noble.startScanningAsync([], true);
    } else if (state !== "poweredOn") {
      noble.stopScanning();
      this.deviceScanner.stopScan();
    }
  }

  // 启动设备扫描
  async startScan() {
    await this.deviceScanner.startScan();
  }

  // 停止设备扫描
  stopScan() {
    this.deviceScanner.stopScan();
  }

  // 连接到设备
  async connectDevice(deviceId) {
    const device = this.deviceScanner.getDevice(deviceId);
    if (!device || !device.peripheral) {
      console.log('设备不存在:', deviceId);
      return;
    }
    
    try {
      // 断开现有连接
      await this.disconnectDevice();
      
      // 停止扫描
      this.stopScan();
      
      // 连接到心率设备
      await this.heartRateReader.connectAndRead(device.peripheral);
      
      this.emit('connectionStatus', {
        connected: true,
        device: {
          id: deviceId,
          name: device.name,
          address: device.address
        }
      });
      
    } catch (error) {
      console.error('连接设备失败:', error);
      this.emit('connectionError', {
        message: error.message
      });
    }
  }

  // 断开设备连接
  async disconnectDevice() {
    await this.heartRateReader.disconnect();
    this.currentHeartRate = APP_CONSTANTS.DEFAULT_HEART_RATE_VALUE;
    
    this.emit('heartRateReset');
  }

  // 获取当前心率
  getCurrentHeartRate() {
    return this.currentHeartRate;
  }

  // 获取发现的设备列表
  getDiscoveredDevices() {
    return this.deviceScanner.getDiscoveredDevices();
  }

  // 获取蓝牙状态
  getBluetoothState() {
    return noble.state;
  }

  // 获取连接状态
  isConnected() {
    return this.heartRateReader.isConnected();
  }

  // 获取当前连接的设备信息
  getCurrentDevice() {
    return this.heartRateReader.getCurrentDevice();
  }

  // 清理资源
  cleanup() {
    this.disconnectDevice();
    this.stopScan();
    noble.stopScanning();
  }
}

module.exports = BluetoothManager;