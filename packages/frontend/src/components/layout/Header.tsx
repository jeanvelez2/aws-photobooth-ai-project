import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUIState } from '../../contexts/AppContext';

export default function Header() {
  const location = useLocation();
  const { currentStep } = useUIState();

  const getStepNumber = (step: string) => {
    switch (step) {
      case 'capture': return 1;
      case 'theme-selection': return 2;
      case 'processing': return 3;
      case 'result': return 4;
      default: return 1;
    }
  };

  const steps = [
    { key: 'capture', label: 'Capture', path: '/' },
    { key: 'theme-selection', label: 'Theme', path: '/themes' },
    { key: 'processing', label: 'Process', path: '/process' },
    { key: 'result', label: 'Result', path: '/result' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Photobooth</h1>
            </div>
          </Link>

          {/* Progress Steps */}
          <nav className="hidden md:flex items-center space-x-8">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const currentStepNumber = getStepNumber(currentStep);
              const isActive = stepNumber === currentStepNumber;
              const isCompleted = stepNumber < currentStepNumber;
              const isAccessible = stepNumber <= currentStepNumber;

              return (
                <div key={step.key} className="flex items-center">
                  {index > 0 && (
                    <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                  <div className="flex items-center space-x-2 ml-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {isCompleted ? '✓' : stepNumber}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? 'text-purple-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Mobile menu button - placeholder for future implementation */}
          <button className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
            <span className="sr-only">Open menu</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}