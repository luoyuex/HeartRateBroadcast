# Spark - 智能心率监测系统 ❤️

<div align="center">

![Spark Logo](icon.icns)

**专业级蓝牙心率监测桌面应用**

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](package.json)
[![Electron](https://img.shields.io/badge/electron-28.0.0-9feaf9.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#系统要求)

</div>

## ✨ 核心特性

### 📊 **智能心率分析**
- 🔍 **实时异常检测** - 智能识别心率异常波动
- 📈 **专业数据分析** - HRV心率变异性分析
- ⚠️ **多级警报系统** - 信息/警告/严重三级异常提醒
- 📋 **健康趋势分析** - 长期心率健康趋势监测

### 🎯 **多模式显示**
- 🖥️ **桌面悬浮窗** - 始终置顶的实时心率显示
- 📱 **系统托盘图标** - 心率数据直接显示在托盘
- 📊 **专业图表分析** - ECharts驱动的详细数据图表
- 🎨 **现代化界面** - 简洁美观的UI设计

### 🔗 **智能设备管理**
- 🔍 **自动设备识别** - 智能识别心率设备类型
- ⚡ **一键连接** - 简单快速的设备连接
- 🔄 **自动重连** - 断线自动重连机制
- 📡 **信号强度显示** - 实时RSSI信号指示

### 📈 **数据管理**
- 💾 **分层数据存储** - 实时/历史/趋势三层数据管理
- 📊 **统计分析** - 平均值、最值、心率变异性统计
- 📤 **数据导出** - 支持JSON格式数据导出
- ⏱️ **时间跨度分析** - 灵活的时间范围数据查看

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动应用
```bash
npm start
```

应用会自动：
- ✅ 启动蓝牙设备管理服务
- ✅ 打开设备管理器窗口
- ✅ 初始化系统托盘
- ✅ 准备好所有监测功能

### 连接设备
1. **扫描设备** - 点击"开始扫描设备"
2. **选择设备** - 从列表中选择心率设备（❤️ 标识）
3. **一键连接** - 点击设备卡片即可连接
4. **开始监测** - 连接成功后自动开始心率监测

## 📱 功能界面

### 🏠 设备管理器
<details>
<summary>点击展开界面说明</summary>

- **设备扫描** - 智能发现附近的心率设备
- **设备分类** - 自动识别可穿戴、健身、心率设备
- **信号指示** - 绿色/黄色/红色RSSI信号强度
- **连接状态** - 实时显示设备连接状态
- **心率显示模式切换** - 桌面显示/托盘图标模式

</details>

### 📊 心率图表分析
<details>
<summary>点击展开功能详情</summary>

- **实时折线图** - ECharts驱动的专业图表
- **异常标记** - 图表上直接标记异常心率点
- **缩放拖拽** - 支持图表缩放和时间范围选择
- **数据统计** - 当前/平均/最高心率实时统计
- **智能滚动** - 自动跟随最新数据，保持用户缩放状态

</details>

### 🔔 异常检测系统
<details>
<summary>点击展开检测算法</summary>

- **基础检测** - 心率过高/过低警报
- **变化检测** - 急剧变化识别（>30 bpm）
- **心率变异性** - HRV分析，检测心律不齐
- **连续异常** - 连续异常值模式识别
- **可配置阈值** - 用户可自定义检测阈值

</details>

## 🎯 设备兼容性

### ✅ **完全支持**
- ❤️ **专业心率设备** - 支持BLE心率服务的专业设备
- ⌚ **智能手表** - Apple Watch、华为、小米、三星等
- 🏃 **健身设备** - 跑步机、动感单车、椭圆机心率监测
- 📟 **运动手环** - 各品牌运动手环心率功能

### 📱 **设备识别**
应用智能识别以下设备类型：
- Apple Watch、华为Watch、小米手环
- Polar、Garmin、Fitbit等专业设备
- 健身器材内置心率监测
- 其他支持BLE心率服务的设备

## ⚙️ 系统要求

- **操作系统**: macOS 10.14+、Windows 10+、Linux
- **蓝牙**: 蓝牙4.0+ (BLE支持)
- **Node.js**: 16.0+
- **内存**: 256MB+
- **存储**: 100MB+

## 🔧 高级功能

### 🌐 Web模式
```bash
npm run web
```
在浏览器中使用: http://localhost:3000

### 📦 打包分发
```bash
# 开发版本打包
npm run build-dev

# 正式版本打包
npm run build
```

### 🛠️ 开发调试
- **开发者工具**: 菜单 → 窗口 → 开发者工具
- **实时重载**: `npm run dev`
- **日志查看**: 控制台输出详细连接日志

## 📁 项目架构

```
spark/
├── src/                     # 核心源码
│   ├── bluetooth/          # 蓝牙管理模块
│   │   ├── bluetooth-manager.js
│   │   ├── device-scanner.js
│   │   └── heart-rate-reader.js
│   ├── websocket/          # WebSocket通信
│   │   ├── websocket-server.js
│   │   └── message-handler.js
│   ├── windows/            # 窗口管理
│   │   ├── window-manager.js
│   │   ├── heart-rate-window.js
│   │   ├── device-manager-window.js
│   │   └── heart-rate-chart-window.js
│   ├── ui/                 # UI组件
│   │   ├── tray-manager.js
│   │   └── menu-builder.js
│   ├── utils/              # 工具函数
│   │   ├── heart-rate-analyzer.js
│   │   ├── device-analyzer.js
│   │   └── icon-utils.js
│   └── config/             # 配置管理
│       ├── constants.js
│       └── settings.js
├── main.js                 # Electron主进程
├── device-manager.html     # 设备管理界面
├── device-manager.js       # 设备管理逻辑
├── heart-rate-chart.html   # 图表分析界面
├── heart-rate-chart.js     # 图表分析逻辑
├── index.html              # 心率显示界面
├── renderer.js             # 心率显示逻辑
└── server.js               # Web服务器
```

## 🛟 故障排除

### 🔍 扫描问题
- **扫描不到设备**: 检查蓝牙开启状态，确保设备可发现
- **设备列表为空**: 尝试重启蓝牙服务或重新扫描
- **Windows蓝牙问题**: 以管理员权限运行应用

### 🔗 连接问题
- **连接失败**: 确保设备未被其他应用占用
- **频繁断线**: 检查设备电量和信号强度
- **数据不显示**: 验证设备是否支持标准心率服务

### 📊 数据问题
- **心率显示为--**: 检查设备连接状态和心率传感器
- **异常检测过于敏感**: 可调整检测阈值参数
- **图表性能问题**: 大数据量时会自动优化显示

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本项目
2. 创建功能分支: `git checkout -b feature/AmazingFeature`
3. 提交更改: `git commit -m 'Add some AmazingFeature'`
4. 推送到分支: `git push origin feature/AmazingFeature`
5. 提交Pull Request

## 📄 开源协议

本项目采用 MIT 协议 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👥 开发团队

**Spark Development Team**
- 专注于健康监测技术
- 致力于提供专业的心率分析解决方案

## 📞 技术支持

遇到问题？
- 📧 **邮箱支持**: spark.heartrate@example.com
- 💬 **微信咨询**: luoyuecn（请注明来意）
- 🐛 **Bug报告**: [GitHub Issues](https://github.com/spark-team/spark-heartrate/issues)

---

<div align="center">

**❤️ 用心监测，智能分析，健康生活从心率开始！**

Made with ❤️ by Spark Development Team

</div>