/**
 * Artillery.js Load Test Processor
 * Custom functions for generating test data and handling responses
 */

const crypto = require('crypto');

module.exports = {
  // Generate random string for test data
  randomString,
  
  // Generate random job ID
  randomJobId,
  
  // Validate health response
  validateHealthResponse,
  
  // Validate themes response
  validateThemesResponse,
  
  // Log response metrics
  logResponseMetrics,
};

/**
 * Generate a random string of specified length
 */
function randomString(context, events, done) {
  const length = 8;
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  context.vars.randomString = result;
  return done();
}

/**
 * Generate a random job ID for processing status checks
 */
function randomJobId(context, events, done) {
  const jobId = crypto.randomUUID();
  context.vars.jobId = jobId;
  return done();
}

/**
 * Validate health endpoint response
 */
function validateHealthResponse(requestParams, response, context, events, done) {
  if (response.statusCode === 200) {
    try {
      const body = JSON.parse(response.body);
      
      // Validate required fields
      if (!body.status) {
        events.emit('error', 'Health response missing status field');
      } else if (body.status !== 'healthy' && body.status !== 'ok') {
        events.emit('error', `Unexpected health status: ${body.status}`);
      }
      
      // Log successful health check
      events.emit('counter', 'health_checks.success', 1);
      
    } catch (error) {
      events.emit('error', `Invalid health response JSON: ${error.message}`);
    }
  } else {
    events.emit('counter', 'health_checks.failure', 1);
  }
  
  return done();
}

/**
 * Validate themes endpoint response
 */
function validateThemesResponse(requestParams, response, context, events, done) {
  if (response.statusCode === 200) {
    try {
      const themes = JSON.parse(response.body);
      
      // Validate response is an array
      if (!Array.isArray(themes)) {
        events.emit('error', 'Themes response is not an array');
        return done();
      }
      
      // Validate theme structure
      themes.forEach((theme, index) => {
        if (!theme.id || !theme.name || !theme.thumbnailUrl) {
          events.emit('error', `Theme ${index} missing required fields`);
        }
      });
      
      // Log theme count
      events.emit('counter', 'themes.count', themes.length);
      events.emit('counter', 'themes_requests.success', 1);
      
    } catch (error) {
      events.emit('error', `Invalid themes response JSON: ${error.message}`);
    }
  } else {
    events.emit('counter', 'themes_requests.failure', 1);
  }
  
  return done();
}

/**
 * Log response metrics for analysis
 */
function logResponseMetrics(requestParams, response, context, events, done) {
  // Log response time buckets
  const responseTime = response.timings.response;
  
  if (responseTime < 100) {
    events.emit('counter', 'response_time.under_100ms', 1);
  } else if (responseTime < 500) {
    events.emit('counter', 'response_time.100ms_to_500ms', 1);
  } else if (responseTime < 1000) {
    events.emit('counter', 'response_time.500ms_to_1s', 1);
  } else if (responseTime < 2000) {
    events.emit('counter', 'response_time.1s_to_2s', 1);
  } else {
    events.emit('counter', 'response_time.over_2s', 1);
  }
  
  // Log status code buckets
  const statusCode = response.statusCode;
  
  if (statusCode >= 200 && statusCode < 300) {
    events.emit('counter', 'status_codes.2xx', 1);
  } else if (statusCode >= 300 && statusCode < 400) {
    events.emit('counter', 'status_codes.3xx', 1);
  } else if (statusCode >= 400 && statusCode < 500) {
    events.emit('counter', 'status_codes.4xx', 1);
  } else if (statusCode >= 500) {
    events.emit('counter', 'status_codes.5xx', 1);
  }
  
  return done();
}