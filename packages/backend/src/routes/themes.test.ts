import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock error handler
vi.mock('../middleware/errorHandler.js', () => ({
  asyncHandler: (fn: any) => fn,
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      region: 'us-east-1',
      dynamodb: {
        themesTable: 'test-themes',
        useLocal: true
      }
    }
  }
}));

// Mock the entire ThemeService module
vi.mock('../services/themeService.js', () => {
  const mockThemes = [
    {
      id: 'barbarian',
      name: 'Barbarian Warrior',
      description: 'Fierce warrior theme',
      thumbnailUrl: '/themes/barbarian-thumb.jpg',
      templateUrl: '/themes/barbarian-template.jpg',
      variants: [
        {
          id: 'barbarian-warrior',
          name: 'Warrior',
          description: 'Classic warrior variant',
          thumbnailUrl: '/themes/barbarian-warrior-thumb.jpg',
          templateUrl: '/themes/barbarian-warrior-template.jpg',
          faceRegion: {
            x: 0.35,
            y: 0.25,
            width: 0.3,
            height: 0.35,
            rotation: 0
          },
          colorAdjustments: {
            brightness: 1.1,
            contrast: 1.2,
            saturation: 1.1,
            hue: 0
          }
        }
      ]
    }
  ];

  return {
    ThemeService: vi.fn().mockImplementation(() => ({
      getAllThemes: vi.fn().mockResolvedValue(mockThemes),
      getThemeById: vi.fn().mockImplementation((id: string) => {
        return Promise.resolve(mockThemes.find(t => t.id === id) || null);
      }),
      getThemeVariant: vi.fn().mockImplementation((themeId: string, variantId: string) => {
        const theme = mockThemes.find(t => t.id === themeId);
        if (!theme) return Promise.resolve(null);
        const variant = theme.variants.find(v => v.id === variantId);
        if (!variant) return Promise.resolve(null);
        return Promise.resolve({ theme, variant });
      }),
      seedThemes: vi.fn().mockResolvedValue(undefined),
      getCacheStats: vi.fn().mockReturnValue({ size: 5, allThemesCached: true })
    }))
  };
});

describe('Themes Routes Integration', () => {
  let app: express.Application;

  beforeEach(async () => {
    // Import the router after mocks are set up
    const { default: themesRouter } = await import('./themes.js');
    
    app = express();
    app.use(express.json());
    app.use('/api/themes', themesRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/themes', () => {
    it('should return all active themes with caching headers', async () => {
      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.any(Array),
        count: 1,
        cached: true
      });

      expect(response.headers['cache-control']).toBe('public, max-age=300');
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
    });

    it('should return themes with correct structure', async () => {
      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      const theme = response.body.data[0];
      expect(theme).toHaveProperty('id');
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('description');
      expect(theme).toHaveProperty('thumbnailUrl');
      expect(theme).toHaveProperty('templateUrl');
      expect(theme).toHaveProperty('variants');
      expect(Array.isArray(theme.variants)).toBe(true);
    });
  });

  describe('GET /api/themes/:id', () => {
    it('should return a specific theme with caching headers', async () => {
      const response = await request(app)
        .get('/api/themes/barbarian')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'barbarian',
          name: 'Barbarian Warrior'
        }),
        cached: true
      });

      expect(response.headers['cache-control']).toBe('public, max-age=300');
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
    });

    it('should return 404 for non-existent theme', async () => {
      const response = await request(app)
        .get('/api/themes/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: true,
        message: 'Theme not found',
        code: 'THEME_NOT_FOUND',
      });
    });
  });

  describe('GET /api/themes/:id/variants/:variantId', () => {
    it('should return a specific theme variant', async () => {
      const response = await request(app)
        .get('/api/themes/barbarian/variants/barbarian-warrior')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          theme: expect.objectContaining({
            id: 'barbarian'
          }),
          variant: expect.objectContaining({
            id: 'barbarian-warrior'
          })
        },
        cached: true
      });

      expect(response.headers['cache-control']).toBe('public, max-age=300');
    });

    it('should return 404 for non-existent variant', async () => {
      const response = await request(app)
        .get('/api/themes/barbarian/variants/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: true,
        message: 'Theme variant not found',
        code: 'THEME_VARIANT_NOT_FOUND',
      });
    });
  });

  describe('POST /api/themes/seed', () => {
    it('should seed themes successfully', async () => {
      const response = await request(app)
        .post('/api/themes/seed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Themes seeded successfully',
        data: {
          seeded: true,
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('GET /api/themes/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/themes/cache/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          size: 5,
          allThemesCached: true
        }
      });
    });
  });
});