import React, { useState, useEffect } from 'react';
import { privacyService } from '../services/privacyService';
import { DataDeletionRequestModal } from './DataDeletionRequest';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'privacy' | 'terms'>('settings');
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState<any>(null);
  const [retentionInfo, setRetentionInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadPrivacyData();
    }
  }, [isOpen]);

  const loadPrivacyData = async () => {
    try {
      const [status, retention] = await Promise.all([
        Promise.resolve(privacyService.getComplianceStatus()),
        privacyService.getDataRetentionInfo(),
      ]);
      
      setComplianceStatus(status);
      setRetentionInfo(retention);
    } catch (error) {
      console.error('Error loading privacy data:', error);
    }
  };

  const handleWithdrawConsent = () => {
    if (window.confirm('Are you sure you want to withdraw your consent? This will prevent you from using the service.')) {
      privacyService.clearConsent();
      onClose();
      // Redirect or refresh the page
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Privacy Settings</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex-shrink-0 border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'privacy'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Privacy Policy
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
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Consent Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Consent Status</h3>
                  {complianceStatus && (
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          complianceStatus.hasConsent 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {complianceStatus.hasConsent ? 'Consent Given' : 'No Consent'}
                        </span>
                      </div>
                      {complianceStatus.consentDate && (
                        <p className="text-sm text-gray-600">
                          Consent given on: {new Date(complianceStatus.consentDate).toLocaleDateString()}
                        </p>
                      )}
                      {complianceStatus.daysUntilExpiry && (
                        <p className="text-sm text-gray-600">
                          Expires in: {complianceStatus.daysUntilExpiry} days
                        </p>
                      )}
                      {complianceStatus.version && (
                        <p className="text-sm text-gray-600">
                          Policy version: {complianceStatus.version}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Data Retention Information */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Retention</h3>
                  {retentionInfo && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Uploaded Photos</p>
                        <p className="text-sm text-gray-600">{retentionInfo.uploads}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Processed Images</p>
                        <p className="text-sm text-gray-600">{retentionInfo.processed}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Processing Jobs</p>
                        <p className="text-sm text-gray-600">{retentionInfo.jobs}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Audit Logs</p>
                        <p className="text-sm text-gray-600">{retentionInfo.auditLogs}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Your Rights */}
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Rights (GDPR)</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="font-medium mr-2">•</span>
                      <span><strong>Right to Access:</strong> Request information about data we hold about you</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">•</span>
                      <span><strong>Right to Erasure:</strong> Request deletion of your personal data</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">•</span>
                      <span><strong>Right to Portability:</strong> Request a copy of your data</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">•</span>
                      <span><strong>Right to Object:</strong> Object to processing of your data</span>
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowDeletionModal(true)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Request Data Deletion
                  </button>
                  
                  <button
                    onClick={handleWithdrawConsent}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Withdraw Consent
                  </button>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Us</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Privacy questions: privacy@aiphotobooth.com</p>
                    <p>Data Protection Officer: dpo@aiphotobooth.com</p>
                    <p>General support: support@aiphotobooth.com</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && <PrivacyPolicy />}
            {activeTab === 'terms' && <TermsOfService />}
          </div>
        </div>
      </div>

      <DataDeletionRequestModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
      />
    </>
  );
};

export default PrivacySettings;