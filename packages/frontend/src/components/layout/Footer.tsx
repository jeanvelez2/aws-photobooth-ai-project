import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>&copy; 2024 AI Photobooth</span>
            <span>•</span>
            <button className="hover:text-gray-700 transition-colors">
              Privacy Policy
            </button>
            <span>•</span>
            <button className="hover:text-gray-700 transition-colors">
              Terms of Service
            </button>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Powered by AI</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}