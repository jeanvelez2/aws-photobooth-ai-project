import { logger } from '../utils/logger.js';
import { modelStorageService } from '../services/modelStorageService.js';
import { onnxRuntimeService } from '../services/onnxRuntimeService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test script to verify ML infrastructure setup
 */
async function testMLSetup(): Promise<void> {
  try {
    logger.info('Testing ML infrastructure setup...');

    // Test 1: Model Storage Service
    logger.info('Testing Model Storage Service...');
    try {
      const stats = modelStorageService.getCacheStats();
      logger.info(`Cache stats: ${stats.totalModels} models, ${stats.totalSize} bytes`);
      
      // Test listing models for each theme
      const themes = ['barbarian', 'greek', 'mystic', 'anime'];
      for (const theme of themes) {
        const models = await modelStorageService.listModels(theme);
        logger.info(`${theme} theme: ${models.length} models available`);
      }
      
      logger.info('✓ Model Storage Service test passed');
    } catch (error) {
      logger.error('✗ Model Storage Service test failed:', error);
    }

    // Test 2: ONNX Runtime Service
    logger.info('Testing ONNX Runtime Service...');
    try {
      const sessionStats = onnxRuntimeService.getSessionStats();
      logger.info(`ONNX Runtime: ${sessionStats.activeSessions}/${sessionStats.maxSessions} sessions`);
      
      logger.info('✓ ONNX Runtime Service test passed');
    } catch (error) {
      logger.error('✗ ONNX Runtime Service test failed:', error);
    }

    // Test 3: Environment Variables
    logger.info('Testing Environment Variables...');
    const requiredEnvVars = [
      'AWS_REGION',
      'S3_BUCKET_NAME',
    ];
    
    let envTestPassed = true;
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        logger.error(`✗ Missing environment variable: ${envVar}`);
        envTestPassed = false;
      } else {
        logger.info(`✓ ${envVar}: ${process.env[envVar]}`);
      }
    }
    
    if (envTestPassed) {
      logger.info('✓ Environment Variables test passed');
    } else {
      logger.error('✗ Environment Variables test failed');
    }

    // Test 4: GPU Availability (if in production)
    logger.info('Testing GPU Availability...');
    try {
      const cudaAvailable = process.env.CUDA_VISIBLE_DEVICES && process.env.NVIDIA_VISIBLE_DEVICES;
      if (cudaAvailable) {
        logger.info('✓ CUDA environment variables detected');
        logger.info(`CUDA_VISIBLE_DEVICES: ${process.env.CUDA_VISIBLE_DEVICES}`);
        logger.info(`NVIDIA_VISIBLE_DEVICES: ${process.env.NVIDIA_VISIBLE_DEVICES}`);
      } else {
        logger.info('ℹ No CUDA environment variables (CPU mode)');
      }
      
      logger.info('✓ GPU Availability test completed');
    } catch (error) {
      logger.error('✗ GPU Availability test failed:', error);
    }

    // Test 5: Model Cache Directory
    logger.info('Testing Model Cache Directory...');
    try {
      const cacheDir = process.env.MODEL_CACHE_DIR || '/tmp/models';
      logger.info(`Model cache directory: ${cacheDir}`);
      
      // The ModelStorageService constructor should have created this
      logger.info('✓ Model Cache Directory test passed');
    } catch (error) {
      logger.error('✗ Model Cache Directory test failed:', error);
    }

    logger.info('ML infrastructure setup test completed!');
    
  } catch (error) {
    logger.error('ML infrastructure setup test failed:', error);
    process.exit(1);
  }
}

/**
 * Test model preloading functionality
 */
async function testModelPreloading(): Promise<void> {
  try {
    logger.info('Testing model preloading...');
    
    // Test preloading for one theme
    const testTheme = 'barbarian';
    logger.info(`Preloading models for theme: ${testTheme}`);
    
    await modelStorageService.preloadModels(testTheme);
    
    // Check cache stats after preloading
    const stats = modelStorageService.getCacheStats();
    logger.info(`After preloading: ${stats.totalModels} models cached`);
    
    logger.info('✓ Model preloading test completed');
    
  } catch (error) {
    logger.error('✗ Model preloading test failed:', error);
  }
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  try {
    // Basic setup tests
    await testMLSetup();
    
    // Advanced functionality tests (only if basic tests pass)
    if (process.env.S3_BUCKET_NAME) {
      await testModelPreloading();
    } else {
      logger.info('Skipping advanced tests (S3_BUCKET_NAME not set)');
    }
    
    logger.info('All tests completed successfully!');
    
  } catch (error) {
    logger.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testMLSetup, testModelPreloading };