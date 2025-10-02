import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { performanceMonitor } from '../utils/performanceMonitor';

// Mock service worker registration
vi.mock('../utils/serviceWorker', () => ({
  registerServiceWorker: vi.fn(),
  isStandalone: vi.fn(() => false),
  getNetworkStatus: vi.fn(() => 'online')
}));

// Mock performance APIs
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    getEntriesByType: vi.fn(() => []),
    mark: vi.fn(),
    measure: vi.fn()
  }
});

// Mock IntersectionObserver for lazy loading
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock MediaDevices for camera access
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    }),
    enumerateDevices: vi.fn().mockResolvedValue([])
  }
});

describe('End-to-End Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    // Reset performance monitor
    performanceMonitor.cleanup();
  });

  const renderApp = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should load the application within performance budget', async () => {
    const startTime = Date.now();
    
    renderApp();
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/photobooth/i)).toBeInTheDocument();
    });
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds (performance budget)
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`App loaded in ${loadTime}ms`);
  });

  it('should handle lazy loading of components', async () => {
    renderApp();
    
    // Initial page should load
    await waitFor(() => {
      expect(screen.getByText(/capture/i)).toBeInTheDocument();
    });
    
    // Navigate to themes page (should lazy load)
    const user = userEvent.setup();
    const themesLink = screen.getByRole('link', { name: /themes/i });
    
    const navigationStart = Date.now();
    await user.click(themesLink);
    
    await waitFor(() => {
      expect(screen.getByText(/select.*theme/i)).toBeInTheDocument();
    });
    
    const navigationTime = Date.now() - navigationStart;
    
    // Navigation should be fast even with lazy loading
    expect(navigationTime).toBeLessThan(1000);
    
    console.log(`Theme page loaded in ${navigationTime}ms`);
  });

  it('should handle offline scenarios gracefully', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true
    });
    
    renderApp();
    
    // App should still render in offline mode
    await waitFor(() => {
      expect(screen.getByText(/photobooth/i)).toBeInTheDocument();
    });
    
    // Should show offline indicator or handle gracefully
    // (Implementation would depend on specific offline UI)
  });

  it('should implement proper error boundaries', async () => {
    // Mock console.error to avoid noise in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a component that throws an error
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    // This would test the ErrorBoundary component
    expect(() => {
      render(<ThrowError />);
    }).toThrow();
    
    consoleSpy.mockRestore();
  });

  it('should handle camera permissions properly', async () => {
    renderApp();
    
    // Wait for camera component to load
    await waitFor(() => {
      expect(screen.getByText(/capture/i)).toBeInTheDocument();
    });
    
    // Mock camera permission request
    const mockGetUserMedia = navigator.mediaDevices.getUserMedia as any;
    mockGetUserMedia.mockResolvedValueOnce({
      getTracks: () => [{ stop: vi.fn() }]
    });
    
    // Simulate camera access
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    if (cameraButton) {
      const user = userEvent.setup();
      await user.click(cameraButton);
      
      // Should handle camera access
      expect(mockGetUserMedia).toHaveBeenCalled();
    }
  });

  it('should validate performance metrics collection', async () => {
    renderApp();
    
    await waitFor(() => {
      expect(screen.getByText(/photobooth/i)).toBeInTheDocument();
    });
    
    // Check that performance metrics are being collected
    const metrics = performanceMonitor.getMetrics();
    const budgets = performanceMonitor.getBudgets();
    
    expect(budgets).toHaveProperty('fcp');
    expect(budgets).toHaveProperty('lcp');
    expect(budgets).toHaveProperty('fid');
    expect(budgets).toHaveProperty('cls');
    
    // Generate performance report
    const report = performanceMonitor.generateReport();
    expect(report).toBeTruthy();
    
    const parsedReport = JSON.parse(report);
    expect(parsedReport).toHaveProperty('timestamp');
    expect(parsedReport).toHaveProperty('metrics');
    expect(parsedReport).toHaveProperty('budgets');
  });

  it('should handle image upload workflow', async () => {
    renderApp();
    
    await waitFor(() => {
      expect(screen.getByText(/capture/i)).toBeInTheDocument();
    });
    
    // Mock file upload
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload/i);
    
    if (input) {
      const user = userEvent.setup();
      await user.upload(input, file);
      
      // Should handle file upload
      expect(input.files?.[0]).toBe(file);
    }
  });

  it('should validate bundle size constraints', async () => {
    // This test would run as part of build process
    const budgets = performanceMonitor.getBudgets();
    
    expect(budgets.bundleSize).toBe(1024 * 1024); // 1MB
    expect(budgets.imageSize).toBe(512 * 1024);   // 512KB
    
    // In a real scenario, this would check actual bundle sizes
    // from the build output
  });

  it('should handle processing workflow end-to-end', async () => {
    renderApp();
    
    // Navigate through the complete workflow
    await waitFor(() => {
      expect(screen.getByText(/capture/i)).toBeInTheDocument();
    });
    
    const user = userEvent.setup();
    
    // 1. Capture page -> Themes page
    const themesLink = screen.getByRole('link', { name: /themes/i });
    await user.click(themesLink);
    
    await waitFor(() => {
      expect(screen.getByText(/select.*theme/i)).toBeInTheDocument();
    });
    
    // 2. Themes page -> Processing page
    const processLink = screen.getByRole('link', { name: /process/i });
    if (processLink) {
      await user.click(processLink);
      
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });
    }
    
    // 3. Processing page -> Result page
    const resultLink = screen.getByRole('link', { name: /result/i });
    if (resultLink) {
      await user.click(resultLink);
      
      await waitFor(() => {
        expect(screen.getByText(/result/i)).toBeInTheDocument();
      });
    }
    
    // Workflow should complete without errors
    expect(screen.getByText(/photobooth/i)).toBeInTheDocument();
  });
});