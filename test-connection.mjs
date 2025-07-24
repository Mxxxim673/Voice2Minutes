import http from 'http';

const testPorts = [3000, 5173, 8080, 8000];

async function testConnection(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
            resolve({
                port,
                status: res.statusCode,
                success: true,
                headers: res.headers
            });
        });
        
        req.on('error', (err) => {
            resolve({
                port,
                success: false,
                error: err.message
            });
        });
        
        req.setTimeout(3000, () => {
            req.destroy();
            resolve({
                port,
                success: false,
                error: 'Timeout'
            });
        });
    });
}

console.log('Testing ports...');

for (const port of testPorts) {
    const result = await testConnection(port);
    if (result.success) {
        console.log(`✅ Port ${port}: HTTP ${result.status} - Server is running!`);
        console.log(`   Access at: http://localhost:${port}/`);
        if (port === 3000) {
            console.log(`   Network:   http://192.168.1.103:${port}/`);
        }
    } else {
        console.log(`❌ Port ${port}: ${result.error}`);
    }
}

console.log('\nIf any server is running, please try accessing the URL in your browser.');
console.log('The Voice2Minutes application should be available with full AI functionality.');