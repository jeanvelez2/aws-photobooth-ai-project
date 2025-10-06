import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Theme } from 'shared/types/theme.js';
import { mockThemes } from '../data/mockThemes.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const THEMES_TABLE = process.env.THEMES_TABLE || 'photobooth-themes-dev';
const USE_MOCK_DATA = process.env.NODE_ENV === 'development';

export class ThemeService {
  async getAllThemes(): Promise<Theme[]> {
    if (USE_MOCK_DATA) {
      return mockThemes;
    }

    try {
      const command = new ScanCommand({
        TableName: THEMES_TABLE
      });

      const result = await docClient.send(command);
      return (result.Items || []).map(item => {
        const { themeId, ...rest } = item;
        return {
          ...rest,
          id: themeId
        };
      }) as Theme[];
    } catch (error) {
      console.error('Error fetching themes from DynamoDB:', error);
      return mockThemes;
    }
  }

  async getThemeById(id: string): Promise<Theme | null> {
    if (USE_MOCK_DATA) {
      return mockThemes.find(theme => theme.id === id) || null;
    }

    try {
      const command = new GetCommand({
        TableName: THEMES_TABLE,
        Key: { themeId: id }
      });

      const result = await docClient.send(command);
      if (!result.Item) return null;
      const { themeId, ...rest } = result.Item;
      return {
        ...rest,
        id: themeId
      } as Theme;
    } catch (error) {
      console.error('Error fetching theme from DynamoDB:', error);
      return mockThemes.find(theme => theme.id === id) || null;
    }
  }

  async getThemesByCategory(category: string): Promise<Theme[]> {
    const themes = await this.getAllThemes();
    return themes.filter(theme => theme.category === category);
  }

  getAssetUrl(themeId: string, variantId: string, assetType: 'template' | 'mask' | 'thumbnail'): string {
    const baseUrl = process.env.CLOUDFRONT_URL || process.env.S3_BUCKET_URL || 'https://example.com';
    const extension = assetType === 'mask' ? 'png' : 'jpg';
    return `${baseUrl}/themes/${themeId}/${variantId}/${assetType}.${extension}`;
  }
}