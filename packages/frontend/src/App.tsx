import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AppProvider } from './contexts/AppContext';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load pages for code splitting
const CapturePage = React.lazy(() => import('./pages/CapturePage'));
const ThemeSelectionPage = React.lazy(() => import('./pages/ThemeSelectionPage'));
const ProcessingPage = React.lazy(() => import('./pages/ProcessingPage'));
const ResultPage = React.lazy(() => import('./pages/ResultPage'));

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <Router>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<CapturePage />} />
                  <Route path="themes" element={<ThemeSelectionPage />} />
                  <Route path="process" element={<ProcessingPage />} />
                  <Route path="result" element={<ResultPage />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
