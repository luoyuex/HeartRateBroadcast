// WebSocket消息处理器
const EventEmitter = require('events');
const HeartRateAnalyzer = require('../utils/heart-rate-analyzer');

class MessageHandler extends EventEmitter {
  constructor(bluetoothManager, settings) {
    super();
    this.bluetoothManager = bluetoothManager;
    this.settings = settings;
    
    // 使用新的心率分析器替代简单的数组存储
    this.heartRateAnalyzer = new HeartRateAnalyzer({
      realtimeLimit: 300,  // 图表显示用
      historyLimit: 1000,  // 分析用
      trendLimit: 1440     // 24小时趋势
    });
    
    // 设置异常检测回调
    this.heartRateAnalyzer.onAnomaly((anomalies) => {
      this.handleHeartRateAnomalies(anomalies);
    });
  }

  // 处理客户端消息
  async handleMessage(data, ws) {
    try {
      switch (data.type) {
        case 'startScan':
          await this.bluetoothManager.startScan();
          break;
          
        case 'stopScan':
          this.bluetoothManager.stopScan();
          break;
          
        case 'connectDevice':
          await this.bluetoothManager.connectDevice(data.deviceId);
          break;
          
        case 'disconnect':
          await this.bluetoothManager.disconnectDevice();
          break;
          
        case 'displayModeChange':
          this.handleDisplayModeChange(data.mode);
          break;
          
        case 'openHeartRateChart':
          this.handleOpenHeartRateChart();
          break;
          
        case 'requestHeartRateHistory':
          this.handleRequestHeartRateHistory(ws);
          break;
          
        case 'requestStatistics':
          this.handleRequestStatistics(ws);
          break;
          
        case 'updateThresholds':
          this.handleUpdateThresholds(data.thresholds);
          break;
          
        case 'exportData':
          this.handleExportData(ws, data.type);
          break;
          
        default:
          console.log('未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('处理客户端消息错误:', error);
      // 可以向客户端发送错误消息
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }

  // 处理显示模式变更
  handleDisplayModeChange(mode) {
    console.log('切换心率显示模式到:', mode);
    
    if (this.settings.setHeartRateDisplayMode(mode)) {
      // 发送模式变更事件
      this.emit('displayModeChanged', mode);
    }
  }

  // 处理打开心率图表请求
  handleOpenHeartRateChart() {
    console.log('收到打开心率图表的请求');
    this.emit('openHeartRateChart');
  }

  // 处理心率异常
  handleHeartRateAnomalies(anomalies) {
    console.log('⚠️  检测到心率异常:', anomalies.length, '个');
    
    // 广播异常信息到所有客户端
    this.emit('broadcast', {
      type: 'heartRateAnomalies',
      anomalies: anomalies,
      timestamp: Date.now()
    });
    
    // 记录严重异常
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      console.log('🚨 检测到严重心率异常:', criticalAnomalies);
    }
  }

  // 处理请求心率历史数据
  handleRequestHeartRateHistory(ws) {
    const historyData = this.heartRateAnalyzer.getRealtimeData(); // 图表用实时数据
    console.log('发送心率历史数据:', historyData.length, '条');
    ws.send(JSON.stringify({
      type: 'heartRateHistory',
      history: historyData
    }));
  }

  // 处理请求统计信息
  handleRequestStatistics(ws) {
    const statistics = this.heartRateAnalyzer.getStatistics();
    console.log('发送心率统计信息:', statistics);
    ws.send(JSON.stringify({
      type: 'heartRateStatistics',
      statistics: statistics
    }));
  }

  // 处理更新检测阈值
  handleUpdateThresholds(thresholds) {
    this.heartRateAnalyzer.updateThresholds(thresholds);
    
    // 广播阈值更新
    this.emit('broadcast', {
      type: 'thresholdsUpdated',
      thresholds: this.heartRateAnalyzer.thresholds
    });
  }

  // 处理数据导出
  handleExportData(ws, type = 'all') {
    const exportedData = this.heartRateAnalyzer.exportData(type);
    ws.send(JSON.stringify({
      type: 'dataExported',
      data: exportedData,
      exportType: type
    }));
  }

  // 添加心率数据到分析器
  addHeartRateData(value, timestamp) {
    this.heartRateAnalyzer.addHeartRateData(value, timestamp);
  }

  // 获取心率历史数据（兼容旧接口）
  getHeartRateHistory() {
    return this.heartRateAnalyzer.getRealtimeData();
  }

  // 清空心率历史数据
  clearHeartRateHistory() {
    this.heartRateAnalyzer.clearAllData();
  }

  // 为新连接的客户端发送初始数据
  sendInitialData(ws) {
    // 发送当前设备列表
    ws.send(JSON.stringify({
      type: 'deviceList',
      devices: this.bluetoothManager.getDiscoveredDevices()
    }));
    
    // 发送蓝牙状态
    ws.send(JSON.stringify({
      type: 'bluetoothStatus',
      state: this.bluetoothManager.getBluetoothState()
    }));
    
    // 发送当前心率显示模式设置
    ws.send(JSON.stringify({
      type: 'displayModeSync',
      mode: this.settings.getHeartRateDisplayMode()
    }));
    
    // 发送当前连接状态和心率数据
    const isConnected = this.bluetoothManager.isConnected();
    if (isConnected) {
      const currentDevice = this.bluetoothManager.getCurrentDevice();
      ws.send(JSON.stringify({
        type: 'connectionStatus',
        connected: true,
        device: currentDevice
      }));
      
      // 发送当前心率值
      const currentHeartRate = this.bluetoothManager.getCurrentHeartRate();
      if (currentHeartRate && currentHeartRate !== '--') {
        ws.send(JSON.stringify({
          type: 'heartRate',
          value: currentHeartRate,
          timestamp: Date.now()
        }));
      }
    } else {
      ws.send(JSON.stringify({
        type: 'connectionStatus',
        connected: false
      }));
    }
  }
}

module.exports = MessageHandler;