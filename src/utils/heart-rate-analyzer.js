// 心率数据分析器 - 处理异常检测和数据管理
class HeartRateAnalyzer {
  constructor(options = {}) {
    // 数据存储配置
    this.realtimeLimit = options.realtimeLimit || 300; // 实时数据限制
    this.historyLimit = options.historyLimit || 1000; // 历史数据限制
    this.trendLimit = options.trendLimit || 1440; // 趋势数据限制（24小时，每分钟一个点）
    
    // 数据存储
    this.realtimeData = []; // 实时数据（用于图表显示）
    this.historyData = [];  // 历史数据（用于分析）
    this.trendData = [];    // 趋势数据（压缩的长期数据）
    
    // 异常检测配置
    this.thresholds = {
      restingMin: options.restingMin || 50,     // 静息最低心率
      restingMax: options.restingMax || 100,    // 静息最高心率
      maxHeartRate: options.maxHeartRate || 200, // 最大心率
      rapidChange: options.rapidChange || 30,    // 急剧变化阈值
      variabilityThreshold: options.variabilityThreshold || 0.3 // 心率变异性阈值
    };
    
    // 分析窗口
    this.analysisWindowSize = 10; // 分析窗口大小（数据点数）
    this.trendInterval = 60000;   // 趋势数据间隔（毫秒）
    this.lastTrendTime = 0;       // 上次趋势数据时间
    
    // 异常检测状态
    this.lastAnalysisTime = 0;
    this.anomalyCallbacks = [];
  }

  // 添加心率数据
  addHeartRateData(value, timestamp = Date.now()) {
    const record = { value, timestamp };
    
    // 添加到实时数据
    this.realtimeData.push(record);
    if (this.realtimeData.length > this.realtimeLimit) {
      this.realtimeData.shift();
    }
    
    // 添加到历史数据
    this.historyData.push(record);
    if (this.historyData.length > this.historyLimit) {
      this.historyData.shift();
    }
    
    // 处理趋势数据（每分钟压缩一次）
    this.processTrendData(record);
    
    // 执行异常检测
    this.detectAnomalies();
    
    console.log(`📊 心率数据已添加: ${value} bpm (实时:${this.realtimeData.length}, 历史:${this.historyData.length}, 趋势:${this.trendData.length})`);
  }

  // 处理趋势数据
  processTrendData(record) {
    const now = record.timestamp;
    
    // 检查是否需要创建新的趋势数据点
    if (now - this.lastTrendTime >= this.trendInterval) {
      // 计算过去一分钟的平均心率
      const oneMinuteAgo = now - this.trendInterval;
      const recentData = this.historyData.filter(r => r.timestamp >= oneMinuteAgo);
      
      if (recentData.length > 0) {
        const avgHeartRate = Math.round(
          recentData.reduce((sum, r) => sum + r.value, 0) / recentData.length
        );
        
        const trendRecord = {
          value: avgHeartRate,
          timestamp: now,
          type: 'trend',
          dataPoints: recentData.length
        };
        
        this.trendData.push(trendRecord);
        
        // 限制趋势数据数量
        if (this.trendData.length > this.trendLimit) {
          this.trendData.shift();
        }
        
        this.lastTrendTime = now;
      }
    }
  }

  // 异常检测
  detectAnomalies() {
    if (this.realtimeData.length < this.analysisWindowSize) {
      return; // 数据不足，无法分析
    }
    
    const recentData = this.realtimeData.slice(-this.analysisWindowSize);
    const currentValue = recentData[recentData.length - 1].value;
    const previousValue = recentData[recentData.length - 2]?.value;
    
    const anomalies = [];
    
    // 1. 心率过高或过低检测
    if (currentValue < this.thresholds.restingMin) {
      anomalies.push({
        type: 'low_heart_rate',
        severity: 'warning',
        value: currentValue,
        threshold: this.thresholds.restingMin,
        message: `心率过低 (${currentValue} bpm < ${this.thresholds.restingMin} bpm)`
      });
    } else if (currentValue > this.thresholds.maxHeartRate) {
      anomalies.push({
        type: 'high_heart_rate',
        severity: 'critical',
        value: currentValue,
        threshold: this.thresholds.maxHeartRate,
        message: `心率过高 (${currentValue} bpm > ${this.thresholds.maxHeartRate} bpm)`
      });
    } else if (currentValue > this.thresholds.restingMax) {
      anomalies.push({
        type: 'elevated_heart_rate',
        severity: 'info',
        value: currentValue,
        threshold: this.thresholds.restingMax,
        message: `心率偏高 (${currentValue} bpm > ${this.thresholds.restingMax} bpm)`
      });
    }
    
    // 2. 急剧变化检测
    if (previousValue) {
      const change = Math.abs(currentValue - previousValue);
      if (change > this.thresholds.rapidChange) {
        anomalies.push({
          type: 'rapid_change',
          severity: 'warning',
          value: currentValue,
          previousValue: previousValue,
          change: change,
          message: `心率急剧变化 (变化: ${change} bpm)`
        });
      }
    }
    
    // 3. 心率变异性分析
    if (recentData.length >= this.analysisWindowSize) {
      const variability = this.calculateHeartRateVariability(recentData);
      if (variability < this.thresholds.variabilityThreshold) {
        anomalies.push({
          type: 'low_variability',
          severity: 'info',
          value: variability,
          threshold: this.thresholds.variabilityThreshold,
          message: `心率变异性偏低 (HRV: ${variability.toFixed(3)})`
        });
      }
    }
    
    // 4. 连续异常值检测
    const consecutiveAnomalies = this.detectConsecutiveAnomalies(recentData);
    if (consecutiveAnomalies.length > 0) {
      anomalies.push(...consecutiveAnomalies);
    }
    
    // 触发异常回调
    if (anomalies.length > 0) {
      this.triggerAnomalyCallbacks(anomalies);
    }
  }

