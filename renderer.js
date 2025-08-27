let ws;
let heartRateElement = document.getElementById('heartRate');
let statusElement = document.getElementById('status');
let isConnected = false;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        statusElement.textContent = '已连接';
        statusElement.className = 'status';
        isConnected = true;
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'heartRate') {
                heartRateElement.textContent = data.value;
                heartRateElement.className = 'heart-rate';
                
                // 更新心跳动画频率
                updateHeartAnimation(data.value);
            }
        } catch (error) {
            console.error('解析数据错误:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        statusElement.textContent = '连接断开';
        statusElement.className = 'status offline';
        heartRateElement.textContent = '--';
        heartRateElement.className = 'heart-rate offline';
        isConnected = false;
        
        // 3秒后重连
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        statusElement.textContent = '连接错误';
        statusElement.className = 'status offline';
    };
}

function updateHeartAnimation(bpm) {
    const heartIcon = document.querySelector('.heart-icon');
    if (bpm > 0) {
        const duration = 60 / bpm; // 根据心率调整动画速度
        heartIcon.style.animationDuration = `${duration}s`;
    }
}

// 启动WebSocket连接
connectWebSocket();

// 窗口拖拽功能
let isDragging = false;
let startX, startY;

document.addEventListener('mousedown', (e) => {
    if (e.target === document.body || e.target.closest('.heart-rate-container')) {
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.screenX - startX;
        const deltaY = e.screenY - startY;
        
        // 通知主进程移动窗口
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('move-window', {
            deltaX: deltaX,
            deltaY: deltaY
        });
        
        startX = e.screenX;
        startY = e.screenY;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'move';
    }
});

// 添加全屏提示
window.addEventListener('load', () => {
    setTimeout(() => {
        console.log('提示: 按F11进入全屏模式获得更好的桌面显示效果！');
    }, 2000);
});