import http from 'http';

const PORT = 9999;

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*'
  });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Server - Voice2Minutes</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: linear-gradient(135deg, #007AFF, #34C759);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 { font-size: 3em; margin: 0 0 20px 0; }
        p { font-size: 1.2em; margin: 10px 0; }
        .success { background: #34C759; padding: 10px 20px; border-radius: 10px; display: inline-block; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎤 Voice2Minutes</h1>
        <div class="success">✅ 服务器连接成功！</div>
        <p><strong>测试服务器正在运行</strong></p>
        <p>时间: ${new Date().toLocaleString('zh-CN')}</p>
        <p>端口: ${PORT}</p>
        <p>如果您能看到这个页面，说明网络连接正常！</p>
        <p><a href="#" onclick="location.reload()" style="color: #FFD700;">🔄 刷新页面</a></p>
    </div>
    <script>
        console.log('Voice2Minutes 测试服务器已加载');
        setInterval(() => {
            document.querySelector('p:nth-of-type(2)').innerHTML = '时间: ' + new Date().toLocaleString('zh-CN');
        }, 1000);
    </script>
</body>
</html>`;
  
  res.end(html);
});

server.listen(PORT, 'localhost', () => {
  console.log('\n' + '='.repeat(50));
  console.log('🎤 Voice2Minutes 测试服务器启动成功！');
  console.log('='.repeat(50));
  console.log(`📱 访问地址: http://localhost:${PORT}/`);
  console.log('='.repeat(50));
  console.log('等待连接...\n');
});

server.on('error', (err) => {
  console.error('服务器错误:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 被占用，请尝试其他端口`);
  }
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});