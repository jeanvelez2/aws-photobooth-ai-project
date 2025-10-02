import React from 'react';

interface PrivacyPolicyProps {
  onAccept?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  onAccept,
  onDecline,
  showActions = false,
}) => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      
      <div className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-600 mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
          <p className="text-gray-700 mb-3">
            When you use our AI Photobooth service, we collect and process the following information:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Photos you capture or upload through our service</li>
            <li>Facial recognition data extracted from your photos for processing purposes</li>
            <li>Technical information such as IP address, browser type, and device information</li>
            <li>Usage data including processing requests and theme selections</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <p className="text-gray-700 mb-3">
            We use your information solely for the following purposes:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Processing your photos to create themed portraits</li>
            <li>Detecting and analyzing facial features for image composition</li>
            <li>Providing technical support and improving our service</li>
            <li>Monitoring system performance and security</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Retention and Deletion</h2>
          <p className="text-gray-700 mb-3">
            We implement strict data retention policies to protect your privacy:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>Original Photos:</strong> Automatically deleted after 24 hours</li>
            <li><strong>Processed Images:</strong> Automatically deleted after 7 days</li>
            <li><strong>Facial Recognition Data:</strong> Deleted immediately after processing</li>
            <li><strong>Processing Records:</strong> Deleted after 7 days</li>
            <li><strong>Audit Logs:</strong> Retained for 90 days for security purposes</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Your Rights (GDPR Compliance)</h2>
          <p className="text-gray-700 mb-3">
            Under GDPR and other privacy laws, you have the following rights:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>Right to Access:</strong> Request information about data we hold about you</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
            <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
            <li><strong>Right to Portability:</strong> Request a copy of your data in a portable format</li>
            <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
            <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
          </ul>
          <p className="text-gray-700 mt-3">
            To exercise any of these rights, please contact us at privacy@aiphotobooth.com
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Security</h2>
          <p className="text-gray-700 mb-3">
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>All data transmission is encrypted using HTTPS/TLS</li>
            <li>Images are stored in secure AWS S3 buckets with restricted access</li>
            <li>Processing occurs in isolated, secure cloud environments</li>
            <li>Access to your data is limited to authorized personnel only</li>
            <li>Regular security audits and monitoring</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Services</h2>
          <p className="text-gray-700 mb-3">
            Our service uses the following third-party services:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>AWS Rekognition:</strong> For facial detection and analysis</li>
            <li><strong>AWS S3:</strong> For secure image storage</li>
            <li><strong>CloudFront:</strong> For content delivery</li>
          </ul>
          <p className="text-gray-700 mt-3">
            These services are bound by their own privacy policies and our data processing agreements.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. International Data Transfers</h2>
          <p className="text-gray-700">
            Your data may be processed in AWS data centers located in various regions. 
            We ensure appropriate safeguards are in place for international data transfers 
            in compliance with applicable privacy laws.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Information</h2>
          <p className="text-gray-700">
            If you have any questions about this Privacy Policy or our data practices, 
            please contact us at:
          </p>
          <div className="mt-3 text-gray-700">
            <p>Email: privacy@aiphotobooth.com</p>
            <p>Data Protection Officer: dpo@aiphotobooth.com</p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of any 
            material changes by posting the new Privacy Policy on this page and updating 
            the "Last updated" date.
          </p>
        </section>
      </div>

      {showActions && (
        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          {onDecline && (
            <button
              onClick={onDecline}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Decline
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PrivacyPolicy;