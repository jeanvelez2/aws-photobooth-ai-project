import React from 'react';

interface TermsOfServiceProps {
  onAccept?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({
  onAccept,
  onDecline,
  showActions = false,
}) => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
      
      <div className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-600 mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p className="text-gray-700">
            By accessing and using the AI Photobooth service, you accept and agree to be bound 
            by the terms and provision of this agreement. If you do not agree to abide by the 
            above, please do not use this service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Service Description</h2>
          <p className="text-gray-700 mb-3">
            AI Photobooth is a web-based application that allows users to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Capture photos using their device camera</li>
            <li>Select from various themed backgrounds</li>
            <li>Process photos using AI-powered face detection and integration</li>
            <li>Download the resulting themed portraits</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Responsibilities</h2>
          <p className="text-gray-700 mb-3">
            By using our service, you agree to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Only upload photos that you own or have permission to use</li>
            <li>Not upload photos containing illegal, harmful, or offensive content</li>
            <li>Not upload photos of minors without proper consent</li>
            <li>Not attempt to reverse engineer or exploit our AI processing systems</li>
            <li>Not use the service for commercial purposes without authorization</li>
            <li>Respect the intellectual property rights of others</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Content and Intellectual Property</h2>
          <p className="text-gray-700 mb-3">
            <strong>Your Content:</strong> You retain ownership of the photos you upload. 
            By using our service, you grant us a temporary license to process your photos 
            solely for the purpose of providing the themed portrait service.
          </p>
          <p className="text-gray-700 mb-3">
            <strong>Our Content:</strong> The themed backgrounds, AI processing algorithms, 
            and service interface are our intellectual property and are protected by copyright 
            and other intellectual property laws.
          </p>
          <p className="text-gray-700">
            <strong>Generated Content:</strong> The processed images created by combining your 
            photo with our themes are considered derivative works. You may use these for 
            personal, non-commercial purposes.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Privacy and Data Handling</h2>
          <p className="text-gray-700 mb-3">
            Your privacy is important to us. Our data handling practices include:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Automatic deletion of original photos after 24 hours</li>
            <li>Automatic deletion of processed images after 7 days</li>
            <li>No permanent storage of facial recognition data</li>
            <li>Secure processing in encrypted cloud environments</li>
          </ul>
          <p className="text-gray-700 mt-3">
            For detailed information, please review our Privacy Policy.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Service Availability</h2>
          <p className="text-gray-700">
            We strive to maintain high service availability but cannot guarantee uninterrupted 
            access. The service may be temporarily unavailable due to maintenance, updates, 
            or technical issues. We are not liable for any inconvenience caused by service 
            interruptions.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Usage Limits</h2>
          <p className="text-gray-700 mb-3">
            To ensure fair usage and system stability, we implement the following limits:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Maximum file size: 10MB per image</li>
            <li>Rate limiting: 10 requests per minute per IP address</li>
            <li>Processing timeout: 15 seconds per image</li>
            <li>Supported formats: JPEG, PNG</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Prohibited Uses</h2>
          <p className="text-gray-700 mb-3">
            You may not use our service for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Creating deepfakes or misleading content</li>
            <li>Processing photos without proper consent</li>
            <li>Automated or bulk processing without authorization</li>
            <li>Any illegal or harmful activities</li>
            <li>Circumventing security measures or rate limits</li>
            <li>Reselling or redistributing our service</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimers and Limitations</h2>
          <p className="text-gray-700 mb-3">
            <strong>Service Quality:</strong> While we strive for high-quality results, 
            AI processing may not always produce perfect results. Results depend on photo 
            quality, lighting, and other factors.
          </p>
          <p className="text-gray-700 mb-3">
            <strong>Limitation of Liability:</strong> We are not liable for any direct, 
            indirect, incidental, or consequential damages arising from your use of the service.
          </p>
          <p className="text-gray-700">
            <strong>No Warranties:</strong> The service is provided "as is" without any 
            warranties, express or implied.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Account Termination</h2>
          <p className="text-gray-700">
            We reserve the right to terminate or suspend access to our service immediately, 
            without prior notice, for any reason, including breach of these Terms of Service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to Terms</h2>
          <p className="text-gray-700">
            We reserve the right to modify these terms at any time. Changes will be effective 
            immediately upon posting. Your continued use of the service after changes constitutes 
            acceptance of the new terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Governing Law</h2>
          <p className="text-gray-700">
            These terms are governed by and construed in accordance with applicable laws. 
            Any disputes arising from these terms or your use of the service will be subject 
            to the exclusive jurisdiction of the appropriate courts.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Information</h2>
          <p className="text-gray-700">
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <div className="mt-3 text-gray-700">
            <p>Email: legal@aiphotobooth.com</p>
            <p>Support: support@aiphotobooth.com</p>
          </div>
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

export default TermsOfService;