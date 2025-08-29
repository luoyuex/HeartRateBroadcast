// 蓝牙设备扫描管理
const noble = require("@abandonware/noble");
const EventEmitter = require('events');
const { BLUETOOTH_CONSTANTS } = require('../config/constants');
const DeviceAnalyzer = require('../utils/device-analyzer');

class DeviceScanner extends EventEmitter {
  constructor() {
    super();
    this.discoveredDevices = new Map();
    this.isScanning = false;
    this.scanTimeout = null;
  }

  // 启动设备扫描
  async startScan() {
    if (this.isScanning) return;
    
    console.log("🔍 开始扫描蓝牙设备...");
    console.log(`📋 清空设备列表 (之前有 ${this.discoveredDevices.size} 个设备)`);
    
    this.discoveredDevices.clear();
    this.isScanning = true;
    
    this.emit('scanStatus', { scanning: true });
    this.emit('deviceList', []);
    
    if (noble.state === 'poweredOn') {
      // 持续扫描，不限制特定服务，允许重复发现
      console.log("📡 启动蓝牙扫描（允许重复发现）");
      await noble.startScanningAsync([], true);
      
      // 设置扫描超时
      this.scanTimeout = setTimeout(() => {
        if (this.isScanning) {
          console.log("⏰ 扫描超时，自动停止");
          this.stopScan();
        }
      }, BLUETOOTH_CONSTANTS.SCAN_TIMEOUT);
    } else {
      console.log("❌ 蓝牙未就绪，状态:", noble.state);
    }
  }

  // 停止设备扫描
  stopScan() {
    if (!this.isScanning) return;
    
    console.log("🛑 停止扫描");
    console.log(`📊 扫描结果: 发现 ${this.discoveredDevices.size} 个设备`);
    
    // 列出所有发现的设备
    const devices = Array.from(this.discoveredDevices.values());
    console.log(`🔍 Map中实际设备数量: ${devices.length}`);
    
    devices.forEach((device, index) => {
      console.log(`  📱 [${index + 1}] ${device.name} [${device.address}] ${device.hasHeartRate ? '❤️' : ''} (ID: ${device.id})`);
    });
    
    noble.stopScanning();
    this.isScanning = false;
    
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    
    this.emit('scanStatus', { scanning: false });
  }

  // 处理发现的设备
  handleDeviceDiscovered(peripheral) {
    // 只在扫描状态下处理发现的设备
    if (!this.isScanning) return;
    
    const originalName = peripheral.advertisement.localName;
    const address = peripheral.address;
    // 使用地址和peripheral的uuid创建唯一ID
    const deviceId = `${address}_${peripheral.uuid || peripheral.id || Math.random().toString(36).substr(2, 9)}`;
    
    // 检查是否支持心率服务
    const serviceUuids = peripheral.advertisement.serviceUuids || [];
    const hasHeartRateService = serviceUuids.includes(BLUETOOTH_CONSTANTS.HEART_RATE_SERVICE_UUID);
    
    // 设备类型分析
    const deviceType = DeviceAnalyzer.analyzeDeviceType(originalName || '', serviceUuids, peripheral.advertisement);
    
    // 生成显示名称
    const displayName = DeviceAnalyzer.generateDisplayName(originalName, hasHeartRateService, deviceType, address);
    
    // 创建设备信息对象
    const deviceInfo = {
      id: deviceId,
      name: displayName,
      originalName,
      address,
      rssi: peripheral.rssi,
      hasHeartRate: hasHeartRateService,
      deviceType,
      serviceUuids,
      peripheral
    };

    // 严格过滤设备
    if (DeviceAnalyzer.shouldShowDevice({ 
      hasHeartRate: hasHeartRateService, 
      deviceType, 
      originalName 
    })) {
      this.processValidDevice(deviceInfo);
    }
  }

  // 处理有效设备
  processValidDevice(deviceInfo) {
    const now = Date.now();
    
    if (!this.discoveredDevices.has(deviceInfo.id)) {
      // 新设备
      deviceInfo.firstSeen = now;
      deviceInfo.lastSeen = now;
      deviceInfo.updateCount = 1;
      
      this.discoveredDevices.set(deviceInfo.id, deviceInfo);
      
      const typeIcon = deviceInfo.deviceType.icon;
      const heartIcon = deviceInfo.hasHeartRate ? ' ❤️' : '';
      console.log(`🆕 发现新设备: ${deviceInfo.name} [${deviceInfo.address}] ${typeIcon} RSSI: ${deviceInfo.rssi}${heartIcon}`);
      
      this.emit('deviceFound', {
        id: deviceInfo.id,
        name: deviceInfo.name,
        address: deviceInfo.address,
        rssi: deviceInfo.rssi,
        hasHeartRate: deviceInfo.hasHeartRate,
        deviceType: deviceInfo.deviceType,
        serviceCount: deviceInfo.serviceUuids.length
      });
    } else {
      // 更新现有设备信息
      this.updateExistingDevice(deviceInfo, now);
    }
  }

  // 更新现有设备
  updateExistingDevice(newDeviceInfo, now) {
    const device = this.discoveredDevices.get(newDeviceInfo.id);
    const oldRssi = device.rssi;
    
    device.rssi = newDeviceInfo.rssi;
    device.lastSeen = now;
    device.updateCount++;
    device.peripheral = newDeviceInfo.peripheral; // 更新peripheral引用
    
    // 只有RSSI变化较大时才发送更新事件
    if (Math.abs(oldRssi - newDeviceInfo.rssi) >= BLUETOOTH_CONSTANTS.RSSI_UPDATE_THRESHOLD) {
      console.log(`🔄 更新设备: ${device.name} RSSI: ${oldRssi} -> ${newDeviceInfo.rssi}`);
      this.emit('deviceUpdate', {
        id: newDeviceInfo.id,
        rssi: newDeviceInfo.rssi
      });
    }
  }

  // 获取发现的设备列表
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values()).map(d => ({
      id: d.id,
      name: d.name,
      address: d.address,
      rssi: d.rssi,
      hasHeartRate: d.hasHeartRate,
      deviceType: d.deviceType,
      serviceCount: d.serviceUuids ? d.serviceUuids.length : 0
    }));
  }

  // 根据ID获取设备
  getDevice(deviceId) {
    return this.discoveredDevices.get(deviceId);
  }

  // 清空设备列表
  clearDevices() {
    this.discoveredDevices.clear();
  }

  // 获取扫描状态
  getIsScanning() {
    return this.isScanning;
  }
}

module.exports = DeviceScanner;