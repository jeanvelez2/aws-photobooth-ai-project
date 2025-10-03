// Environment configuration with runtime detection
export const getApiUrl = (): string => {
  // In production, the API URL is served through the same CloudFront distribution
  if (import.meta.env.PROD) {
    return `${window.location.origin}/api`;
  }
  
  // In development, use environment variable or fallback
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
};

export const config = {
  apiUrl: getApiUrl(),
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableDebug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  environment: import.meta.env.MODE,
};