/**
 * Theme Service
 * Handles theme data fetching and caching
 */

import { Theme, ThemeVariant } from '@photobooth/shared';

export interface ThemeServiceOptions {
  apiBaseUrl?: string;
}

export class ThemeService {
  private readonly API_BASE_URL: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(options: ThemeServiceOptions = {}) {
    this.API_BASE_URL = options.apiBaseUrl || import.meta.env.VITE_API_URL || '/api';
  }

  /**
   * Get all available themes
   */
  async getAllThemes(): Promise<Theme[]> {
    const cacheKey = 'all-themes';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const response = await fetch(`${this.API_BASE_URL}/themes`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch themes: ${response.status}`);
    }

    const result = await response.json();
    const themes = result.data || result;

    // Cache the result
    this.cache.set(cacheKey, { data: themes, timestamp: Date.now() });

    return themes;
  }

  /**
   * Get a specific theme by ID
   */
  async getThemeById(id: string): Promise<Theme | null> {
    const cacheKey = `theme-${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const response = await fetch(`${this.API_BASE_URL}/themes/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch theme: ${response.status}`);
    }

    const result = await response.json();
    const theme = result.data || result;

    // Cache the result
    this.cache.set(cacheKey, { data: theme, timestamp: Date.now() });

    return theme;
  }

  /**
   * Get a specific theme variant
   */
  async getThemeVariant(themeId: string, variantId: string): Promise<{ theme: Theme; variant: ThemeVariant } | null> {
    const cacheKey = `variant-${themeId}-${variantId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const response = await fetch(`${this.API_BASE_URL}/themes/${themeId}/variants/${variantId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch theme variant: ${response.status}`);
    }

    const result = await response.json();
    const data = result.data || result;

    // Cache the result
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const themeService = new ThemeService();