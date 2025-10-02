// Performance monitoring and budgets

interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  
  // Custom metrics
  ttfb?: number; // Time to First Byte
  domContentLoaded?: number;
  loadComplete?: number;
  
  // Resource metrics
  bundleSize?: number;
  imageSize?: number;
  cacheHitRate?: number;
  
  // User experience metrics
  processingTime?: number;
  uploadTime?: number;
  errorRate?: number;
}

interface PerformanceBudgets {
  fcp: number; // 1.8s
  lcp: number; // 2.5s
  fid: number; // 100ms
  cls: number; // 0.1
  ttfb: number; // 600ms
  bundleSize: number; // 1MB
  imageSize: number; // 500KB
  processingTime: number; // 8s
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private budgets: PerformanceBudgets = {
    fcp: 1800, // 1.8 seconds
    lcp: 2500, // 2.5 seconds
    fid: 100,  // 100ms
    cls: 0.1,  // 0.1
    ttfb: 600, // 600ms
    bundleSize: 1024 * 1024, // 1MB
    imageSize: 512 * 1024,   // 512KB
    processingTime: 8000     // 8 seconds
  };

  private observers: Map<string, PerformanceObserver> = new Map();

  constructor() {
    this.initializeObservers();
    this.measureInitialMetrics();
  }

  private initializeObservers() {
    // Core Web Vitals observer
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.lcp = lastEntry.startTime;
        this.checkBudget('lcp', lastEntry.startTime);
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
          this.checkBudget('fid', this.metrics.fid);
        });
      });

      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        this.metrics.cls = clsValue;
        this.checkBudget('cls', clsValue);
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }

      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.ttfb = entry.responseStart - entry.requestStart;
          this.metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.navigationStart;
          this.metrics.loadComplete = entry.loadEventEnd - entry.navigationStart;
          
          this.checkBudget('ttfb', this.metrics.ttfb);
        });
      });

      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported');
      }
    }
  }

  private measureInitialMetrics() {
    // Measure First Contentful Paint
    if ('performance' in window && 'getEntriesByType' in performance) {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      
      if (fcpEntry) {
        this.metrics.fcp = fcpEntry.startTime;
        this.checkBudget('fcp', fcpEntry.startTime);
      }
    }

    // Measure bundle size (approximate)
    this.measureBundleSize();
  }

  private async measureBundleSize() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      let totalSize = 0;

      for (const script of scripts) {
        const src = (script as HTMLScriptElement).src;
        if (src && !src.includes('node_modules')) {
          try {
            const response = await fetch(src, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              totalSize += parseInt(contentLength, 10);
            }
          } catch (e) {
            // Ignore errors for cross-origin resources
          }
        }
      }

      this.metrics.bundleSize = totalSize;
      this.checkBudget('bundleSize', totalSize);
    } catch (error) {
      console.warn('Could not measure bundle size:', error);
    }
  }

  private checkBudget(metric: keyof PerformanceBudgets, value: number) {
    const budget = this.budgets[metric];
    const isOverBudget = value > budget;

    if (isOverBudget) {
      console.warn(`Performance budget exceeded for ${metric}:`, {
        value,
        budget,
        overage: value - budget,
        percentage: ((value / budget) * 100).toFixed(1) + '%'
      });

      // Send to monitoring service in production
      if (import.meta.env.PROD) {
        this.reportMetric(metric, value, budget, true);
      }
    } else {
      console.log(`Performance budget OK for ${metric}:`, {
        value,
        budget,
        percentage: ((value / budget) * 100).toFixed(1) + '%'
      });
    }
  }

  // Public methods for custom metrics
  public measureProcessingTime(startTime: number): number {
    const processingTime = Date.now() - startTime;
    this.metrics.processingTime = processingTime;
    this.checkBudget('processingTime', processingTime);
    return processingTime;
  }

  public measureUploadTime(startTime: number): number {
    const uploadTime = Date.now() - startTime;
    this.metrics.uploadTime = uploadTime;
    return uploadTime;
  }

  public recordError(errorType: string) {
    this.metrics.errorRate = (this.metrics.errorRate || 0) + 1;
    
    if (import.meta.env.PROD) {
      this.reportError(errorType);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getBudgets(): PerformanceBudgets {
    return { ...this.budgets };
  }

  public generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      budgets: this.budgets,
      violations: this.getBudgetViolations()
    };

    return JSON.stringify(report, null, 2);
  }

  private getBudgetViolations(): Array<{metric: string, value: number, budget: number, overage: number}> {
    const violations = [];
    
    for (const [metric, budget] of Object.entries(this.budgets)) {
      const value = this.metrics[metric as keyof PerformanceMetrics];
      if (value && value > budget) {
        violations.push({
          metric,
          value,
          budget,
          overage: value - budget
        });
      }
    }

    return violations;
  }

  private reportMetric(metric: string, value: number, budget: number, isViolation: boolean) {
    // In production, this would send to CloudWatch or other monitoring service
    const data = {
      metric,
      value,
      budget,
      isViolation,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Mock implementation - replace with actual monitoring service
    console.log('Reporting metric to monitoring service:', data);
  }

  private reportError(errorType: string) {
    // In production, this would send to error tracking service
    const data = {
      errorType,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      metrics: this.metrics
    };

    console.log('Reporting error to monitoring service:', data);
  }

  public cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for measuring specific operations
export function measureAsync<T>(
  operation: () => Promise<T>,
  metricName: string
): Promise<T> {
  const startTime = performance.now();
  
  return operation().then(
    (result) => {
      const duration = performance.now() - startTime;
      console.log(`${metricName} completed in ${duration.toFixed(2)}ms`);
      return result;
    },
    (error) => {
      const duration = performance.now() - startTime;
      console.error(`${metricName} failed after ${duration.toFixed(2)}ms:`, error);
      performanceMonitor.recordError(metricName);
      throw error;
    }
  );
}

export function measureSync<T>(
  operation: () => T,
  metricName: string
): T {
  const startTime = performance.now();
  
  try {
    const result = operation();
    const duration = performance.now() - startTime;
    console.log(`${metricName} completed in ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`${metricName} failed after ${duration.toFixed(2)}ms:`, error);
    performanceMonitor.recordError(metricName);
    throw error;
  }
}