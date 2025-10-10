import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ModelStructure {
  theme: string;
  models: {
    name: string;
    description: string;
    versions: string[];
  }[];
}

const MODEL_STRUCTURES: ModelStructure[] = [
  {
    theme: 'barbarian',
    models: [
      {
        name: 'barbarian-style-transfer',
        description: 'Main style transfer model for barbarian theme',
        versions: ['v1.0', 'latest'],
      },
      {
        name: 'barbarian-texture-enhancer',
        description: 'Texture enhancement model for rugged skin effects',
        versions: ['v1.0', 'latest'],
      },
    ],
  },
  {
    theme: 'greek',
    models: [
      {
        name: 'greek-classical-style',
        description: 'Classical Greek style transfer model',
        versions: ['v1.0', 'latest'],
      },
      {
        name: 'greek-proportion-adjuster',
        description: 'Golden ratio proportion adjustment model',
        versions: ['v1.0', 'latest'],
      },
    ],
  },
  {
    theme: 'mystic',
    models: [
      {
        name: 'mystic-ethereal-style',
        description: 'Ethereal style transfer for mystic theme',
        versions: ['v1.0', 'latest'],
      },
      {
        name: 'mystic-glow-enhancer',
        description: 'Magical glow and effect enhancement model',
        versions: ['v1.0', 'latest'],
      },
    ],
  },
  {
    theme: 'anime',
    models: [
      {
        name: 'anime-style-transfer',
        description: 'Anime style transfer model',
        versions: ['v1.0', 'latest'],
      },
      {
        name: 'anime-eye-enhancer',
        description: 'Eye enlargement and stylization model',
        versions: ['v1.0', 'latest'],
      },
    ],
  },
];

