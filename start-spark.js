#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 设置环境变量来自定义应用名称
process.env.ELECTRON_APP_NAME = 'Spark';

// 启动 Electron 应用
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const mainScript = path.join(__dirname, 'main.js');

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_APP_NAME: 'Spark'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});