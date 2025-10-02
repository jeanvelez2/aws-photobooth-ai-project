import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders AI Photobooth application', () => {
    render(<App />);
    
    // Check if the main heading is present
    const heading = screen.getByText(/AI Photobooth/i);
    expect(heading).toBeInTheDocument();
    
    // Check if the capture page content is present
    const captureHeading = screen.getByText(/Take Your Photo/i);
    expect(captureHeading).toBeInTheDocument();
  });

  it('renders navigation steps', () => {
    render(<App />);
    
    // Check if navigation steps are present in the header
    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();
    
    // Check for step numbers which are unique to navigation
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});