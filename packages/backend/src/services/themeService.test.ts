import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThemeService, ThemeServiceConfig } from './themeService.js';
import { Theme, ThemeVariant } from 'shared';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock theme data
vi.mock('../data/mockThemes.js', () => ({
  mockThemes: [
    {
      id: 'test-theme',
      name: 'Test Theme',
      description: 'A test theme',
      thumbnailUrl: '/test-thumb.jpg',
      templateUrl: '/test-template.jpg',
      variants: [
        {
          id: 'test-variant',
          name: 'Test Variant',
          description: 'A test variant',
          thumbnailUrl: '/test-variant-thumb.jpg',
          templateUrl: '/test-variant-template.jpg',
          faceRegion: {
            x: 0.4,
            y: 0.3,
            width: 0.2,
            height: 0.25,
            rotation: 0
          },
          colorAdjustments: {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0
          }
        }
      ]
    }
  ],
  getThemeById: vi.fn(),
  getVariantById: vi.fn(),
  getThemesWithVariantCount: vi.fn()
}));

describe('ThemeService', () => {
  let themeService: ThemeService;
  let mockDynamoClient: any;
  let config: ThemeServiceConfig;

  const mockTheme: Theme = {
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
  };

  beforeEach(() => {
    config = {
      tableName: 'test-themes',
      region: 'us-east-1',
      useLocalDynamoDB: true,
      cacheEnabled: true,
      cacheTTL: 300
    };

    mockDynamoClient = {
      send: vi.fn()
    };

    vi.mocked(DynamoDBDocumentClient.from).mockReturnValue(mockDynamoClient);
    
    themeService = new ThemeService(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTheme', () => {
    it('should create a theme successfully', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({});

      const result = await themeService.createTheme(mockTheme);

      expect(result).toEqual(mockTheme);
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should throw error for invalid theme data', async () => {
      const invalidTheme = { ...mockTheme, id: '' };

      await expect(themeService.createTheme(invalidTheme)).rejects.toThrow(
        'Theme ID is required and must be a string'
      );
    });

    it('should throw error for theme without variants', async () => {
      const invalidTheme = { ...mockTheme, variants: [] };

      await expect(themeService.createTheme(invalidTheme)).rejects.toThrow(
        'Theme must have at least one variant'
      );
    });

    it.skip('should throw error for invalid variant data', async () => {
      const invalidTheme = {
        ...mockTheme,
        variants: [
          {
            ...mockTheme.variants[0],
            faceRegion: {
              ...mockTheme.variants[0]?.faceRegion,
              x: 1.5 // Invalid value > 1
            }
          }
        ]
      };

      await expect(themeService.createTheme(invalidTheme)).rejects.toThrow(
        'Variant 0 face region x must be a number between 0 and 1'
      );
    });
  });

  describe('getAllThemes', () => {
    it('should return all active themes', async () => {
      const mockThemes = [mockTheme];
      mockDynamoClient.send.mockResolvedValueOnce({
        Items: mockThemes
      });

      const result = await themeService.getAllThemes();

      expect(result).toEqual(mockThemes);
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should return cached themes on subsequent calls', async () => {
      const mockThemes = [mockTheme];
      mockDynamoClient.send.mockResolvedValueOnce({
        Items: mockThemes
      });

      // First call
      const result1 = await themeService.getAllThemes();
      // Second call (should use cache)
      const result2 = await themeService.getAllThemes();

      expect(result1).toEqual(mockThemes);
      expect(result2).toEqual(mockThemes);
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should fallback to mock data on DynamoDB error', async () => {
      mockDynamoClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      const result = await themeService.getAllThemes();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getThemeById', () => {
    it('should return theme by ID', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: { ...mockTheme, isActive: true }
      });

      const result = await themeService.getThemeById('barbarian');

      expect(result).toEqual({ ...mockTheme, isActive: true });
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should return null for non-existent theme', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: undefined
      });

      const result = await themeService.getThemeById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for inactive theme', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: { ...mockTheme, isActive: false }
      });

      const result = await themeService.getThemeById('barbarian');

      expect(result).toBeNull();
    });

    it('should return cached theme on subsequent calls', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: { ...mockTheme, isActive: true }
      });

      // First call
      const result1 = await themeService.getThemeById('barbarian');
      // Second call (should use cache)
      const result2 = await themeService.getThemeById('barbarian');

      expect(result1).toEqual({ ...mockTheme, isActive: true });
      expect(result2).toEqual({ ...mockTheme, isActive: true });
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getThemeVariant', () => {
    it('should return theme and variant', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: { ...mockTheme, isActive: true }
      });

      const result = await themeService.getThemeVariant('barbarian', 'barbarian-warrior');

      expect(result).toEqual({
        theme: { ...mockTheme, isActive: true },
        variant: mockTheme.variants[0]
      });
    });

    it('should return null for non-existent theme', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: undefined
      });

      const result = await themeService.getThemeVariant('non-existent', 'variant');

      expect(result).toBeNull();
    });

    it('should return null for non-existent variant', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Item: { ...mockTheme, isActive: true }
      });

      const result = await themeService.getThemeVariant('barbarian', 'non-existent-variant');

      expect(result).toBeNull();
    });
  });

  describe('updateTheme', () => {
    it('should update theme successfully', async () => {
      const updates = { name: 'Updated Barbarian' };
      const updatedTheme = { ...mockTheme, ...updates };

      mockDynamoClient.send.mockResolvedValueOnce({
        Attributes: updatedTheme
      });

      const result = await themeService.updateTheme('barbarian', updates);

      expect(result).toEqual(updatedTheme);
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should return null for non-existent theme', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({
        Attributes: undefined
      });

      const result = await themeService.updateTheme('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('deactivateTheme', () => {
    it('should deactivate theme successfully', async () => {
      mockDynamoClient.send.mockResolvedValueOnce({});

      const result = await themeService.deactivateTheme('barbarian');

      expect(result).toBe(true);
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should return false on error', async () => {
      mockDynamoClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      const result = await themeService.deactivateTheme('barbarian');

      expect(result).toBe(false);
    });
  });

  describe('seedThemes', () => {
    it('should seed all mock themes', async () => {
      mockDynamoClient.send.mockResolvedValue({});

      await themeService.seedThemes();

      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1); // One theme in mock data
    });

    it('should throw error if seeding fails', async () => {
      mockDynamoClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      await expect(themeService.seedThemes()).rejects.toThrow('DynamoDB error');
    });
  });

  describe('cache functionality', () => {
    it('should provide cache statistics', () => {
      const stats = themeService.getCacheStats();

      expect(stats).toEqual({
        size: 0,
        allThemesCached: false
      });
    });

    it('should disable caching when configured', async () => {
      const noCacheConfig = { ...config, cacheEnabled: false };
      const noCacheService = new ThemeService(noCacheConfig);

      mockDynamoClient.send.mockResolvedValue({
        Items: [mockTheme]
      });

      // Multiple calls should hit DynamoDB each time
      await noCacheService.getAllThemes();
      await noCacheService.getAllThemes();

      expect(mockDynamoClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation', () => {
    it('should validate theme structure', async () => {
      const invalidThemes = [
        { ...mockTheme, id: null },
        { ...mockTheme, name: '' },
        { ...mockTheme, description: 123 },
        { ...mockTheme, thumbnailUrl: null },
        { ...mockTheme, templateUrl: undefined },
        { ...mockTheme, variants: null }
      ];

      for (const invalidTheme of invalidThemes) {
        await expect(themeService.createTheme(invalidTheme as any)).rejects.toThrow();
      }
    });

    it.skip('should validate variant structure', async () => {
      const invalidVariant = {
        ...mockTheme.variants[0],
        faceRegion: {
          x: -0.1, // Invalid negative value
          y: 0.3,
          width: 0.2,
          height: 0.25,
          rotation: 0
        }
      };

      const invalidTheme = {
        ...mockTheme,
        variants: [invalidVariant]
      };

      await expect(themeService.createTheme(invalidTheme)).rejects.toThrow(
        'Variant 0 face region x must be a number between 0 and 1'
      );
    });

    it.skip('should validate color adjustments', async () => {
      const invalidVariant = {
        ...mockTheme.variants[0],
        colorAdjustments: {
          brightness: -1, // Invalid negative value
          contrast: 1.0,
          saturation: 1.0,
          hue: 0
        }
      };

      const invalidTheme = {
        ...mockTheme,
        variants: [invalidVariant]
      };

      await expect(themeService.createTheme(invalidTheme)).rejects.toThrow(
        'Variant 0 brightness must be a positive number'
      );
    });
  });
});