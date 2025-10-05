#!/usr/bin/env node

/**
 * Production Health Monitoring Script
 * 
 * This script helps monitor the health of your AI Photobooth backend
 * and provides insights into common issues.
 */

const https = require('https');
const http = require('http');

// Configuration
const HEALTH_ENDPOINT = process.env.HEALTH_ENDPOINT || 'https://your-app-domain.com/health/detailed';
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '30000'); // 30 seconds
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '3'); // 3 consecutive failures

let consecutiveFailures = 0;
let lastHealthStatus = null;

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Check application health
 */
async function checkHealth() {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] Checking health...`);
    
    const response = await makeRequest(HEALTH_ENDPOINT);
    
    if (response.statusCode === 200) {
      consecutiveFailures = 0;
      const health = response.data;
      
      console.log(`[${timestamp}] ✅ Health check passed`);
      console.log(`  Status: ${health.status}`);
      console.log(`  Uptime: ${Math.round(health.uptime)}s`);
      
      if (health.checks) {
        health.checks.forEach(check => {
          const icon = check.status === 'healthy' ? '✅' : 
                      check.status === 'degraded' ? '⚠️' : '❌';
          console.log(`  ${icon} ${check.service}: ${check.status} (${check.responseTime}ms)`);
          
          if (check.error) {
            console.log(`    Error: ${check.error}`);
          }
        });
      }
      
      if (health.system) {
        const memUsage = health.system.memory.percentage;
        const memIcon = memUsage > 90 ? '❌' : memUsage > 80 ? '⚠️' : '✅';
        console.log(`  ${memIcon} Memory: ${memUsage}% (${Math.round(health.system.memory.used / 1024 / 1024)}MB used)`);
      }
      
      lastHealthStatus = health;
    } else {
      handleFailure(`HTTP ${response.statusCode}`, response.data);
    }
    
  } catch (error) {
    handleFailure('Request failed', error.message);
  }
  
  console.log(''); // Empty line for readability
}

/**
 * Handle health check failure
 */
function handleFailure(reason, details) {
  consecutiveFailures++;
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ❌ Health check failed (${consecutiveFailures}/${ALERT_THRESHOLD})`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Details: ${details}`);
  
  if (consecutiveFailures >= ALERT_THRESHOLD) {
    console.log(`[${timestamp}] 🚨 ALERT: ${consecutiveFailures} consecutive failures!`);
    sendAlert(reason, details);
  }
}

/**
 * Send alert (customize this for your alerting system)
 */
function sendAlert(reason, details) {
  console.log('🚨 ALERT TRIGGERED 🚨');
  console.log('Consider checking:');
  console.log('1. AWS service status');
  console.log('2. ECS task health');
  console.log('3. Database connectivity');
  console.log('4. S3 bucket permissions');
  console.log('5. Application logs in CloudWatch');
}

/**
 * Display startup information
 */
function displayStartup() {
  console.log('🔍 AI Photobooth Health Monitor');
  console.log('================================');
  console.log(`Endpoint: ${HEALTH_ENDPOINT}`);
  console.log(`Check interval: ${CHECK_INTERVAL}ms`);
  console.log(`Alert threshold: ${ALERT_THRESHOLD} failures`);
  console.log('');
  console.log('Press Ctrl+C to stop monitoring');
  console.log('');
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  displayStartup();
  
  // Initial check
  await checkHealth();
  
  // Set up interval
  const interval = setInterval(checkHealth, CHECK_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping health monitor...');
    clearInterval(interval);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n👋 Stopping health monitor...');
    clearInterval(interval);
    process.exit(0);
  });
}

// Start monitoring if run directly
if (require.main === module) {
  startMonitoring().catch(error => {
    console.error('Failed to start monitoring:', error);
    process.exit(1);
  });
}

module.exports = {
  checkHealth,
  startMonitoring
};