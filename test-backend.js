#!/usr/bin/env node

const http = require('http');

const testEndpoints = [
  { path: '/health', method: 'GET', description: 'Health check' },
  { path: '/api/health', method: 'GET', description: 'API health check' },
  { path: '/', method: 'POST', description: 'Root POST (should return 400)' },
  { path: '/api/process', method: 'POST', description: 'Process endpoint' },
];

const host = process.env.TEST_HOST || 'localhost';
const port = process.env.TEST_PORT || 3001;

console.log(`Testing backend at ${host}:${port}`);
console.log('=' * 50);

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Backend-Test-Script/1.0'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime: Date.now() - startTime
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        error: err.message,
        responseTime: Date.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        error: 'Request timeout',
        responseTime: 5000
      });
    });

    const startTime = Date.now();
    
    if (endpoint.method === 'POST') {
      req.write(JSON.stringify({ test: 'data' }));
    }
    
    req.end();
  });
}

async function runTests() {
  for (const endpoint of testEndpoints) {
    console.log(`\nTesting: ${endpoint.description}`);
    console.log(`${endpoint.method} ${endpoint.path}`);
    
    const result = await testEndpoint(endpoint);
    
    if (result.error) {
      console.log(`❌ ERROR: ${result.error} (${result.responseTime}ms)`);
    } else {
      const statusIcon = result.status < 400 ? '✅' : result.status < 500 ? '⚠️' : '❌';
      console.log(`${statusIcon} Status: ${result.status} (${result.responseTime}ms)`);
      
      if (result.body) {
        try {
          const parsed = JSON.parse(result.body);
          console.log(`   Response: ${JSON.stringify(parsed, null, 2).substring(0, 200)}...`);
        } catch {
          console.log(`   Response: ${result.body.substring(0, 100)}...`);
        }
      }
    }
  }
  
  console.log('\n' + '=' * 50);
  console.log('Test completed');
}

runTests().catch(console.error);