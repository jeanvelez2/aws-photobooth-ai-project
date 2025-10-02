import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ThemeService } from '../services/themeService.js';

// Mock AWS services
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/client-dynamodb');

// Mock theme service
vi.mock('../services/themeService.js', () => ({
  ThemeService: vi.fn().mockImplementation(() => ({
    getAllThemes: vi.fn(),
    getTheme: vi.fn(),
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
  })),
}));

vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      s3BucketName: 'test-bucket',
      themesTable: 'test-themes-table',
    },
  },
}));

describe.skip('Themes Routes Integration', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import after clearing mocks
    const themesRoutes = await import('./themes.js');
    
    app = express();
    app.use(express.json());
    app.use('/api/themes', themesRoutes.default);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/themes', () => {
    it('should return all available themes', async () => {
      const mockThemes = [
        {
          id: 'barbarian',
          name: 'Barbarian Warrior',
          description: 'Fierce warrior from ancient times',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/template.jpg',
          variants: [
            {
              id: 'barbarian-classic',
              name: 'Classic',
              templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/classic.jpg',
            },
            {
              id: 'barbarian-battle',
              name: 'Battle Ready',
              templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/battle.jpg',
            },
          ],
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'greek',
          name: 'Greek God',
          description: 'Majestic deity from ancient Greece',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/greek/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/greek/template.jpg',
          variants: [],
          isActive: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(themeService.getAllThemes).mockResolvedValue(mockThemes);

      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          themes: mockThemes.map(theme => ({
            id: theme.id,
            name: theme.name,
            description: theme.description,
            thumbnailUrl: theme.thumbnailUrl,
            templateUrl: theme.templateUrl,
            variants: theme.variants,
          })),
          count: 2,
        },
      });

      expect(themeService.getAllThemes).toHaveBeenCalledWith({ activeOnly: true });
    });

    it('should return empty array when no themes available', async () => {
      vi.mocked(themeService.getAllThemes).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          themes: [],
          count: 0,
        },
      });
    });

    it('should include inactive themes when requested', async () => {
      const mockThemes = [
        {
          id: 'barbarian',
          name: 'Barbarian Warrior',
          description: 'Fierce warrior from ancient times',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/template.jpg',
          variants: [],
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'deprecated-theme',
          name: 'Deprecated Theme',
          description: 'Old theme no longer active',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/deprecated/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/deprecated/template.jpg',
          variants: [],
          isActive: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(themeService.getAllThemes).mockResolvedValue(mockThemes);

      const response = await request(app)
        .get('/api/themes?includeInactive=true')
        .expect(200);

      expect(response.body.data.count).toBe(2);
      expect(themeService.getAllThemes).toHaveBeenCalledWith({ activeOnly: false });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed') as any;
      error.code = 'DB_CONNECTION_ERROR';
      error.statusCode = 503;

      vi.mocked(themeService.getAllThemes).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/themes')
        .expect(503);

      expect(response.body).toEqual({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(themeService.getAllThemes).mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/themes')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('GET /api/themes/:id', () => {
    it('should return specific theme by ID', async () => {
      const mockTheme = {
        id: 'barbarian',
        name: 'Barbarian Warrior',
        description: 'Fierce warrior from ancient times',
        thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/thumbnail.jpg',
        templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/template.jpg',
        variants: [
          {
            id: 'barbarian-classic',
            name: 'Classic',
            templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/classic.jpg',
          },
        ],
        isActive: true,
        createdAt: new Date(),
      };

      vi.mocked(themeService.getTheme).mockResolvedValue(mockTheme);

      const response = await request(app)
        .get('/api/themes/barbarian')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: mockTheme.id,
          name: mockTheme.name,
          description: mockTheme.description,
          thumbnailUrl: mockTheme.thumbnailUrl,
          templateUrl: mockTheme.templateUrl,
          variants: mockTheme.variants,
        },
      });

      expect(themeService.getTheme).toHaveBeenCalledWith('barbarian');
    });

    it('should return 404 for non-existent theme', async () => {
      vi.mocked(themeService.getTheme).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/themes/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Theme not found',
        code: 'THEME_NOT_FOUND',
      });
    });

    it('should handle invalid theme ID format', async () => {
      const response = await request(app)
        .get('/api/themes/invalid-id!')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle service errors when fetching theme', async () => {
      const error = new Error('Database timeout') as any;
      error.code = 'DB_TIMEOUT';
      error.statusCode = 503;

      vi.mocked(themeService.getTheme).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/themes/barbarian')
        .expect(503);

      expect(response.body).toEqual({
        error: 'Database timeout',
        code: 'DB_TIMEOUT',
      });
    });
  });

  describe('Caching and Performance', () => {
    it('should handle multiple concurrent theme requests', async () => {
      const mockThemes = [
        {
          id: 'barbarian',
          name: 'Barbarian Warrior',
          description: 'Fierce warrior from ancient times',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/template.jpg',
          variants: [],
          isActive: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(themeService.getAllThemes).mockResolvedValue(mockThemes);

      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/themes')
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.count).toBe(1);
      });

      // Service should be called for each request (no caching in this test)
      expect(themeService.getAllThemes).toHaveBeenCalledTimes(10);
    });

    it('should handle large theme datasets efficiently', async () => {
      // Generate a large number of themes
      const mockThemes = Array.from({ length: 100 }, (_, i) => ({
        id: `theme-${i}`,
        name: `Theme ${i}`,
        description: `Description for theme ${i}`,
        thumbnailUrl: `https://s3.amazonaws.com/bucket/themes/theme-${i}/thumbnail.jpg`,
        templateUrl: `https://s3.amazonaws.com/bucket/themes/theme-${i}/template.jpg`,
        variants: [],
        isActive: true,
        createdAt: new Date(),
      }));

      vi.mocked(themeService.getAllThemes).mockResolvedValue(mockThemes);

      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body.data.count).toBe(100);
      expect(response.body.data.themes).toHaveLength(100);
    });
  });

  describe('Theme Validation', () => {
    it('should validate theme data structure', async () => {
      const mockThemes = [
        {
          id: 'barbarian',
          name: 'Barbarian Warrior',
          description: 'Fierce warrior from ancient times',
          thumbnailUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/thumbnail.jpg',
          templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/template.jpg',
          variants: [
            {
              id: 'barbarian-classic',
              name: 'Classic',
              templateUrl: 'https://s3.amazonaws.com/bucket/themes/barbarian/classic.jpg',
            },
          ],
          isActive: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(themeService.getAllThemes).mockResolvedValue(mockThemes);

      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      const theme = response.body.data.themes[0];
      
      // Validate required fields
      expect(theme).toHaveProperty('id');
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('description');
      expect(theme).toHaveProperty('thumbnailUrl');
      expect(theme).toHaveProperty('templateUrl');
      expect(theme).toHaveProperty('variants');
      
      // Validate variant structure
      expect(theme.variants[0]).toHaveProperty('id');
      expect(theme.variants[0]).toHaveProperty('name');
      expect(theme.variants[0]).toHaveProperty('templateUrl');
      
      // Ensure internal fields are not exposed
      expect(theme).not.toHaveProperty('isActive');
      expect(theme).not.toHaveProperty('createdAt');
    });
  });
});