  // 计算心率变异性 (RMSSD)
  calculateHeartRateVariability(data) {
    if (data.length < 2) return 0;
    
    let sumSquaredDifferences = 0;
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].value - data[i - 1].value;
      sumSquaredDifferences += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDifferences / (data.length - 1));
  }

  // 检测连续异常值
  detectConsecutiveAnomalies(data) {
    const anomalies = [];
    let consecutiveHigh = 0;
    let consecutiveLow = 0;
    
    for (const record of data) {
      if (record.value > this.thresholds.restingMax) {
        consecutiveHigh++;
        consecutiveLow = 0;
      } else if (record.value < this.thresholds.restingMin) {
        consecutiveLow++;
        consecutiveHigh = 0;
      } else {
        consecutiveHigh = 0;
        consecutiveLow = 0;
      }
    }
    
    if (consecutiveHigh >= 5) {
      anomalies.push({
        type: 'consecutive_high',
        severity: 'warning',
        count: consecutiveHigh,
        message: `连续${consecutiveHigh}次心率偏高`
      });
    }
    
    if (consecutiveLow >= 5) {
      anomalies.push({
        type: 'consecutive_low',
        severity: 'warning',
        count: consecutiveLow,
        message: `连续${consecutiveLow}次心率偏低`
      });
    }
    
    return anomalies;
  }

  // 获取统计信息
  getStatistics() {
    if (this.realtimeData.length === 0) {
      return null;
    }
    
    const values = this.realtimeData.map(r => r.value);
    const currentValue = values[values.length - 1];
    const avgValue = Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const hrv = this.calculateHeartRateVariability(this.realtimeData.slice(-20));
    
    return {
      current: currentValue,
      average: avgValue,
      min: minValue,
      max: maxValue,
      count: values.length,
      hrv: hrv.toFixed(3),
      timeSpan: this.getTimeSpan()
    };
  }

  // 获取时间跨度
  getTimeSpan() {
    if (this.realtimeData.length < 2) return '0分钟';
    
    const start = this.realtimeData[0].timestamp;
    const end = this.realtimeData[this.realtimeData.length - 1].timestamp;
    const spanMinutes = Math.round((end - start) / 60000);
    
    if (spanMinutes < 60) {
      return `${spanMinutes}分钟`;
    } else {
      const hours = Math.floor(spanMinutes / 60);
      const minutes = spanMinutes % 60;
      return `${hours}小时${minutes}分钟`;
    }
  }

  // 注册异常回调
  onAnomaly(callback) {
    this.anomalyCallbacks.push(callback);
  }

  // 触发异常回调
  triggerAnomalyCallbacks(anomalies) {
    this.anomalyCallbacks.forEach(callback => {
      try {
        callback(anomalies);
      } catch (error) {
        console.error('异常回调执行错误:', error);
      }
    });
  }

  // 获取不同类型的数据
  getRealtimeData() {
    return [...this.realtimeData];
  }

  getHistoryData() {
    return [...this.historyData];
  }

  getTrendData() {
    return [...this.trendData];
  }

  // 清空所有数据
  clearAllData() {
    this.realtimeData = [];
    this.historyData = [];
    this.trendData = [];
    this.lastTrendTime = 0;
    console.log('🗑️ 所有心率数据已清空');
  }

  // 导出数据
  exportData(type = 'all') {
    const data = {
      timestamp: Date.now(),
      statistics: this.getStatistics(),
      thresholds: this.thresholds
    };

    switch (type) {
      case 'realtime':
        data.data = this.realtimeData;
        break;
      case 'history':
        data.data = this.historyData;
        break;
      case 'trend':
        data.data = this.trendData;
        break;
      default:
        data.realtimeData = this.realtimeData;
        data.historyData = this.historyData;
        data.trendData = this.trendData;
    }

    return data;
  }

  // 更新检测阈值
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('⚙️ 异常检测阈值已更新:', this.thresholds);
  }
}

module.exports = HeartRateAnalyzer;