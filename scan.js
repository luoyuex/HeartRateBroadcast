const noble = require("@abandonware/noble");
const WebSocket = require('ws');

const HEART_RATE_SERVICE_UUID = "180d";
const HEART_RATE_MEASUREMENT_UUID = "2a37";

// 设备存储
const discoveredDevices = new Map();
let currentConnection = null;
let isScanning = false;

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket服务器启动在端口8080');

wss.on('connection', (ws) => {
  console.log('新的客户端连接');
  
  // 发送当前设备列表
  ws.send(JSON.stringify({
    type: 'deviceList',
    devices: Array.from(discoveredDevices.values())
  }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleClientMessage(data, ws);
    } catch (error) {
      console.error('处理客户端消息错误:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('客户端断开连接');
  });
});

// 处理客户端消息
async function handleClientMessage(data, ws) {
  switch (data.type) {
    case 'startScan':
      await startDeviceScan();
      break;
    case 'stopScan':
      stopDeviceScan();
      break;
    case 'connectDevice':
      await connectToDevice(data.deviceId);
      break;
    case 'disconnect':
      await disconnectDevice();
      break;
    default:
      console.log('未知消息类型:', data.type);
  }
}

// 广播消息到所有客户端
function broadcast(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 启动设备扫描
async function startDeviceScan() {
  if (isScanning) return;
  
  console.log("开始扫描蓝牙设备...");
  discoveredDevices.clear();
  isScanning = true;
  
  broadcast({
    type: 'scanStatus',
    scanning: true
  });
  
  if (noble.state === 'poweredOn') {
    await noble.startScanningAsync([], false);
  }
}

// 停止设备扫描
function stopDeviceScan() {
  if (!isScanning) return;
  
  console.log("停止扫描");
  noble.stopScanning();
  isScanning = false;
  
  broadcast({
    type: 'scanStatus',
    scanning: false
  });
}

// 连接到指定设备
async function connectToDevice(deviceId) {
  const device = discoveredDevices.get(deviceId);
  if (!device || !device.peripheral) {
    console.log('设备不存在:', deviceId);
    return;
  }
  
  try {
    // 断开现有连接
    await disconnectDevice();
    
    console.log(`连接设备: ${device.name} [${device.address}]`);
    stopDeviceScan();
    
    await device.peripheral.connectAsync();
    currentConnection = device.peripheral;
    
    broadcast({
      type: 'connectionStatus',
      connected: true,
      device: {
        id: deviceId,
        name: device.name,
        address: device.address
      }
    });
    
    // 发现心率服务
    const { characteristics } = await device.peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [HEART_RATE_SERVICE_UUID],
      [HEART_RATE_MEASUREMENT_UUID]
    );
    
    if (characteristics.length > 0) {
      const hrChar = characteristics[0];
      hrChar.on("data", (data) => {
        let hrValue;
        if ((data[0] & 0x01) === 0) {
          hrValue = data.readUInt8(1);
        } else {
          hrValue = data.readUInt16LE(1);
        }
        
        console.log(`❤️ 心率: ${hrValue} bpm`);
        broadcast({
          type: 'heartRate',
          value: hrValue,
          timestamp: Date.now()
        });
      });
      
      await hrChar.subscribeAsync();
      console.log("开始监听心率数据...");
    } else {
      console.log("未找到心率测量特征");
    }
    
  } catch (error) {
    console.error('连接设备失败:', error);
    broadcast({
      type: 'connectionError',
      message: error.message
    });
  }
}

// 断开设备连接
async function disconnectDevice() {
  if (currentConnection) {
    try {
      await currentConnection.disconnectAsync();
      console.log('设备已断开连接');
    } catch (error) {
      console.error('断开连接错误:', error);
    }
    
    currentConnection = null;
    broadcast({
      type: 'connectionStatus',
      connected: false
    });
  }
}

noble.on("stateChange", async (state) => {
  console.log(`蓝牙状态: ${state}`);
  broadcast({
    type: 'bluetoothStatus',
    state: state
  });
  
  if (state === "poweredOn" && isScanning) {
    await noble.startScanningAsync([], false);
  } else if (state !== "poweredOn") {
    noble.stopScanning();
    isScanning = false;
  }
});

noble.on("discover", (peripheral) => {
  const name = peripheral.advertisement.localName || '未知设备';
  const address = peripheral.address;
  
  // 检查是否支持心率服务
  const hasHeartRateService = peripheral.advertisement.serviceUuids && 
    peripheral.advertisement.serviceUuids.includes(HEART_RATE_SERVICE_UUID);
  
  // 过滤：只显示有名称或有心率服务的设备
  if (name !== '未知设备' || hasHeartRateService) {
    const deviceId = address;
    
    if (!discoveredDevices.has(deviceId)) {
      const deviceInfo = {
        id: deviceId,
        name: name,
        address: address,
        rssi: peripheral.rssi,
        hasHeartRate: hasHeartRateService,
        peripheral: peripheral
      };
      
      discoveredDevices.set(deviceId, deviceInfo);
      
      console.log(`发现设备: ${name} [${address}] RSSI: ${peripheral.rssi}${hasHeartRateService ? ' ❤️' : ''}`);
      
      broadcast({
        type: 'deviceFound',
        device: {
          id: deviceId,
          name: name,
          address: address,
          rssi: peripheral.rssi,
          hasHeartRate: hasHeartRateService
        }
      });
    } else {
      // 更新RSSI信息
      const device = discoveredDevices.get(deviceId);
      device.rssi = peripheral.rssi;
      broadcast({
        type: 'deviceUpdate',
        device: {
          id: deviceId,
          rssi: peripheral.rssi
        }
      });
    }
  }
});

// 处理进程退出
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务...');
  await disconnectDevice();
  noble.stopScanning();
  process.exit(0);
});

console.log('心率设备管理器已启动');
console.log('使用WebSocket连接到 ws://localhost:8080 进行设备管理');
