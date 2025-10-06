/**
 * Connection Diagnostic Component
 * Helps users diagnose connection issues and provides recovery options
 */

import React, { useState, useEffect } from 'react';
import { processingService } from '../services/processingService';

interface ConnectionDiagnosticProps {
  onConnectionRestored?: () => void;
  className?: string;
}

interface DiagnosticResult {
  test: string;
  status: 'checking' | 'passed' | 'failed';
  message: string;
}

export default function ConnectionDiagnostic({ 
  onConnectionRestored, 
  className = '' 
}: ConnectionDiagnosticProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');

  const diagnosticTests = [
    {
      name: 'Internet Connection',
      test: async () => {
        try {
          const response = await fetch('https://www.google.com/favicon.ico', { 
            method: 'HEAD',
            mode: 'no-cors',
            signal: AbortSignal.timeout(5000)
          });
          return { passed: true, message: 'Internet connection is working' };
        } catch {
          return { passed: false, message: 'No internet connection detected' };
        }
      }
    },
    {
      name: 'Backend Service',
      test: async () => {
        const isAvailable = await processingService.testConnection();
        return {
          passed: isAvailable,
          message: isAvailable 
            ? 'Backend service is responding' 
            : 'Backend service is not responding'
        };
      }
    },
    {
      name: 'API Endpoint',
      test: async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          });
          return {
            passed: response.ok,
            message: response.ok 
              ? `API is healthy (${response.status})` 
              : `API returned error (${response.status})`
          };
        } catch (error) {
          return {
            passed: false,
            message: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
    }
  ];

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    setOverallStatus('checking');

    const newResults: DiagnosticResult[] = [];

    for (const diagnostic of diagnosticTests) {
      // Add checking state
      const checkingResult: DiagnosticResult = {
        test: diagnostic.name,
        status: 'checking',
        message: 'Running test...'
      };
      newResults.push(checkingResult);
      setResults([...newResults]);

      try {
        const result = await diagnostic.test();
        // Update with actual result
        newResults[newResults.length - 1] = {
          test: diagnostic.name,
          status: result.passed ? 'passed' : 'failed',
          message: result.message
        };
        setResults([...newResults]);
      } catch (error) {
        newResults[newResults.length - 1] = {
          test: diagnostic.name,
          status: 'failed',
          message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        setResults([...newResults]);
      }

      // Small delay between tests for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Determine overall status
    const allPassed = newResults.every(r => r.status === 'passed');
    const anyPassed = newResults.some(r => r.status === 'passed');
    
    setOverallStatus(allPassed ? 'healthy' : anyPassed ? 'unhealthy' : 'unhealthy');
    setIsRunning(false);

    // If backend is healthy, notify parent
    const backendTest = newResults.find(r => r.test === 'Backend Service');
    if (backendTest?.status === 'passed') {
      onConnectionRestored?.();
    }
  };

  useEffect(() => {
    // Run diagnostics on mount
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        );
      case 'passed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getOverallStatusColor = () => {
    switch (overallStatus) {
      case 'checking':
        return 'border-blue-200 bg-blue-50';
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'unhealthy':
        return 'border-red-200 bg-red-50';
    }
  };

  const getOverallStatusText = () => {
    switch (overallStatus) {
      case 'checking':
        return 'Running diagnostics...';
      case 'healthy':
        return 'All systems operational';
      case 'unhealthy':
        return 'Issues detected';
    }
  };

  return (
    <div className={`${className}`}>
      <div className={`border rounded-lg p-6 ${getOverallStatusColor()}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Connection Diagnostics
          </h3>
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? 'Running...' : 'Run Again'}
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center">
            {overallStatus === 'checking' && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent mr-2"></div>
            )}
            <span className={`font-medium ${
              overallStatus === 'healthy' ? 'text-green-800' :
              overallStatus === 'unhealthy' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {getOverallStatusText()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white bg-opacity-50 rounded-lg">
              <div className="flex items-center">
                <div className="mr-3">
                  {getStatusIcon(result.status)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{result.test}</div>
                  <div className={`text-sm ${
                    result.status === 'passed' ? 'text-green-700' :
                    result.status === 'failed' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    {result.message}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {overallStatus === 'unhealthy' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800 mb-1">
                  Troubleshooting Tips
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Check your internet connection</li>
                  <li>• Try refreshing the page</li>
                  <li>• Wait a few minutes and try again</li>
                  <li>• Contact support if the issue persists</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}