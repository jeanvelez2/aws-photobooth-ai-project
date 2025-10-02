import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { ThemeService } from '../services/themeService.js';
import { config } from '../config/index.js';

const router = Router();

// Initialize theme service
const themeService = new ThemeService({
  tableName: config.aws.dynamodb.themesTable || 'photobooth-themes',
  region: config.aws.region,
  useLocalDynamoDB: config.aws.dynamodb.useLocal,
  cacheEnabled: true,
  cacheTTL: 300 // 5 minutes
});

/**
 * GET /api/themes
 * Retrieve all available themes with caching
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info('Fetching themes', { requestId });

  try {
    const themes = await themeService.getAllThemes();

    logger.info('Themes retrieved successfully', {
      requestId,
      count: themes.length,
    });

    // Set cache headers for client-side caching
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"themes-${themes.length}-${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    });

    res.json({
      success: true,
      data: themes,
      count: themes.length,
      cached: true
    });
  } catch (error) {
    logger.error('Failed to retrieve themes', { requestId, error });
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve themes',
      code: 'THEMES_FETCH_ERROR',
    });
  }
}));

/**
 * GET /api/themes/:id
 * Retrieve a specific theme by ID with caching
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  
  logger.info('Fetching theme by ID', { requestId, themeId: id });

  try {
    if (!id) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }
    const theme = await themeService.getThemeById(id);

    if (!theme) {
      logger.warn('Theme not found', { requestId, themeId: id });
      res.status(404).json({
        error: true,
        message: 'Theme not found',
        code: 'THEME_NOT_FOUND',
      });
      return;
    }

    logger.info('Theme retrieved successfully', {
      requestId,
      themeId: id,
      themeName: theme.name,
    });

    // Set cache headers for client-side caching
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"theme-${id}-${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    });

    res.json({
      success: true,
      data: theme,
      cached: true
    });
  } catch (error) {
    logger.error('Failed to retrieve theme', { requestId, themeId: id, error });
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve theme',
      code: 'THEME_FETCH_ERROR',
    });
  }
}));

export default router;

/**
 * GET /api/themes/:id/variants/:variantId
 * Retrieve a specific theme variant
 */
router.get('/:id/variants/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const { id, variantId } = req.params;
  
  logger.info('Fetching theme variant', { requestId, themeId: id, variantId });

  try {
    if (!id) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }
    const result = await themeService.getThemeVariant(id, variantId || '');

    if (!result) {
      logger.warn('Theme variant not found', { requestId, themeId: id, variantId });
      res.status(404).json({
        error: true,
        message: 'Theme variant not found',
        code: 'THEME_VARIANT_NOT_FOUND',
      });
      return;
    }

    logger.info('Theme variant retrieved successfully', {
      requestId,
      themeId: id,
      variantId,
      themeName: result.theme.name,
      variantName: result.variant.name
    });

    // Set cache headers for client-side caching
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"variant-${id}-${variantId}-${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    });

    res.json({
      success: true,
      data: {
        theme: result.theme,
        variant: result.variant
      },
      cached: true
    });
  } catch (error) {
    logger.error('Failed to retrieve theme variant', { 
      requestId, 
      themeId: id, 
      variantId, 
      error 
    });
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve theme variant',
      code: 'THEME_VARIANT_FETCH_ERROR',
    });
  }
}));

/**
 * POST /api/themes/seed
 * Seed the database with initial theme data (admin endpoint)
 */
router.post('/seed', asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info('Starting theme seeding', { requestId });

  try {
    await themeService.seedThemes();

    logger.info('Theme seeding completed successfully', { requestId });

    res.json({
      success: true,
      message: 'Themes seeded successfully',
      data: {
        seeded: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to seed themes', { requestId, error });
    res.status(500).json({
      error: true,
      message: 'Failed to seed themes',
      code: 'THEME_SEED_ERROR',
    });
  }
}));

/**
 * GET /api/themes/cache/stats
 * Get cache statistics (admin endpoint)
 */
router.get('/cache/stats', asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info('Fetching cache statistics', { requestId });

  try {
    const stats = themeService.getCacheStats();

    logger.info('Cache statistics retrieved', { requestId, stats });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to retrieve cache statistics', { requestId, error });
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve cache statistics',
      code: 'CACHE_STATS_ERROR',
    });
  }
}));