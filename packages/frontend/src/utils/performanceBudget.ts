interface PerformanceBudget {
  bundleSize: number; // KB
  loadTime: number; // ms
  fcp: number; // First Contentful Paint ms
  lcp: number; // Largest Contentful Paint ms
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay ms
}

const PERFORMANCE_BUDGETS: PerformanceBudget = {
  bundleSize: 500, // 500KB max bundle size
  loadTime: 3000, // 3s max load time
  fcp: 1500, // 1.5s First Contentful Paint
  lcp: 2500, // 2.5s Largest Contentful Paint
  cls: 0.1, // 0.1 Cumulative Layout Shift
  fid: 100 // 100ms First Input Delay
};

export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();

  checkBundleSize(): void {
    // This would be checked at build time
    const bundleSize = this.getBundleSize();
    if (bundleSize > PERFORMANCE_BUDGETS.bundleSize) {
      console.warn(`Bundle size ${bundleSize}KB exceeds budget of ${PERFORMANCE_BUDGETS.bundleSize}KB`);
    }
  }

  measureWebVitals(): void {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('fcp', entry.startTime);
        }
      }
    }).observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.recordMetric('lcp', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift
    new PerformanceObserver((list) => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.recordMetric('cls', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('fid', (entry as any).processingStart - entry.startTime);
      }
    }).observe({ entryTypes: ['first-input'] });
  }

  private recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
    this.checkBudget(name, value);
  }

  private checkBudget(metric: string, value: number): void {
    const budget = PERFORMANCE_BUDGETS[metric as keyof PerformanceBudget];
    if (budget && value > budget) {
      console.warn(`${metric} ${value} exceeds budget of ${budget}`);
      this.reportBudgetViolation(metric, value, budget);
    }
  }

  private reportBudgetViolation(metric: string, actual: number, budget: number): void {
    // Send to analytics or monitoring service
    if ((window as any).gtag) {
      (window as any).gtag('event', 'performance_budget_violation', {
        metric,
        actual,
        budget,
        violation_percentage: ((actual - budget) / budget * 100).toFixed(2)
      });
    }
  }

  private getBundleSize(): number {
    // This would be populated at build time
    return parseInt(import.meta.env.VITE_BUNDLE_SIZE || '0');
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}

export const performanceMonitor = new PerformanceMonitor();