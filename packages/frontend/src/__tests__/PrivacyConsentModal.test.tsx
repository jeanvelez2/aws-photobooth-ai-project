import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrivacyConsentModal } from '../components/PrivacyConsentModal';

// Mock the child components
vi.mock('../components/PrivacyPolicy', () => ({
  PrivacyPolicy: () => <div data-testid="privacy-policy">Privacy Policy Content</div>,
}));

vi.mock('../components/TermsOfService', () => ({
  TermsOfService: () => <div data-testid="terms-of-service">Terms of Service Content</div>,
}));

describe('PrivacyConsentModal', () => {
  const defaultProps = {
    isOpen: true,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<PrivacyConsentModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Privacy Policy & Terms of Service')).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    expect(screen.getByText('Privacy Policy & Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Please read and accept our privacy policy and terms of service to continue.')).toBeInTheDocument();
  });

  it('should show privacy policy by default', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    expect(screen.getByTestId('privacy-policy')).toBeInTheDocument();
    expect(screen.queryByTestId('terms-of-service')).not.toBeInTheDocument();
  });

  it('should switch to terms of service when tab is clicked', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Terms of Service'));
    
    expect(screen.getByTestId('terms-of-service')).toBeInTheDocument();
    expect(screen.queryByTestId('privacy-policy')).not.toBeInTheDocument();
  });

  it('should disable accept button initially', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    const acceptButton = screen.getByText('Accept & Continue');
    expect(acceptButton).toBeDisabled();
  });

  it('should show checkmarks when content is read', async () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    // Simulate scrolling to bottom of privacy policy
    const contentDiv = screen.getByText('Privacy Policy Content').closest('.overflow-y-auto');
    
    // Mock scrollHeight and clientHeight to simulate scroll to bottom
    Object.defineProperty(contentDiv, 'scrollHeight', { value: 1000 });
    Object.defineProperty(contentDiv, 'clientHeight', { value: 500 });
    Object.defineProperty(contentDiv, 'scrollTop', { value: 500 });
    
    fireEvent.scroll(contentDiv!);
    
    await waitFor(() => {
      const privacyTab = screen.getByText('Privacy Policy').closest('button');
      expect(privacyTab).toHaveTextContent('✓');
    });
  });

  it('should enable accept button when both documents are read', async () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    const contentDiv = screen.getByText('Privacy Policy Content').closest('.overflow-y-auto');
    
    // Simulate reading privacy policy
    Object.defineProperty(contentDiv, 'scrollHeight', { value: 1000 });
    Object.defineProperty(contentDiv, 'clientHeight', { value: 500 });
    Object.defineProperty(contentDiv, 'scrollTop', { value: 500 });
    fireEvent.scroll(contentDiv!);
    
    // Switch to terms and simulate reading
    fireEvent.click(screen.getByText('Terms of Service'));
    
    const termsContentDiv = screen.getByText('Terms of Service Content').closest('.overflow-y-auto');
    Object.defineProperty(termsContentDiv, 'scrollHeight', { value: 1000 });
    Object.defineProperty(termsContentDiv, 'clientHeight', { value: 500 });
    Object.defineProperty(termsContentDiv, 'scrollTop', { value: 500 });
    fireEvent.scroll(termsContentDiv!);
    
    await waitFor(() => {
      const acceptButton = screen.getByText('Accept & Continue');
      expect(acceptButton).not.toBeDisabled();
    });
  });

  it('should call onAccept when accept button is clicked', async () => {
    const onAccept = vi.fn();
    render(<PrivacyConsentModal {...defaultProps} onAccept={onAccept} />);
    
    // Simulate reading both documents
    const contentDiv = screen.getByText('Privacy Policy Content').closest('.overflow-y-auto');
    Object.defineProperty(contentDiv, 'scrollHeight', { value: 1000 });
    Object.defineProperty(contentDiv, 'clientHeight', { value: 500 });
    Object.defineProperty(contentDiv, 'scrollTop', { value: 500 });
    fireEvent.scroll(contentDiv!);
    
    fireEvent.click(screen.getByText('Terms of Service'));
    
    const termsContentDiv = screen.getByText('Terms of Service Content').closest('.overflow-y-auto');
    Object.defineProperty(termsContentDiv, 'scrollHeight', { value: 1000 });
    Object.defineProperty(termsContentDiv, 'clientHeight', { value: 500 });
    Object.defineProperty(termsContentDiv, 'scrollTop', { value: 500 });
    fireEvent.scroll(termsContentDiv!);
    
    await waitFor(() => {
      const acceptButton = screen.getByText('Accept & Continue');
      expect(acceptButton).not.toBeDisabled();
    });
    
    fireEvent.click(screen.getByText('Accept & Continue'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('should call onDecline when decline button is clicked', () => {
    const onDecline = vi.fn();
    render(<PrivacyConsentModal {...defaultProps} onDecline={onDecline} />);
    
    fireEvent.click(screen.getByText('Decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('should show instruction text when documents are not read', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    expect(screen.getByText('Please scroll through both the Privacy Policy and Terms of Service to continue.')).toBeInTheDocument();
  });

  it('should have data processing checkbox', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    const checkbox = screen.getByLabelText('I understand that my photos will be processed using AI and automatically deleted as described');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeDisabled(); // Should be disabled until documents are read
  });

  it('should handle tab navigation with keyboard', () => {
    render(<PrivacyConsentModal {...defaultProps} />);
    
    const privacyTab = screen.getByText('Privacy Policy').closest('button');
    const termsTab = screen.getByText('Terms of Service').closest('button');
    
    expect(privacyTab).toHaveClass('border-blue-500', 'text-blue-600');
    expect(termsTab).toHaveClass('border-transparent', 'text-gray-500');
    
    fireEvent.click(termsTab!);
    
    expect(termsTab).toHaveClass('border-blue-500', 'text-blue-600');
    expect(privacyTab).toHaveClass('border-transparent', 'text-gray-500');
  });
});