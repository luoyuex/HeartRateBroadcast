// 设备类型分析工具
const { BLUETOOTH_CONSTANTS } = require('../config/constants');

class DeviceAnalyzer {
  // 分析设备类型
  static analyzeDeviceType(name, serviceUuids, advertisement) {
    const nameLower = name.toLowerCase();
    
    // 明确的心率设备
    if (serviceUuids.includes(BLUETOOTH_CONSTANTS.HEART_RATE_SERVICE_UUID)) {
      return { category: 'heartrate', name: '心率设备', icon: '❤️' };
    }
    
    // 常见的可穿戴设备品牌和名称
    const wearablePatterns = [
      'watch', 'band', 'tracker', 'fit', 'health',
      'apple', 'samsung', 'huawei', 'xiaomi', 'mi', 'vivo', 'oppo',
      'polar', 'garmin', 'fitbit', 'amazfit', 'honor',
      '手环', '手表', '心率', '运动'
    ];
    
    if (wearablePatterns.some(pattern => nameLower.includes(pattern))) {
      return { category: 'wearable', name: '可穿戴设备', icon: '⌚' };
    }
    
    // 健身设备
    const fitnessPatterns = [
      'treadmill', 'bike', 'cycle', 'elliptical', 'rower',
      '跑步机', '单车', '椭圆机'
    ];
    
    if (fitnessPatterns.some(pattern => nameLower.includes(pattern))) {
      return { category: 'fitness', name: '健身设备', icon: '🏃' };
    }
    
    // 手机和平板
    const mobilePatterns = ['iphone', 'android', 'phone', 'ipad', 'tablet'];
    if (mobilePatterns.some(pattern => nameLower.includes(pattern))) {
      return { category: 'mobile', name: '移动设备', icon: '📱' };
    }
    
    // 耳机和音响
    const audioPatterns = ['airpods', 'headphone', 'speaker', 'earbuds', '耳机', '音响'];
    if (audioPatterns.some(pattern => nameLower.includes(pattern))) {
      return { category: 'audio', name: '音频设备', icon: '🎧' };
    }
    
    // 根据服务判断
    if (serviceUuids.length > 0) {
      return { category: 'smart', name: '智能设备', icon: '📟' };
    }
    
    // 有意义名称的未知设备
    if (name.length > 2 && !name.includes('未知')) {
      return { category: 'device', name: '蓝牙设备', icon: '📡' };
    }
    
    return { category: 'unknown', name: '未知设备', icon: '❓' };
  }

  // 判断设备是否应该显示
  static shouldShowDevice(device) {
    const { hasHeartRate, deviceType, originalName } = device;
    
    // 严格过滤：只显示心率相关的有价值设备
    return (
      hasHeartRate || // 明确支持心率服务
      deviceType.category === 'wearable' || // 可穿戴设备
      deviceType.category === 'fitness' || // 健身设备
      deviceType.category === 'heartrate' || // 心率设备
      (originalName && originalName.trim() !== '' && 
       !originalName.includes('Unknown') && 
       deviceType.category !== 'unknown') // 有真实名称且不是未知类型
    );
  }

  // 生成设备显示名称
  static generateDisplayName(originalName, hasHeartRateService, deviceType, address) {
    let displayName = originalName;
    
    if (!originalName || originalName.trim() === '') {
      // 根据设备类型给未知设备更好的名称
      if (hasHeartRateService) {
        displayName = `心率设备 ${address.slice(-5)}`;
      } else if (deviceType.category !== 'unknown') {
        displayName = `${deviceType.name} ${address.slice(-5)}`;
      } else {
        displayName = `未知设备 ${address.slice(-5)}`;
      }
    }
    
    return displayName;
  }
}

module.exports = DeviceAnalyzer;