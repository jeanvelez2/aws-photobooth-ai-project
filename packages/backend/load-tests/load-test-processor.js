/**
 * Artillery Load Test Processor
 * Custom functions and hooks for load testing
 */

import { randomBytes } from 'crypto';

/**
 * Generate random string for test data
 */
function randomString(length = 8) {
  return randomBytes(length).toString('hex');
}

/**
 * Generate random theme ID from available themes
 */
function randomThemeId() {
  const themes = ['barbarian', 'greek', 'mystic', 'anime'];
  return themes[Math.floor(Math.random() * themes.length)];
}

/**
 * Generate random output format
 */
function randomOutputFormat() {
  const formats = ['jpeg', 'png'];
  return formats[Math.floor(Math.random() * formats.length)];
}

/**
 * Before scenario hook - set up test data
 */
function beforeScenario(context, events, done) {
  // Add random data to context
  context.vars.randomId = randomString();
  context.vars.themeId = randomThemeId();
  context.vars.outputFormat = randomOutputFormat();
  context.vars.timestamp = Date.now();
  
  return done();
}

/**
 * After response hook - collect custom metrics
 */
function afterResponse(requestParams, response, context, events, done) {
  // Track processing time for processing endpoints
  if (requestParams.url && requestParams.url.includes('/api/process')) {
    const processingTime = response.timings?.end || 0;
    events.emit('counter', 'processing_requests', 1);
    events.emit('histogram', 'processing_time', processingTime);
  }
  
  // Track error rates
  if (response.statusCode >= 400) {
    events.emit('counter', 'error_responses', 1);
    events.emit('rate', 'error_rate');
  }
  
  // Track queue depth (simulated)
  if (response.headers && response.headers['x-queue-depth']) {
    events.emit('gauge', 'queue_depth', parseInt(response.headers['x-queue-depth']));
  }
  
  return done();
}

/**
 * Custom think time based on user behavior
 */
function customThinkTime(context, events, done) {
  // Simulate realistic user behavior
  const thinkTime = Math.random() * 3000 + 1000; // 1-4 seconds
  setTimeout(done, thinkTime);
}

/**
 * Validate processing response
 */
function validateProcessingResponse(response, context, events, done) {
  const body = JSON.parse(response.body);
  
  if (!body.jobId) {
    events.emit('counter', 'validation_errors', 1);
    return done(new Error('Missing jobId in processing response'));
  }
  
  if (!['queued', 'processing', 'completed', 'failed'].includes(body.status)) {
    events.emit('counter', 'validation_errors', 1);
    return done(new Error('Invalid status in processing response'));
  }
  
  events.emit('counter', 'validation_success', 1);
  return done();
}

/**
 * Generate realistic image upload payload
 */
function generateImagePayload(context, events, done) {
  const payload = {
    filename: `test-image-${context.vars.randomId}.jpg`,
    contentType: 'image/jpeg',
    size: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
  };
  
  context.vars.uploadPayload = payload;
  return done();
}

/**
 * Simulate processing delay
 */
function simulateProcessingDelay(context, events, done) {
  // Simulate realistic processing time
  const delay = Math.random() * 8000 + 2000; // 2-10 seconds
  setTimeout(done, delay);
}

/**
 * Track concurrent users
 */
let concurrentUsers = 0;

function trackConcurrentUsers(context, events, done) {
  concurrentUsers++;
  events.emit('gauge', 'concurrent_users', concurrentUsers);
  
  // Decrease counter after scenario
  setTimeout(() => {
    concurrentUsers--;
    events.emit('gauge', 'concurrent_users', concurrentUsers);
  }, 30000); // Assume 30 second average scenario duration
  
  return done();
}

/**
 * Performance monitoring
 */
function monitorPerformance(context, events, done) {
  // Simulate system metrics
  const cpuUsage = Math.random() * 100;
  const memoryUsage = Math.random() * 100;
  
  events.emit('gauge', 'cpu_usage', cpuUsage);
  events.emit('gauge', 'memory_usage', memoryUsage);
  
  // Alert on high resource usage
  if (cpuUsage > 80) {
    events.emit('counter', 'high_cpu_alerts', 1);
  }
  
  if (memoryUsage > 85) {
    events.emit('counter', 'high_memory_alerts', 1);
  }
  
  return done();
}

// Export functions for Artillery
export {
  randomString,
  randomThemeId,
  randomOutputFormat,
  beforeScenario,
  afterResponse,
  customThinkTime,
  validateProcessingResponse,
  generateImagePayload,
  simulateProcessingDelay,
  trackConcurrentUsers,
  monitorPerformance,
};