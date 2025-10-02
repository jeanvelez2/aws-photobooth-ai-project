/**
 * Privacy Service for handling user consent and privacy compliance
 */

export interface ConsentData {
  hasAcceptedPrivacy: boolean;
  hasAcceptedTerms: boolean;
  consentTimestamp: string;
  version: string;
}

export interface DataDeletionRequest {
  userId?: string;
  sessionId?: string;
  email?: string;
  reason: string;
}

export class PrivacyService {
  private readonly CONSENT_STORAGE_KEY = 'photobooth_consent';
  private readonly PRIVACY_VERSION = '1.0';
  private readonly API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:3001';

  /**
   * Check if user has given valid consent
   */
  hasValidConsent(): boolean {
    try {
      const stored = localStorage.getItem(this.CONSENT_STORAGE_KEY);
      if (!stored) return false;

      const consent: ConsentData = JSON.parse(stored);
      
      // Check if consent is for current version
      if (consent.version !== this.PRIVACY_VERSION) {
        this.clearConsent();
        return false;
      }

      // Check if consent is not older than 1 year
      const consentDate = new Date(consent.consentTimestamp);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (consentDate < oneYearAgo) {
        this.clearConsent();
        return false;
      }

      return consent.hasAcceptedPrivacy && consent.hasAcceptedTerms;
    } catch (error) {
      console.error('Error checking consent:', error);
      this.clearConsent();
      return false;
    }
  }

  /**
   * Store user consent
   */
  storeConsent(): void {
    const consent: ConsentData = {
      hasAcceptedPrivacy: true,
      hasAcceptedTerms: true,
      consentTimestamp: new Date().toISOString(),
      version: this.PRIVACY_VERSION,
    };

    localStorage.setItem(this.CONSENT_STORAGE_KEY, JSON.stringify(consent));
    
    // Log consent for audit purposes
    this.auditConsentAction('CONSENT_GIVEN', consent);
  }

  /**
   * Clear stored consent
   */
  clearConsent(): void {
    const existingConsent = this.getStoredConsent();
    localStorage.removeItem(this.CONSENT_STORAGE_KEY);
    
    if (existingConsent) {
      this.auditConsentAction('CONSENT_WITHDRAWN', existingConsent);
    }
  }

  /**
   * Get stored consent data
   */
  getStoredConsent(): ConsentData | null {
    try {
      const stored = localStorage.getItem(this.CONSENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting stored consent:', error);
      return null;
    }
  }

  /**
   * Request data deletion (GDPR right to be forgotten)
   */
  async requestDataDeletion(request: DataDeletionRequest): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/privacy/delete-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Data deletion request failed: ${response.statusText}`);
      }

      // Clear local consent after successful deletion request
      this.clearConsent();
      
      this.auditConsentAction('DATA_DELETION_REQUESTED', request);
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw error;
    }
  }

  /**
   * Get data retention information
   */
  async getDataRetentionInfo(): Promise<{
    uploads: string;
    processed: string;
    jobs: string;
    auditLogs: string;
  }> {
    return {
      uploads: '24 hours',
      processed: '7 days',
      jobs: '7 days',
      auditLogs: '90 days',
    };
  }

  /**
   * Check if privacy policy or terms have been updated
   */
  async checkForUpdates(): Promise<{
    privacyUpdated: boolean;
    termsUpdated: boolean;
    currentVersion: string;
  }> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/privacy/version`);
      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const data = await response.json();
      const storedConsent = this.getStoredConsent();
      
      return {
        privacyUpdated: !storedConsent || storedConsent.version !== data.version,
        termsUpdated: !storedConsent || storedConsent.version !== data.version,
        currentVersion: data.version,
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      // Assume updates are available if we can't check
      return {
        privacyUpdated: true,
        termsUpdated: true,
        currentVersion: this.PRIVACY_VERSION,
      };
    }
  }

  /**
   * Audit consent actions for compliance
   */
  private auditConsentAction(action: string, data: any): void {
    try {
      // Store audit log locally (will be sent to server if needed)
      const auditLog = {
        action,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // In a production environment, you might want to send this to your backend
      console.log('Privacy audit log:', auditLog);
      
      // Store in session storage for potential server sync
      const existingLogs = sessionStorage.getItem('privacy_audit_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(auditLog);
      
      // Keep only last 10 logs to prevent storage bloat
      if (logs.length > 10) {
        logs.splice(0, logs.length - 10);
      }
      
      sessionStorage.setItem('privacy_audit_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Error auditing consent action:', error);
    }
  }

  /**
   * Get privacy compliance status
   */
  getComplianceStatus(): {
    hasConsent: boolean;
    consentDate: string | null;
    version: string | null;
    daysUntilExpiry: number | null;
  } {
    const consent = this.getStoredConsent();
    
    if (!consent) {
      return {
        hasConsent: false,
        consentDate: null,
        version: null,
        daysUntilExpiry: null,
      };
    }

    const consentDate = new Date(consent.consentTimestamp);
    const expiryDate = new Date(consentDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      hasConsent: this.hasValidConsent(),
      consentDate: consent.consentTimestamp,
      version: consent.version,
      daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0,
    };
  }
}

// Export singleton instance
export const privacyService = new PrivacyService();