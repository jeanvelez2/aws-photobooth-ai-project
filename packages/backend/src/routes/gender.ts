import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { genderAdaptiveThemeService } from '../services/genderAdaptiveThemeService.js';
import { faceDetectionService } from '../services/faceDetectionService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const genderAnalysisSchema = z.object({
  imageKey: z.string().min(1, 'Image key is required'),
  themeId: z.string().min(1, 'Theme ID is required'),
});

/**
 * POST /api/gender/analyze
 * Analyze gender and recommend theme variant
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const validationResult = genderAnalysisSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { imageKey, themeId } = validationResult.data;

    // Detect faces and gender
    const faceDetection = await faceDetectionService.detectFaces(imageKey);
    
    if (faceDetection.faces.length === 0) {
      return res.status(400).json({
        error: 'No face detected',
        code: 'NO_FACE_DETECTED',
      });
    }

    // Get gender-based recommendation
    const recommendation = genderAdaptiveThemeService.selectVariantByGender(
      themeId, 
      faceDetection
    );

    const primaryFace = faceDetection.faces[0];

    logger.info('Gender analysis completed', {
      imageKey,
      themeId,
      detectedGender: primaryFace.gender.value,
      confidence: primaryFace.gender.confidence,
      recommendedVariant: recommendation.recommendedVariantId,
    });

    res.json({
      success: true,
      data: {
        detectedGender: primaryFace.gender.value,
        confidence: primaryFace.gender.confidence,
        ageRange: primaryFace.ageRange,
        recommendation: {
          variantId: recommendation.recommendedVariantId,
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          alternatives: recommendation.alternativeVariants,
        },
      },
    });

  } catch (error) {
    logger.error('Gender analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Gender analysis failed',
      code: 'ANALYSIS_ERROR',
    });
  }
});

/**
 * GET /api/gender/variants/:themeId
 * Get variants grouped by gender for a theme
 */
router.get('/variants/:themeId', async (req: Request, res: Response) => {
  try {
    const { themeId } = req.params;
    
    const variants = genderAdaptiveThemeService.getVariantsByGender(themeId);
    
    res.json({
      success: true,
      data: variants,
    });

  } catch (error) {
    logger.error('Failed to get variants by gender', {
      themeId: req.params.themeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(404).json({
      error: 'Theme not found',
      code: 'THEME_NOT_FOUND',
    });
  }
});

/**
 * GET /api/gender/distribution
 * Get gender distribution across all themes
 */
router.get('/distribution', async (_req: Request, res: Response) => {
  try {
    const distribution = genderAdaptiveThemeService.getGenderDistribution();
    
    res.json({
      success: true,
      data: distribution,
    });

  } catch (error) {
    logger.error('Failed to get gender distribution', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Failed to get distribution',
      code: 'DISTRIBUTION_ERROR',
    });
  }
});

export default router;