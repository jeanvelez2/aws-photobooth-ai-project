import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Theme } from 'shared/types/theme.js';
import { config } from '../config/index.js';

const client = new DynamoDBClient({ region: config.aws.region });
const docClient = DynamoDBDocumentClient.from(client);

const THEMES_TABLE = config.aws.dynamodb.themesTable;
console.log(`[THEME_SERVICE] Using themes table: ${THEMES_TABLE}`);

export class ThemeService {
  async getAllThemes(): Promise<Theme[]> {
    console.log(`[THEME_SERVICE] Getting all themes from table: ${THEMES_TABLE}`);
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
      console.log(`[THEME_SERVICE] Error fetching themes from DynamoDB:`, error);
      console.error('Error fetching themes from DynamoDB:', error);
      throw new Error('Failed to fetch themes');
    }
  }

  async getThemeById(id: string): Promise<Theme | null> {
    console.log(`[THEME_SERVICE] Getting theme by ID: ${id} from table: ${THEMES_TABLE}`);
    try {
      const command = new GetCommand({
        TableName: THEMES_TABLE,
        Key: { themeId: id }
      });

      const result = await docClient.send(command);
      console.log(`[THEME_SERVICE] DynamoDB result for theme ${id}:`, result.Item ? 'found' : 'not found');
      if (!result.Item) return null;
      const { themeId, ...rest } = result.Item;
      const theme = {
        ...rest,
        id: themeId
      } as Theme;
      console.log(`[THEME_SERVICE] Theme ${id} loaded successfully with ${theme.variants?.length || 0} variants`);
      return theme;
    } catch (error) {
      console.log(`[THEME_SERVICE] Error fetching theme ${id} from DynamoDB:`, error);
      console.error('Error fetching theme from DynamoDB:', error);
      throw new Error('Failed to fetch theme');
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