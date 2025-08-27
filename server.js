const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// 静态文件服务
app.use(express.static(__dirname));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`心率显示服务运行在 http://localhost:${port}`);
    console.log('在浏览器中打开此地址，然后全屏显示(F11)即可获得类似桌面应用的效果');
});