class ModelStorageSetup {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = process.env.S3_BUCKET_NAME!;

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }
  }

  /**
   * Set up the complete model directory structure in S3
   */
  async setupModelStructure(): Promise<void> {
    try {
      logger.info('Setting up model storage structure in S3...');
      
      // Check if bucket exists and is accessible
      await this.verifyBucketAccess();
      
      // Create directory structure for each theme
      for (const themeStructure of MODEL_STRUCTURES) {
        await this.setupThemeStructure(themeStructure);
      }
      
      // Create metadata files
      await this.createMetadataFiles();
      
      logger.info('Model storage structure setup completed successfully');
      
    } catch (error) {
      logger.error('Failed to setup model storage structure:', error);
      throw error;
    }
  }

  /**
   * Verify S3 bucket access
   */
  private async verifyBucketAccess(): Promise<void> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'models/',
        MaxKeys: 1,
      });
      
      await this.s3Client.send(command);
      logger.info(`S3 bucket access verified: ${this.bucketName}`);
      
    } catch (error) {
      logger.error(`Failed to access S3 bucket ${this.bucketName}:`, error);
      throw new Error(`S3 bucket access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up directory structure for a specific theme
   */
  private async setupThemeStructure(themeStructure: ModelStructure): Promise<void> {
    try {
      logger.info(`Setting up structure for theme: ${themeStructure.theme}`);
      
      for (const model of themeStructure.models) {
        for (const version of model.versions) {
          // Create directory structure by uploading placeholder files
          const modelPath = `models/${themeStructure.theme}/${model.name}/${version}/`;
          
          // Create README file for the model
          const readmeContent = this.generateModelReadme(themeStructure.theme, model, version);
          await this.uploadFile(`${modelPath}README.md`, readmeContent, 'text/markdown');
          
          // Create placeholder for model file (will be replaced with actual model)
          const placeholderContent = `# Placeholder for ${model.name}.onnx\n\nThis file will be replaced with the actual ONNX model file.\n\nModel: ${model.name}\nTheme: ${themeStructure.theme}\nVersion: ${version}\nDescription: ${model.description}`;
          await this.uploadFile(`${modelPath}${model.name}.onnx.placeholder`, placeholderContent, 'text/plain');
          
          // Create model configuration file
          const configContent = this.generateModelConfig(themeStructure.theme, model, version);
          await this.uploadFile(`${modelPath}config.json`, JSON.stringify(configContent, null, 2), 'application/json');
          
          logger.info(`Created structure for ${themeStructure.theme}/${model.name}/${version}`);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to setup theme structure for ${themeStructure.theme}:`, error);
      throw error;
    }
  }

  /**
   * Create metadata files for the model storage system
   */
  private async createMetadataFiles(): Promise<void> {
    try {
      // Create main models index
      const modelsIndex = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        themes: MODEL_STRUCTURES.map(theme => ({
          name: theme.theme,
          models: theme.models.map(model => ({
            name: model.name,
            description: model.description,
            versions: model.versions,
            path: `models/${theme.theme}/${model.name}/`,
          })),
        })),
      };
      
      await this.uploadFile('models/index.json', JSON.stringify(modelsIndex, null, 2), 'application/json');
      
      // Create theme-specific index files
      for (const themeStructure of MODEL_STRUCTURES) {
        const themeIndex = {
          theme: themeStructure.theme,
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          models: themeStructure.models.map(model => ({
            name: model.name,
            description: model.description,
            versions: model.versions.map(version => ({
              version,
              path: `models/${themeStructure.theme}/${model.name}/${version}/`,
              modelFile: `${model.name}.onnx`,
              configFile: 'config.json',
            })),
          })),
        };
        
        await this.uploadFile(`models/${themeStructure.theme}/index.json`, JSON.stringify(themeIndex, null, 2), 'application/json');
      }
      
      // Create deployment guide
      const deploymentGuide = this.generateDeploymentGuide();
      await this.uploadFile('models/DEPLOYMENT.md', deploymentGuide, 'text/markdown');
      
      logger.info('Created metadata files');
      
    } catch (error) {
      logger.error('Failed to create metadata files:', error);
      throw error;
    }
  }

  /**
   * Upload a file to S3
   */
  private async uploadFile(key: string, content: string, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      });
      
      await this.s3Client.send(command);
      logger.debug(`Uploaded: s3://${this.bucketName}/${key}`);
      
    } catch (error) {
      logger.error(`Failed to upload ${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate README content for a model
   */
  private generateModelReadme(theme: string, model: any, version: string): string {
    return `# ${model.name} - ${version}

## Description
${model.description}

## Theme
${theme}

## Version
${version}

## Files
- \`${model.name}.onnx\` - The main ONNX model file
- \`config.json\` - Model configuration and metadata
- \`README.md\` - This documentation file

## Usage
This model is automatically loaded by the AI Style Transfer system when processing images with the ${theme} theme.

## Model Specifications
- Framework: ONNX Runtime
- Input Format: RGB image tensor (1, 3, H, W)
- Output Format: Styled image tensor (1, 3, H, W)
- Recommended Input Size: 512x512 pixels

## Performance
- GPU Memory Required: ~2GB
- Inference Time: ~2-5 seconds (GPU)
- Supported Devices: CUDA-enabled GPUs, CPU fallback

## Version History
- ${version}: Initial version

## Support
For issues with this model, please check the deployment logs or contact the development team.
`;
  }

  /**
   * Generate model configuration
   */
  private generateModelConfig(theme: string, model: any, version: string): any {
    return {
      modelName: model.name,
      theme: theme,
      version: version,
      description: model.description,
      framework: 'onnx',
      inputSpec: {
        name: 'input_image',
        shape: [1, 3, 512, 512],
        type: 'float32',
        format: 'NCHW',
        normalization: {
          mean: [0.485, 0.456, 0.406],
          std: [0.229, 0.224, 0.225],
        },
      },
      outputSpec: {
        name: 'output_image',
        shape: [1, 3, 512, 512],
        type: 'float32',
        format: 'NCHW',
      },
      performance: {
        gpuMemoryMB: 2048,
        estimatedInferenceTimeMs: 3000,
        batchSize: 1,
      },
      preprocessing: [
        'resize_to_512x512',
        'normalize_rgb',
        'convert_to_tensor',
      ],
      postprocessing: [
        'denormalize_rgb',
        'clamp_values',
        'convert_to_image',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate deployment guide
   */
  private generateDeploymentGuide(): string {
    return `# Model Deployment Guide

## Overview
This guide explains how to deploy neural network models for the AI Style Transfer system.

## Directory Structure
\`\`\`
models/
├── index.json                 # Main models index
├── DEPLOYMENT.md             # This file
├── barbarian/
│   ├── index.json           # Theme-specific index
│   ├── barbarian-style-transfer/
│   │   ├── v1.0/
│   │   │   ├── barbarian-style-transfer.onnx
│   │   │   ├── config.json
│   │   │   └── README.md
│   │   └── latest/          # Symlink or copy of latest version
│   └── barbarian-texture-enhancer/
├── greek/
├── mystic/
└── anime/
\`\`\`

## Model Requirements
- Format: ONNX (.onnx files)
- Input: RGB image tensor (1, 3, H, W)
- Output: Styled image tensor (1, 3, H, W)
- Recommended size: 512x512 pixels
- GPU memory: < 4GB per model

## Deployment Steps

### 1. Prepare Model Files
- Convert your trained model to ONNX format
- Test the model with sample inputs
- Optimize for inference (quantization, pruning)

### 2. Upload Model
\`\`\`bash
aws s3 cp your-model.onnx s3://your-bucket/models/theme/model-name/version/model-name.onnx
\`\`\`

### 3. Update Configuration
- Update the config.json file with model specifications
- Update the theme index.json file
- Update the main index.json file

### 4. Test Deployment
- Use the model loading utilities to test the model
- Verify inference works correctly
- Check performance metrics

## Model Versioning
- Use semantic versioning (v1.0, v1.1, v2.0)
- Always maintain a 'latest' version
- Keep previous versions for rollback capability

## Performance Optimization
- Use GPU instances for inference
- Implement model caching
- Consider batch processing for multiple requests
- Monitor GPU memory usage

## Monitoring
- Track model loading times
- Monitor inference performance
- Log errors and failures
- Set up alerts for model issues

## Troubleshooting
- Check model file integrity
- Verify ONNX runtime compatibility
- Monitor GPU memory usage
- Check input/output tensor shapes

## Security
- All models are stored with server-side encryption
- Access is controlled through IAM policies
- Models are validated before deployment
`;
  }

  /**
   * List current model structure
   */
  async listCurrentStructure(): Promise<void> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'models/',
        Delimiter: '/',
      });
      
      const response = await this.s3Client.send(command);
      
      logger.info('Current model storage structure:');
      
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          logger.info(`  ${prefix.Prefix}`);
        }
      }
      
      if (response.Contents) {
        for (const object of response.Contents) {
          logger.info(`  ${object.Key} (${object.Size} bytes)`);
        }
      }
      
    } catch (error) {
      logger.error('Failed to list current structure:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    const setup = new ModelStorageSetup();
    
    // List current structure
    logger.info('Current structure:');
    await setup.listCurrentStructure();
    
    // Setup new structure
    await setup.setupModelStructure();
    
    // List updated structure
    logger.info('Updated structure:');
    await setup.listCurrentStructure();
    
    logger.info('Model storage setup completed successfully!');
    
  } catch (error) {
    logger.error('Model storage setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ModelStorageSetup };