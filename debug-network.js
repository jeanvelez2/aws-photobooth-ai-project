// Debug script to test network requests directly
// Run this in browser console on the photobooth page

console.log('=== NETWORK DEBUG ===');

// Test 1: Simple fetch to health endpoint
fetch('https://d1sb1uvkfiy4hq.cloudfront.net/api/health')
  .then(response => {
    console.log('Health check response:', response.status, response.statusText);
    return response.json();
  })
  .then(data => console.log('Health data:', data))
  .catch(error => console.error('Health error:', error));

// Test 2: Test process endpoint with minimal data
fetch('https://d1sb1uvkfiy4hq.cloudfront.net/api/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    photoId: 'test123',
    themeId: 'barbarian',
    originalImageUrl: 'https://example.com/test.jpg'
  })
})
  .then(response => {
    console.log('Process response:', response.status, response.statusText);
    return response.text();
  })
  .then(data => console.log('Process data:', data))
  .catch(error => console.error('Process error:', error));

// Test 3: Check CORS headers
fetch('https://d1sb1uvkfiy4hq.cloudfront.net/api/health', {
  method: 'OPTIONS'
})
  .then(response => {
    console.log('CORS preflight:', response.status);
    console.log('CORS headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    });
  })
  .catch(error => console.error('CORS error:', error));