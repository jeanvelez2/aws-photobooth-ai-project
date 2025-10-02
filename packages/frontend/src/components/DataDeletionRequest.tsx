import React, { useState } from 'react';
import { privacyService, DataDeletionRequest } from '../services/privacyService';

interface DataDeletionRequestProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataDeletionRequestModal: React.FC<DataDeletionRequestProps> = ({
  isOpen,
  onClose,
}) => {
  const [formData, setFormData] = useState<Partial<DataDeletionRequest>>({
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reason?.trim()) {
      setErrorMessage('Please provide a reason for the data deletion request.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await privacyService.requestDataDeletion({
        userId: formData.userId,
        email: formData.email,
        reason: formData.reason,
      });

      setSubmitStatus('success');
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
        resetForm();
      }, 3000);
    } catch (error) {
      console.error('Error submitting data deletion request:', error);
      setSubmitStatus('error');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'Failed to submit data deletion request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ reason: '' });
    setSubmitStatus('idle');
    setErrorMessage('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Request Data Deletion
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Submit a request to delete your personal data (GDPR Right to be Forgotten)
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {submitStatus === 'success' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Request Submitted</h3>
              <p className="text-sm text-gray-600">
                Your data deletion request has been submitted successfully. 
                We will process it within 30 days as required by GDPR.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your.email@example.com"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Provide your email if you want confirmation of the deletion
                  </p>
                </div>

                <div>
                  <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                    User ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="userId"
                    value={formData.userId || ''}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="If you have a user ID"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Deletion <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reason"
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Please explain why you want your data deleted..."
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will permanently delete all your data including:
                  </p>
                  <ul className="text-sm text-blue-700 mt-1 ml-4 list-disc">
                    <li>Uploaded photos</li>
                    <li>Processed images</li>
                    <li>Processing history</li>
                    <li>Any associated metadata</li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.reason?.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default DataDeletionRequestModal;