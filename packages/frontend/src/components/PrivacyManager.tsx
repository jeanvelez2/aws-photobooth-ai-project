import React, { useState, useEffect } from 'react';
import { privacyService } from '../services/privacyService';
import { PrivacyConsentModal } from './PrivacyConsentModal';

interface PrivacyManagerProps {
  children: React.ReactNode;
}

export const PrivacyManager: React.FC<PrivacyManagerProps> = ({ children }) => {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      setIsLoading(true);
      
      // Check if user has valid consent
      const hasConsent = privacyService.hasValidConsent();
      
      if (!hasConsent) {
        // Check if privacy policy or terms have been updated
        const updates = await privacyService.checkForUpdates();
        
        if (updates.privacyUpdated || updates.termsUpdated) {
          setShowConsentModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking consent status:', error);
      // Show consent modal on error to be safe
      setShowConsentModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptConsent = () => {
    try {
      privacyService.storeConsent();
      setShowConsentModal(false);
    } catch (error) {
      console.error('Error storing consent:', error);
      // Could show an error message to user here
    }
  };

  const handleDeclineConsent = () => {
    // Redirect to a different page or show information about why consent is needed
    window.location.href = 'https://example.com/privacy-required';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <PrivacyConsentModal
        isOpen={showConsentModal}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
      />
    </>
  );
};

export default PrivacyManager;