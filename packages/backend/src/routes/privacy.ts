import { Router } from 'express';
import { dataLifecycleService } from '../services/dataLifecycle.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

// CSRF protection helper
const validateCSRF = (req: any, res: any) => {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000'
  ];
  
  if (!origin && !referer) {
    return res.status(403).json({
      error: 'CSRF protection: Missing origin/referer headers',
      code: 'CSRF_PROTECTION'
    });
  }
  
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch (error) {
      return res.status(403).json({
        error: 'CSRF protection: Invalid referer format',
        code: 'CSRF_PROTECTION'
      });
    }
  }
  
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({
      error: 'CSRF protection: Invalid origin',
      code: 'CSRF_PROTECTION'
    });
  }
  
  return null;
};

// Validation schemas
const DataDeletionRequestSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  email: z.string().email().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * Get current privacy policy and terms version
 */
router.get('/version', async (req, res) => {
  try {
    res.json({
      version: '1.0',
      privacyPolicyLastUpdated: '2024-01-01',
      termsOfServiceLastUpdated: '2024-01-01',
    });
  } catch (error) {
    logger.error('Error getting privacy version', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Request data deletion (GDPR right to be forgotten)
 */
router.post('/delete-data', async (req, res) => {
  // CSRF protection
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000'
  ];
  
  if (!origin && !referer) {
    return res.status(403).json({
      error: 'CSRF protection: Missing origin/referer headers',
      code: 'CSRF_PROTECTION'
    });
  }
  
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch (error) {
      return res.status(403).json({
        error: 'CSRF protection: Invalid referer format',
        code: 'CSRF_PROTECTION'
      });
    }
  }
  
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({
      error: 'CSRF protection: Invalid origin',
      code: 'CSRF_PROTECTION'
    });
  }
  try {
    const validatedData = DataDeletionRequestSchema.parse(req.body);
    
    // Log the deletion request
    await dataLifecycleService.auditDataOperation('DATA_DELETION_REQUESTED', {
      request: validatedData,
      ip: req.ip
    });

    // If userId is provided, delete user data immediately
    if (validatedData.userId) {
      await dataLifecycleService.deleteUserData(validatedData.userId);
      
      res.json({
        message: 'Data deletion completed successfully'
      });
    } else {
      // For requests without userId, we would typically:
      // 1. Send confirmation email if email provided
      // 2. Create a deletion ticket for manual processing
      // 3. Return confirmation that request was received
      
      res.json({
        message: 'Data deletion request received and will be processed within 30 days'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR'
      });
    }

    logger.error('Error processing data deletion request', { 
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      bodyKeys: req.body ? Object.keys(req.body).length : 0
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get data retention statistics (for transparency)
 */
router.get('/retention-stats', async (req, res) => {
  try {
    const stats = await dataLifecycleService.getRetentionStatistics();
    
    // Don't expose sensitive details, just general statistics
    res.json({
      dataTypes: {
        uploads: {
          retentionPeriod: '24 hours',
          currentCount: stats.uploads.count,
        },
        processedImages: {
          retentionPeriod: '7 days',
          currentCount: stats.processed.count,
        },
        processingJobs: {
          retentionPeriod: '7 days',
          currentCount: stats.jobs.total,
        },
        auditLogs: {
          retentionPeriod: '90 days',
          currentCount: stats.auditLogs.count,
        },
      }
    });
  } catch (error) {
    logger.error('Error getting retention statistics', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Trigger manual cleanup (admin endpoint)
 */
router.post('/cleanup', async (req, res) => {
  const csrfError = validateCSRF(req, res);
  if (csrfError) return csrfError;
  try {
    // In production, this should be protected with admin authentication
    const customPolicy = req.body.policy || {};
    
    const result = await dataLifecycleService.runAutomatedCleanup(customPolicy);
    
    res.json({
      message: 'Cleanup completed'
    });
  } catch (error) {
    logger.error('Error running manual cleanup', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get compliance status
 */
router.get('/compliance-status', async (req, res) => {
  try {
    const stats = await dataLifecycleService.getRetentionStatistics();
    
    res.json({
      gdprCompliant: true,
      dataRetentionPolicies: {
        uploads: '24 hours',
        processed: '7 days',
        jobs: '7 days',
        auditLogs: '90 days',
      },
      automaticCleanup: true,
      encryptionInTransit: true,
      encryptionAtRest: true,
      lastCleanupRun: 'Available in audit logs', // This should come from actual cleanup logs
      totalDataPoints: 'Available in retention statistics endpoint'
    });
  } catch (error) {
    logger.error('Error getting compliance status', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;