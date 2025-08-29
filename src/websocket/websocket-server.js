// WebSocket服务器
const WebSocket = require('ws');
const EventEmitter = require('events');
const { WEBSOCKET_CONSTANTS } = require('../config/constants');
const MessageHandler = require('./message-handler');

class WebSocketServer extends EventEmitter {
  constructor(bluetoothManager, settings) {
    super();
    this.bluetoothManager = bluetoothManager;
    this.settings = settings;
    this.wss = null;
    this.messageHandler = new MessageHandler(bluetoothManager, settings);
    
    this.setupMessageHandlerEvents();
  }

  // 设置消息处理器事件
  setupMessageHandlerEvents() {
    this.messageHandler.on('displayModeChanged', (mode) => {
      this.emit('displayModeChanged', mode);
    });
    
    this.messageHandler.on('openHeartRateChart', () => {
      this.emit('openHeartRateChart');
    });
    
    this.messageHandler.on('broadcast', (message) => {
      this.broadcast(message);
    });
  }

  // 启动WebSocket服务器
  start(port = WEBSOCKET_CONSTANTS.DEFAULT_PORT) {
    if (this.wss) {
      console.log('WebSocket服务器已在运行');
      return;
    }

    this.wss = new WebSocket.Server({ port });
    console.log(`WebSocket服务器启动在端口${port}`);

    this.wss.on('connection', (ws) => {
      console.log('新的客户端连接');
      
      // 为新客户端发送初始数据
      this.messageHandler.sendInitialData(ws);
      
      // 处理客户端消息
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.messageHandler.handleMessage(data, ws);
        } catch (error) {
          console.error('解析客户端消息错误:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('客户端断开连接');
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket连接错误:', error);
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket服务器错误:', error);
    });
  }

  // 广播消息到所有客户端
  broadcast(message) {
    if (!this.wss) return;
    
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error('发送广播消息失败:', error);
        }
      }
    });
  }

  // 关闭WebSocket服务器
  close() {
    if (this.wss) {
      console.log('关闭WebSocket服务器');
      this.wss.close();
      this.wss = null;
    }
  }

  // 获取连接的客户端数量
  getClientCount() {
    return this.wss ? this.wss.clients.size : 0;
  }

  // 处理心率数据（保存到历史记录）
  handleHeartRateData(value, timestamp) {
    this.messageHandler.addHeartRateData(value, timestamp);
  }

  // 获取心率历史数据
  getHeartRateHistory() {
    return this.messageHandler.getHeartRateHistory();
  }

  // 清空心率历史数据
  clearHeartRateHistory() {
    this.messageHandler.clearHeartRateHistory();
  }

  // 检查服务器是否运行
  isRunning() {
    return !!this.wss;
  }
}

module.exports = WebSocketServer;