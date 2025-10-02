/**
 * Theme Hooks
 * React hooks for theme data management
 */

import { useQuery } from '@tanstack/react-query';
import { Theme, ThemeVariant } from '@photobooth/shared';
import { themeService } from '../services/themeService';

/**
 * Hook to fetch all themes
 */
export function useThemes() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: () => themeService.getAllThemes(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch a specific theme
 */
export function useTheme(id: string | undefined) {
  return useQuery({
    queryKey: ['theme', id],
    queryFn: () => id ? themeService.getThemeById(id) : null,
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch a specific theme variant
 */
export function useThemeVariant(themeId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: ['theme-variant', themeId, variantId],
    queryFn: () => themeId && variantId ? themeService.getThemeVariant(themeId, variantId) : null,
    enabled: !!(themeId && variantId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}