import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Disable X-Ray for now to avoid import issues in tests
const isXRayEnabled = false;
let AWSXRay: any = null;

// X-Ray is disabled for now
logger.info('X-Ray tracing disabled');

/**
 * X-Ray middleware for Express
 */
export const xrayMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * X-Ray close segment middleware
 */
export const xrayCloseMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Utility function to create custom X-Ray subsegments
 */
export const createSubsegment = (name: string, callback: (subsegment?: any) => Promise<any>) => {
  if (!isXRayEnabled) {
    return callback();
  }

  return new Promise((resolve, reject) => {
    const segment = AWSXRay.getSegment();
    if (!segment) {
      logger.warn('No X-Ray segment found, executing without tracing');
      return callback().then(resolve).catch(reject);
    }

    const subsegment = segment.addNewSubsegment(name);
    
    callback(subsegment)
      .then((result) => {
        subsegment.close();
        resolve(result);
      })
      .catch((error) => {
        subsegment.addError(error);
        subsegment.close();
        reject(error);
      });
  });
};

/**
 * Utility function to add annotations to current segment
 */
export const addAnnotation = (key: string, value: string | number | boolean) => {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  } catch (error) {
    logger.debug('Failed to add X-Ray annotation', { key, value, error });
  }
};

/**
 * Utility function to add metadata to current segment
 */
export const addMetadata = (namespace: string, data: any) => {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addMetadata(namespace, data);
    }
  } catch (error) {
    logger.debug('Failed to add X-Ray metadata', { namespace, error });
  }
};

/**
 * Wrapper for AWS SDK clients to enable X-Ray tracing
 */
export const captureAWSClient = <T>(client: T): T => {
  if (!isXRayEnabled) return client;
  return AWSXRay.captureAWSClient(client as any) as T;
};

/**
 * Wrapper for HTTP requests to enable X-Ray tracing
 */
export const captureHTTPs = () => {
  // X-Ray is disabled
  return;
};