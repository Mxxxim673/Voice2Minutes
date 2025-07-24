const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
  
  // Security check - prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, 'dist'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // If file not found and it's a route (no extension), serve index.html for SPA
        if (!extname) {
          fs.readFile(path.join(__dirname, 'dist', 'index.html'), (error, content) => {
            if (error) {
              res.writeHead(500);
              res.end('Sorry, there was an error: ' + error.code + ' ..\n');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          });
        } else {
          res.writeHead(404);
          res.end('File not found: ' + req.url);
        }
      } else {
        res.writeHead(500);
        res.end('Sorry, there was an error: ' + error.code + ' ..\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🎤 Voice2Minutes Server Started Successfully!');
  console.log('='.repeat(60));
  console.log(`📱 Local:    http://localhost:${PORT}/`);
  console.log(`🌐 Network:  http://192.168.1.103:${PORT}/`);
  console.log('='.repeat(60));
  console.log('✅ Server is ready! You can now access the application.');
  console.log('='.repeat(60));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    server.listen(PORT + 1, '0.0.0.0');
  } else {
    console.error('Server error:', err);
  }
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully.');
    process.exit(0);
  });
});

console.log('🚀 Starting Voice2Minutes server...');