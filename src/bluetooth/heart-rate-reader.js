// 心率数据读取器
const EventEmitter = require('events');
const { BLUETOOTH_CONSTANTS } = require('../config/constants');

class HeartRateReader extends EventEmitter {
  constructor() {
    super();
    this.currentConnection = null;
    this.heartRateCharacteristic = null;
    this.currentDevice = null; // 保存当前连接的设备信息
  }

  // 连接到心率设备并开始读取
  async connectAndRead(peripheral) {
    try {
      console.log(`连接心率设备: ${peripheral.advertisement.localName} [${peripheral.address}]`);
      
      await peripheral.connectAsync();
      this.currentConnection = peripheral;
      
      // 保存设备信息
      this.currentDevice = {
        name: peripheral.advertisement.localName,
        address: peripheral.address
      };
      
      this.emit('connectionStatus', {
        connected: true,
        device: this.currentDevice
      });
      
      // 发现心率服务
      const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
        [BLUETOOTH_CONSTANTS.HEART_RATE_SERVICE_UUID],
        [BLUETOOTH_CONSTANTS.HEART_RATE_MEASUREMENT_UUID]
      );
      
      if (characteristics.length > 0) {
        await this.setupHeartRateCharacteristic(characteristics[0]);
      } else {
        console.log("未找到心率测量特征");
        this.emit('error', { message: '未找到心率测量特征' });
      }
      
    } catch (error) {
      console.error('连接心率设备失败:', error);
      this.emit('error', { message: error.message });
    }
  }

  // 设置心率特征监听
  async setupHeartRateCharacteristic(characteristic) {
    this.heartRateCharacteristic = characteristic;
    
    characteristic.on("data", (data) => {
      const hrValue = this.parseHeartRateData(data);
      console.log(`❤️ 心率: ${hrValue} bpm`);
      
      this.emit('heartRate', {
        value: hrValue,
        timestamp: Date.now()
      });
    });
    
    await characteristic.subscribeAsync();
    console.log("开始监听心率数据...");
  }

  // 解析心率数据
  parseHeartRateData(data) {
    let hrValue;
    if ((data[0] & 0x01) === 0) {
      // 8位心率值
      hrValue = data.readUInt8(1);
    } else {
      // 16位心率值
      hrValue = data.readUInt16LE(1);
    }
    return hrValue;
  }

  // 断开连接
  async disconnect() {
    if (this.currentConnection) {
      try {
        if (this.heartRateCharacteristic) {
          await this.heartRateCharacteristic.unsubscribeAsync();
          this.heartRateCharacteristic = null;
        }
        
        await this.currentConnection.disconnectAsync();
        console.log('心率设备已断开连接');
      } catch (error) {
        console.error('断开心率连接错误:', error);
      }
      
      this.currentConnection = null;
      this.currentDevice = null; // 清空设备信息
      
      this.emit('connectionStatus', {
        connected: false
      });
    }
  }

  // 获取连接状态
  isConnected() {
    return !!this.currentConnection;
  }

  // 获取当前连接的设备
  getCurrentDevice() {
    return this.currentDevice;
  }
}

module.exports = HeartRateReader;