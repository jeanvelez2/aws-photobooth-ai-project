import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Theme, ThemeVariant, ThemeTemplate } from 'shared';
import { logger } from '../utils/logger.js';
import { mockThemes, getThemeById, getVariantById, getThemesWithVariantCount } from '../data/mockThemes.js';

export interface ThemeServiceConfig {
  tableName: string;
  region: string;
  useLocalDynamoDB?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in seconds
}

export interface CachedTheme {
  theme: Theme;
  cachedAt: number;
  ttl: number;
}

export class ThemeService {
  private dynamoClient: DynamoDBDocumentClient;
  private config: ThemeServiceConfig;
  private readonly cache: Map<string, CachedTheme>;
  private allThemesCache: { themes: Theme[]; cachedAt: number; ttl: number } | null = null;
  private readonly maxCacheSize = 1000; // Prevent memory leaks

  constructor(config: ThemeServiceConfig) {
    if (!config || typeof config !== 'object') {
      throw new Error('ThemeServiceConfig is required');
    }
    
    if (!config.tableName || typeof config.tableName !== 'string') {
      throw new Error('tableName is required and must be a string');
    }
    
    if (!config.region || typeof config.region !== 'string') {
      throw new Error('region is required and must be a string');
    }
    
    this.config = {
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes default
      ...config
    };
    
    this.cache = new Map();

    try {
      const dynamoClient = new DynamoDBClient(this.config.useLocalDynamoDB 
        ? { region: this.config.region, endpoint: 'http://localhost:8000' }
        : { region: this.config.region });

      this.dynamoClient = DynamoDBDocumentClient.from(dynamoClient);
    } catch (error) {
      logger.warn('Failed to initialize DynamoDB client, will use mock data', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        region: this.config.region,
        useLocalDynamoDB: this.config.useLocalDynamoDB
      });
      // Set a null client to force fallback to mock data
      this.dynamoClient = null as any;
    }
  }

  /**
   * Initialize theme data by seeding the database with mock themes
   */
  async seedThemes(): Promise<void> {
    logger.info('Starting theme data seeding');

    let currentTheme: Theme | null = null;
    try {
      for (const theme of mockThemes) {
        currentTheme = theme;
        logger.debug('Validating and creating theme', { 
          themeId: theme.id?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
        await this.createTheme(theme);
        logger.info('Seeded theme', { 
          themeName: theme.name?.replace(/[\r\n\t]/g, '') || 'unknown',
          themeId: theme.id?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
      }

      logger.info('Theme seeding completed successfully', { 
        count: mockThemes.length 
      });
    } catch (error) {
      logger.error('Failed to seed themes', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        totalThemes: mockThemes.length,
        failedThemeId: currentTheme?.id?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      throw error;
    }
  }

  /**
   * Create a new theme in DynamoDB
   */
  async createTheme(theme: Theme): Promise<Theme> {
    try {
      // Validate theme data
      this.validateTheme(theme);

      const themeRecord = {
        themeId: theme.id, // DynamoDB table uses themeId as partition key
        ...theme,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.tableName,
        Item: themeRecord
        // Remove condition to allow overwriting during seeding
      }));

      // Clear cache
      this.clearCache();

      logger.info('Theme created successfully', { 
        themeId: theme.id?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      return theme;
    } catch (error) {
      logger.error('Failed to create theme', { 
        themeId: theme.id?.replace(/[\r\n\t]/g, '') || 'unknown',
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get all active themes with caching
   */
  async getAllThemes(): Promise<Theme[]> {
    try {
      // Check cache first
      if (this.config.cacheEnabled && this.allThemesCache) {
        const now = Date.now();
        if (now - this.allThemesCache.cachedAt < this.allThemesCache.ttl * 1000) {
          logger.debug('Returning themes from cache');
          return this.allThemesCache.themes;
        }
        logger.debug('Theme cache expired, fetching fresh data');
      } else if (!this.config.cacheEnabled) {
        logger.debug('Cache disabled, fetching themes directly');
      }

      // If no DynamoDB client, use mock data (but allow tests to override)
      if (!this.dynamoClient) {
        logger.info('Using mock theme data');
        return mockThemes;
      }

      logger.debug('Querying DynamoDB for active themes');
      try {
        const result = await this.dynamoClient.send(new ScanCommand({
          TableName: this.config.tableName,
          FilterExpression: 'isActive = :active',
          ExpressionAttributeValues: {
            ':active': true
          }
        }));

        const themes = (result.Items || []) as Theme[];

        // Cache the result
        if (this.config.cacheEnabled) {
          this.allThemesCache = {
            themes,
            cachedAt: Date.now(),
            ttl: this.config.cacheTTL!
          };
        }

        logger.info('Retrieved all themes from DynamoDB', { count: themes.length });
        return themes;
      } catch (error) {
        logger.error('Failed to retrieve themes from DynamoDB', { 
          error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
        });
        
        // Fallback to mock data if DynamoDB is unavailable
        logger.warn('Falling back to mock theme data');
        
        // Cache the mock data to avoid repeated DynamoDB calls
        if (this.config.cacheEnabled) {
          this.allThemesCache = {
            themes: mockThemes,
            cachedAt: Date.now(),
            ttl: this.config.cacheTTL!
          };
        }
        
        return mockThemes;
      }
    } catch (error) {
      // Ultimate fallback - should never fail
      logger.error('Unexpected error in getAllThemes, using mock data', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      return mockThemes;
    }
  }

  /**
   * Get a specific theme by ID with caching
   */
  async getThemeById(id: string): Promise<Theme | null> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('Invalid theme ID provided', { themeId: 'invalid' });
      return null;
    }
    
    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cache.has(id)) {
        const cached = this.cache.get(id)!;
        const now = Date.now();
        if (now - cached.cachedAt < cached.ttl * 1000) {
          logger.debug('Returning theme from cache', { 
            themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
          });
          return cached.theme;
        }
      }

      // If no DynamoDB client, use mock data (but allow tests to override)
      if (!this.dynamoClient) {
        logger.info('Using mock theme data for theme lookup', { 
          themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
        return getThemeById(id) || null;
      }

      try {
        const result = await this.dynamoClient.send(new GetCommand({
          TableName: this.config.tableName,
          Key: { themeId: id }
        }));

        if (!result.Item || !result.Item.isActive) {
          logger.warn('Theme not found or inactive', { 
            themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
          });
          return null;
        }

        const theme = result.Item as Theme;

        // Cache the result with size management
        if (this.config.cacheEnabled) {
          if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
          }
          
          this.cache.set(id, {
            theme,
            cachedAt: Date.now(),
            ttl: this.config.cacheTTL!
          });
        }

        logger.info('Retrieved theme by ID from DynamoDB', { 
          themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
        return theme;
      } catch (error) {
        logger.error('Failed to retrieve theme by ID from DynamoDB', { 
          themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown',
          error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
        });
        
        // Fallback to mock data
        logger.warn('Falling back to mock theme data', { 
          themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
        const mockTheme = getThemeById(id);
        
        // Cache the mock result to avoid repeated DynamoDB calls
        if (mockTheme && this.config.cacheEnabled) {
          this.cache.set(id, {
            theme: mockTheme,
            cachedAt: Date.now(),
            ttl: this.config.cacheTTL!
          });
        }
        
        return mockTheme || null;
      }
    } catch (error) {
      // Ultimate fallback - should never fail
      logger.error('Unexpected error in getThemeById, using mock data', { 
        themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown',
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      return getThemeById(id) || null;
    }
  }

  /**
   * Get a specific theme variant
   */
  async getThemeVariant(themeId: string, variantId: string): Promise<{ theme: Theme; variant: ThemeVariant } | null> {
    if (!themeId || typeof themeId !== 'string' || !variantId || typeof variantId !== 'string') {
      logger.warn('Invalid parameters for variant lookup', { 
        themeId: themeId || 'missing',
        variantId: variantId || 'missing'
      });
      return null;
    }
    
    logger.debug('Looking up theme variant', { 
      themeId: themeId.replace(/[\r\n\t]/g, '') || 'unknown',
      variantId: variantId.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    
    const theme = await this.getThemeById(themeId);
    if (!theme) {
      logger.warn('Theme not found for variant lookup', { 
        themeId: themeId?.replace(/[\r\n\t]/g, '') || 'unknown',
        variantId: variantId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      return null;
    }

    const variant = theme.variants.find(v => v.id === variantId);
    if (!variant) {
      logger.warn('Variant not found', { 
        themeId: themeId?.replace(/[\r\n\t]/g, '') || 'unknown',
        variantId: variantId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      return null;
    }

    logger.debug('Theme variant found successfully', { 
      themeId: themeId?.replace(/[\r\n\t]/g, '') || 'unknown',
      variantId: variantId?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    return { theme, variant };
  }

  /**
   * Update a theme
   */
  async updateTheme(id: string, updates: Partial<Theme>): Promise<Theme | null> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Valid theme ID is required for update');
    }
    
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('Updates object is required and must not be empty');
    }
    
    try {
      // Validate updates
      if (updates.variants) {
        this.validateVariants(updates.variants);
      }

      const updateExpression = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Build update expression dynamically
      Object.entries(updates).forEach(([key, value], index) => {
        if (key !== 'id') { // Don't update the ID
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          updateExpression.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        }
      });

      // Always update the updatedAt timestamp
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const result = await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.tableName,
        Key: { themeId: id },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(themeId)',
        ReturnValues: 'ALL_NEW'
      }));

      if (!result.Attributes) {
        return null;
      }

      const updatedTheme = result.Attributes as Theme;

      // Clear cache
      this.clearCacheForTheme(id);

      logger.info('Theme updated successfully', { 
        themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      return updatedTheme;
    } catch (error) {
      logger.error('Failed to update theme', { 
        themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown',
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Deactivate a theme (soft delete)
   */
  async deactivateTheme(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.error('Invalid theme ID provided for deactivation', { themeId: 'invalid' });
      return false;
    }
    
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.tableName,
        Key: { themeId: id },
        UpdateExpression: 'SET isActive = :inactive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inactive': false,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(themeId)'
      }));

      // Clear cache
      this.clearCacheForTheme(id);

      logger.info('Theme deactivated successfully', { 
        themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      return true;
    } catch (error) {
      logger.error('Failed to deactivate theme', { 
        themeId: id?.replace(/[\r\n\t]/g, '') || 'unknown',
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Validate theme data structure
   */
  private validateTheme(theme: Theme): void {
    if (!theme || typeof theme !== 'object') {
      throw new Error('Theme object is required');
    }
    
    if (!theme.id || typeof theme.id !== 'string' || theme.id.trim().length === 0) {
      throw new Error('Theme ID is required and must be a non-empty string');
    }

    if (!theme.name || typeof theme.name !== 'string') {
      throw new Error('Theme name is required and must be a string');
    }

    if (!theme.description || typeof theme.description !== 'string') {
      throw new Error('Theme description is required and must be a string');
    }

    if (!theme.thumbnailUrl || typeof theme.thumbnailUrl !== 'string' || theme.thumbnailUrl.trim().length === 0) {
      throw new Error('Theme thumbnail URL is required and must be a non-empty string');
    }
    
    // Basic URL validation
    try {
      new URL(theme.thumbnailUrl);
    } catch {
      throw new Error('Theme thumbnail URL must be a valid URL');
    }

    if (!theme.templateUrl || typeof theme.templateUrl !== 'string' || theme.templateUrl.trim().length === 0) {
      throw new Error('Theme template URL is required and must be a non-empty string');
    }
    
    // Basic URL validation
    try {
      new URL(theme.templateUrl);
    } catch {
      throw new Error('Theme template URL must be a valid URL');
    }

    if (!Array.isArray(theme.variants) || theme.variants.length === 0) {
      throw new Error('Theme must have at least one variant');
    }

    this.validateVariants(theme.variants);
  }

  /**
   * Validate theme variants
   */
  private validateVariants(variants: ThemeVariant[]): void {
    if (!Array.isArray(variants)) {
      throw new Error('Variants must be an array');
    }
    
    variants.forEach((variant, index) => {
      if (!variant || typeof variant !== 'object') {
        throw new Error(`Variant ${index} must be an object`);
      }
      
      if (!variant.id || typeof variant.id !== 'string' || variant.id.trim().length === 0) {
        throw new Error(`Variant ${index} ID is required and must be a non-empty string`);
      }

      if (!variant.name || typeof variant.name !== 'string') {
        throw new Error(`Variant ${index} name is required and must be a string`);
      }

      if (!variant.thumbnailUrl || typeof variant.thumbnailUrl !== 'string' || variant.thumbnailUrl.trim().length === 0) {
        throw new Error(`Variant ${index} thumbnail URL is required and must be a non-empty string`);
      }
      
      // Basic URL validation for variant thumbnail
      try {
        new URL(variant.thumbnailUrl);
      } catch {
        throw new Error(`Variant ${index} thumbnail URL must be a valid URL`);
      }

      if (!variant.templateUrl || typeof variant.templateUrl !== 'string' || variant.templateUrl.trim().length === 0) {
        throw new Error(`Variant ${index} template URL is required and must be a non-empty string`);
      }
      
      // Basic URL validation for variant template
      try {
        new URL(variant.templateUrl);
      } catch {
        throw new Error(`Variant ${index} template URL must be a valid URL`);
      }

      if (!variant.faceRegion || typeof variant.faceRegion !== 'object') {
        throw new Error(`Variant ${index} face region is required and must be an object`);
      }

      const { faceRegion } = variant;
      if (typeof faceRegion.x !== 'number' || faceRegion.x < 0 || faceRegion.x > 1) {
        throw new Error(`Variant ${index} face region x must be a number between 0 and 1`);
      }

      if (typeof faceRegion.y !== 'number' || faceRegion.y < 0 || faceRegion.y > 1) {
        throw new Error(`Variant ${index} face region y must be a number between 0 and 1`);
      }

      if (typeof faceRegion.width !== 'number' || faceRegion.width <= 0 || faceRegion.width > 1) {
        throw new Error(`Variant ${index} face region width must be a number between 0 and 1`);
      }

      if (typeof faceRegion.height !== 'number' || faceRegion.height <= 0 || faceRegion.height > 1) {
        throw new Error(`Variant ${index} face region height must be a number between 0 and 1`);
      }

      if (typeof faceRegion.rotation !== 'number') {
        throw new Error(`Variant ${index} face region rotation must be a number`);
      }

      if (!variant.colorAdjustments || typeof variant.colorAdjustments !== 'object') {
        throw new Error(`Variant ${index} color adjustments are required and must be an object`);
      }

      const { colorAdjustments } = variant;
      if (typeof colorAdjustments.brightness !== 'number' || colorAdjustments.brightness < 0) {
        throw new Error(`Variant ${index} brightness must be a positive number`);
      }

      if (typeof colorAdjustments.contrast !== 'number' || colorAdjustments.contrast < 0) {
        throw new Error(`Variant ${index} contrast must be a positive number`);
      }

      if (typeof colorAdjustments.saturation !== 'number' || colorAdjustments.saturation < 0) {
        throw new Error(`Variant ${index} saturation must be a positive number`);
      }

      if (typeof colorAdjustments.hue !== 'number') {
        throw new Error(`Variant ${index} hue must be a number`);
      }
    });
  }

  /**
   * Clear all cache
   */
  private clearCache(): void {
    this.cache.clear();
    this.allThemesCache = null;
    logger.debug('Theme cache cleared');
  }

  /**
   * Clear cache for a specific theme
   */
  private clearCacheForTheme(themeId: string): void {
    this.cache.delete(themeId);
    this.allThemesCache = null; // Clear all themes cache as well
    logger.debug('Theme cache cleared for theme', { 
      themeId: themeId?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; allThemesCached: boolean } {
    return {
      size: this.cache.size,
      allThemesCached: this.allThemesCache !== null
    };
  }
}