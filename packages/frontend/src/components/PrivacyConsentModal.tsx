import React, { useState } from 'react';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);

  if (!isOpen) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isScrolledToBottom = 
      element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    
    if (isScrolledToBottom) {
      if (activeTab === 'privacy') {
        setHasReadPrivacy(true);
      } else {
        setHasReadTerms(true);
      }
    }
  };

  const canAccept = hasReadPrivacy && hasReadTerms;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Privacy Policy & Terms of Service
          </h2>
          <p className="text-gray-600 mt-1">
            Please read and accept our privacy policy and terms of service to continue.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex-shrink-0 border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'privacy'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Privacy Policy
              {hasReadPrivacy && (
                <span className="ml-2 text-green-500">✓</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'terms'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Terms of Service
              {hasReadTerms && (
                <span className="ml-2 text-green-500">✓</span>
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          onScroll={handleScroll}
        >
          {activeTab === 'privacy' ? (
            <PrivacyPolicy />
          ) : (
            <TermsOfService />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {!canAccept && (
            <p className="text-sm text-gray-600 mb-3">
              Please scroll through both the Privacy Policy and Terms of Service to continue.
            </p>
          )}
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              <span className="flex items-center">
                <input
                  type="checkbox"
                  id="dataProcessing"
                  className="mr-2"
                  disabled={!canAccept}
                />
                <label htmlFor="dataProcessing">
                  I understand that my photos will be processed using AI and automatically deleted as described
                </label>
              </span>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onDecline}
                className="px-6 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={onAccept}
                disabled={!canAccept}
                className={`px-6 py-2 rounded-md transition-colors ${
                  canAccept
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentModal;