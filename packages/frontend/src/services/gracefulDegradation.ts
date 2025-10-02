/**
 * Graceful Degradation Service
 * Handles service failures and provides fallback functionality
 */

import { ProcessingErrorType } from '@photobooth/shared';
import { errorService } from './errorService';

export interface ServiceStatus {
  name: string;
  available: boolean;
  lastChecked: Date;
  error?: string;
  fallbackAvailable: boolean;
}

export interface DegradationConfig {
  checkInterval: number;
  maxFailures: number;
  fallbackTimeout: number;
  services: string[];
}

export class GracefulDegradationService {
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private config: DegradationConfig;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<DegradationConfig> = {}) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      maxFailures: 3,
      fallbackTimeout: 5000, // 5 seconds
      services: ['processing', 'upload', 'themes'],
      ...config,
    };

    // Initialize service status
    this.config.services.forEach(service => {
      this.serviceStatus.set(service, {
        name: service,
        available: true,
        lastChecked: new Date(),
        fallbackAvailable: this.hasFallback(service),
      });
    });
  }

  /**
   * Check if a service is available
   */
  isServiceAvailable(serviceName: string): boolean {
    const status = this.serviceStatus.get(serviceName);
    return status?.available ?? false;
  }

  /**
   * Mark a service as failed
   */
  markServiceFailed(serviceName: string, error?: string): void {
    const status = this.serviceStatus.get(serviceName);
    if (status) {
      status.available = false;
      status.error = error;
      status.lastChecked = new Date();
      this.serviceStatus.set(serviceName, status);

      // Log the service failure
      errorService.createError(
        ProcessingErrorType.SERVICE_UNAVAILABLE,
        new Error(error || `Service ${serviceName} failed`),
        {
          component: 'GracefulDegradationService',
          action: 'markServiceFailed',
          service: serviceName,
        }
      );

      // Start health checking if not already running
      this.startHealthCheck(serviceName);
    }
  }

  /**
   * Mark a service as recovered
   */
  markServiceRecovered(serviceName: string): void {
    const status = this.serviceStatus.get(serviceName);
    if (status) {
      status.available = true;
      status.error = undefined;
      status.lastChecked = new Date();
      this.serviceStatus.set(serviceName, status);

      // Stop health checking
      this.stopHealthCheck(serviceName);
    }
  }

  /**
   * Get fallback functionality for a service
   */
  async getFallback<T>(serviceName: string, fallbackFn: () => Promise<T>): Promise<T> {
    const status = this.serviceStatus.get(serviceName);
    
    if (!status || status.available) {
      throw new Error(`Service ${serviceName} is available, fallback not needed`);
    }

    if (!status.fallbackAvailable) {
      throw new Error(`No fallback available for service ${serviceName}`);
    }

    try {
      return await Promise.race([
        fallbackFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Fallback timeout')), this.config.fallbackTimeout)
        )
      ]);
    } catch (error) {
      throw errorService.createError(
        ProcessingErrorType.SERVICE_UNAVAILABLE,
        error as Error,
        {
          component: 'GracefulDegradationService',
          action: 'getFallback',
          service: serviceName,
        }
      );
    }
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(
    serviceName: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    try {
      // Try primary service first
      const result = await primaryFn();
      
      // Mark service as recovered if it was previously failed
      if (!this.isServiceAvailable(serviceName)) {
        this.markServiceRecovered(serviceName);
      }
      
      return result;
    } catch (error) {
      // Mark service as failed
      this.markServiceFailed(serviceName, (error as Error).message);

      // Try fallback if available
      if (fallbackFn && this.hasFallback(serviceName)) {
        try {
          return await this.getFallback(serviceName, fallbackFn);
        } catch (fallbackError) {
          // Both primary and fallback failed
          throw errorService.createError(
            ProcessingErrorType.SERVICE_UNAVAILABLE,
            fallbackError as Error,
            {
              component: 'GracefulDegradationService',
              action: 'executeWithFallback',
              service: serviceName,
              primaryError: (error as Error).message,
            }
          );
        }
      }

      // No fallback available, throw original error
      throw error;
    }
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): ServiceStatus[] {
    return Array.from(this.serviceStatus.values());
  }

  /**
   * Get degraded services
   */
  getDegradedServices(): ServiceStatus[] {
    return this.getServiceStatus().filter(status => !status.available);
  }

  /**
   * Check if any services are degraded
   */
  hasServiceDegradation(): boolean {
    return this.getDegradedServices().length > 0;
  }

  /**
   * Get fallback options for processing
   */
  getProcessingFallbacks() {
    return {
      // Simplified processing without advanced features
      basicProcessing: async (imageData: Blob, themeId: string) => {
        // Client-side basic image processing
        return this.performBasicImageProcessing(imageData, themeId);
      },

      // Cached results from previous successful processing
      cachedResults: async (imageHash: string) => {
        const cached = localStorage.getItem(`processed_${imageHash}`);
        if (cached) {
          return JSON.parse(cached);
        }
        throw new Error('No cached result available');
      },

      // Queue for later processing
      queueForLater: async (request: any) => {
        try {
          const queue = JSON.parse(localStorage.getItem('processing_queue') || '[]');
          
          // Limit queue size to prevent storage overflow
          const MAX_QUEUE_SIZE = 10;
          if (queue.length >= MAX_QUEUE_SIZE) {
            queue.shift(); // Remove oldest item
          }
          
          // Store minimal data to save space
          const minimalRequest = {
            photoId: request.photoId,
            themeId: request.themeId,
            timestamp: Date.now()
          };
          
          queue.push(minimalRequest);
          localStorage.setItem('processing_queue', JSON.stringify(queue));
          return { queued: true, position: queue.length };
        } catch (error) {
          // If localStorage is full, clear queue and try again
          localStorage.removeItem('processing_queue');
          return { queued: false, error: 'Storage quota exceeded' };
        }
      },
    };
  }

  /**
   * Get fallback options for themes
   */
  getThemeFallbacks() {
    return {
      // Basic built-in themes
      basicThemes: async () => {
        return [
          {
            id: 'basic-1',
            name: 'Classic',
            description: 'Simple classic theme',
            thumbnailUrl: '/fallback-themes/classic.jpg',
            templateUrl: '/fallback-themes/classic-template.jpg',
            variants: [],
          },
          {
            id: 'basic-2', 
            name: 'Modern',
            description: 'Clean modern theme',
            thumbnailUrl: '/fallback-themes/modern.jpg',
            templateUrl: '/fallback-themes/modern-template.jpg',
            variants: [],
          },
        ];
      },

      // Cached themes
      cachedThemes: async () => {
        const cached = localStorage.getItem('cached_themes');
        if (cached) {
          return JSON.parse(cached);
        }
        throw new Error('No cached themes available');
      },
    };
  }

  /**
   * Get fallback options for upload
   */
  getUploadFallbacks() {
    return {
      // Local storage for small images
      localStorage: async (imageData: Blob) => {
        if (imageData.size > 512 * 1024) { // 512KB limit
          throw new Error('Image too large for local storage');
        }
        
        const reader = new FileReader();
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => {
            try {
              const id = `local_${Date.now()}`;
              localStorage.setItem(`image_${id}`, reader.result as string);
              resolve({ id, url: reader.result });
            } catch (error) {
              // Clear old images if storage is full
              const keys = Object.keys(localStorage);
              const imageKeys = keys.filter(key => key.startsWith('image_') || key.startsWith('processed_'));
              imageKeys.sort().slice(0, Math.floor(imageKeys.length / 2)).forEach(key => {
                localStorage.removeItem(key);
              });
              reject(new Error('Storage quota exceeded'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageData);
        });
      },

      // IndexedDB for larger images
      indexedDB: async (imageData: Blob) => {
        // Implementation would use IndexedDB for client-side storage
        throw new Error('IndexedDB fallback not implemented');
      },
    };
  }

  /**
   * Perform basic client-side image processing
   */
  private async performBasicImageProcessing(imageData: Blob, themeId: string): Promise<any> {
    // This would implement basic client-side image processing
    // using Canvas API for simple overlays and effects
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx?.drawImage(img, 0, 0);
        
        // Apply basic theme overlay (simplified)
        if (ctx) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = this.getThemeColor(themeId);
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(imageData);
    });
  }

  /**
   * Get theme color for basic processing
   */
  private getThemeColor(themeId: string): string {
    const colors: Record<string, string> = {
      'barbarian': '#8B4513',
      'greek': '#FFD700',
      'mystic': '#9370DB',
      'anime': '#FF69B4',
      'basic-1': '#708090',
      'basic-2': '#4682B4',
    };
    return colors[themeId] || '#808080';
  }

  /**
   * Check if a service has fallback functionality
   */
  private hasFallback(serviceName: string): boolean {
    const fallbacks: Record<string, boolean> = {
      processing: true,
      upload: true,
      themes: true,
    };
    return fallbacks[serviceName] || false;
  }

  /**
   * Start health checking for a service
   */
  private startHealthCheck(serviceName: string): void {
    if (this.checkIntervals.has(serviceName)) {
      return; // Already checking
    }

    const interval = setInterval(async () => {
      try {
        await this.checkServiceHealth(serviceName);
        this.markServiceRecovered(serviceName);
      } catch (error) {
        // Service still failing, continue checking
      }
    }, this.config.checkInterval);

    this.checkIntervals.set(serviceName, interval);
  }

  /**
   * Stop health checking for a service
   */
  private stopHealthCheck(serviceName: string): void {
    const interval = this.checkIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(serviceName);
    }
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const endpoints: Record<string, string> = {
      processing: '/api/health',
      upload: '/api/health',
      themes: '/api/themes',
    };

    const endpoint = endpoints[serviceName];
    if (!endpoint) {
      throw new Error(`No health check endpoint for service ${serviceName}`);
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  }

  /**
   * Clear old images from localStorage
   */
  private clearOldImages(): void {
    const keys = Object.keys(localStorage);
    const imageKeys = keys.filter(key => key.startsWith('image_') || key.startsWith('processed_'));
    
    // Sort by timestamp and remove oldest
    imageKeys.sort().slice(0, Math.floor(imageKeys.length / 2)).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.checkIntervals.forEach(interval => clearInterval(interval));
    this.checkIntervals.clear();
  }
}

// Export singleton instance
export const gracefulDegradationService = new GracefulDegradationService();