// Quick backend health check
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3001/api';

async function checkBackend() {
  try {
    console.log('Checking backend health at:', API_BASE);
    
    // Basic health check
    const healthResponse = await fetch(`${API_BASE}/health`);
    console.log('Health status:', healthResponse.status);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('Health data:', health);
    }
    
    // Detailed health check
    const detailedResponse = await fetch(`${API_BASE}/health/detailed`);
    console.log('Detailed health status:', detailedResponse.status);
    if (detailedResponse.ok) {
      const detailed = await detailedResponse.json();
      console.log('Detailed health:', JSON.stringify(detailed, null, 2));
    }
    
  } catch (error) {
    console.error('Backend check failed:', error);
  }
}

checkBackend();