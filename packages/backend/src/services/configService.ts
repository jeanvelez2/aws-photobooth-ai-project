import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secretsmanager';
import { logger } from '../utils/logger.js';

export interface AppConfig {
  API_URL: string;
  FRONTEND_URL: string;
  CLOUDFRONT_URL: string;
  ALB_URL: string;
  S3_BUCKET: string;
  ENVIRONMENT: string;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;
  private secretsClient: SecretsManagerClient;

  private constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async getConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    const secretArn = process.env.APP_CONFIG_SECRET_ARN;
    if (!secretArn) {
      logger.warn('APP_CONFIG_SECRET_ARN not found, using fallback config');
      return this.getFallbackConfig();
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await this.secretsClient.send(command);
      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      this.config = JSON.parse(response.SecretString);
      logger.info('Loaded configuration from Secrets Manager');
      return this.config!;
    } catch (error) {
      logger.error('Failed to load config from Secrets Manager', { error });
      return this.getFallbackConfig();
    }
  }

  private getFallbackConfig(): AppConfig {
    return {
      API_URL: process.env.API_URL || 'http://localhost:3001/api',
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
      CLOUDFRONT_URL: process.env.CLOUDFRONT_URL || 'http://localhost:3000',
      ALB_URL: process.env.ALB_URL || 'http://localhost:3001',
      S3_BUCKET: process.env.S3_BUCKET_NAME || 'local-bucket',
      ENVIRONMENT: process.env.NODE_ENV || 'development',
    };
  }

  async getFrontendUrl(): Promise<string> {
    const config = await this.getConfig();
    return config.FRONTEND_URL;
  }

  async getApiUrl(): Promise<string> {
    const config = await this.getConfig();
    return config.API_URL;
  }
}

export const configService = ConfigService.getInstance();