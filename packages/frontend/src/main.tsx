import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { registerServiceWorker } from './utils/serviceWorker.ts';
import { performanceMonitor } from './utils/performanceMonitor.ts';
import './index.css';

// Initialize performance monitoring
const appStartTime = Date.now();

// Register service worker for offline functionality
registerServiceWorker({
  onSuccess: () => {
    console.log('Service worker registered successfully');
  },
  onUpdate: () => {
    console.log('New content available, please refresh');
    // Could show a toast notification here
  },
  onOffline: () => {
    console.log('App is now offline');
    // Could show offline indicator
  },
  onOnline: () => {
    console.log('App is back online');
    // Could hide offline indicator
  }
});

// Measure app initialization time
window.addEventListener('load', () => {
  const initTime = Date.now() - appStartTime;
  console.log(`App initialized in ${initTime}ms`);
  
  // Generate initial performance report
  setTimeout(() => {
    const report = performanceMonitor.generateReport();
    console.log('Initial Performance Report:', JSON.parse(report));
  }, 1000);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
