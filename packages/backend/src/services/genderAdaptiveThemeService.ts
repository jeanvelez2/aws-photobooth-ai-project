import { mockThemes } from '../data/mockThemes.js';
import { FaceDetectionResult } from './faceDetectionService.js';
import { logger } from '../utils/logger.js';

export interface GenderAdaptiveSelection {
  recommendedVariantId: string;
  confidence: number;
  reason: string;
  alternativeVariants: string[];
}

export class GenderAdaptiveThemeService {
  
  /**
   * Select the best theme variant based on detected gender
   */
  selectVariantByGender(
    themeId: string, 
    faceDetection: FaceDetectionResult
  ): GenderAdaptiveSelection {
    const theme = mockThemes.find(t => t.id === themeId);
    
    if (!theme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    const primaryFace = faceDetection.faces[0];
    if (!primaryFace) {
      throw new Error('No face detected for gender-based selection');
    }

    const detectedGender = primaryFace.gender.value;
    const genderConfidence = primaryFace.gender.confidence;

    // Find variants matching the detected gender
    const matchingVariants = theme.variants.filter(v => 
      (v as any).gender === detectedGender
    );

    // Find variants for opposite gender as alternatives
    const alternativeVariants = theme.variants.filter(v => 
      (v as any).gender !== detectedGender
    ).map(v => v.id);

    let recommendedVariantId: string;
    let confidence: number;
    let reason: string;

    if (matchingVariants.length > 0) {
      // Use gender-appropriate variant
      recommendedVariantId = matchingVariants[0].id;
      confidence = genderConfidence;
      reason = `Selected ${detectedGender.toLowerCase()} variant based on face analysis (${genderConfidence.toFixed(1)}% confidence)`;
    } else {
      // Fallback to first available variant
      recommendedVariantId = theme.variants[0].id;
      confidence = 50; // Low confidence for fallback
      reason = `No ${detectedGender.toLowerCase()} variant available, using default`;
    }

    logger.info('Gender-adaptive theme selection completed', {
      themeId,
      detectedGender,
      genderConfidence,
      recommendedVariantId,
      alternativeCount: alternativeVariants.length,
    });

    return {
      recommendedVariantId,
      confidence,
      reason,
      alternativeVariants,
    };
  }

  /**
   * Get all variants grouped by gender for a theme
   */
  getVariantsByGender(themeId: string): {
    male: Array<{ id: string; name: string; description: string }>;
    female: Array<{ id: string; name: string; description: string }>;
    neutral: Array<{ id: string; name: string; description: string }>;
  } {
    const theme = mockThemes.find(t => t.id === themeId);
    
    if (!theme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    const male = theme.variants
      .filter(v => (v as any).gender === 'Male')
      .map(v => ({ id: v.id, name: v.name, description: v.description }));

    const female = theme.variants
      .filter(v => (v as any).gender === 'Female')
      .map(v => ({ id: v.id, name: v.name, description: v.description }));

    const neutral = theme.variants
      .filter(v => !(v as any).gender)
      .map(v => ({ id: v.id, name: v.name, description: v.description }));

    return { male, female, neutral };
  }

  /**
   * Get gender distribution across all themes
   */
  getGenderDistribution(): {
    totalVariants: number;
    maleVariants: number;
    femaleVariants: number;
    neutralVariants: number;
    byTheme: Record<string, { male: number; female: number; neutral: number }>;
  } {
    let totalVariants = 0;
    let maleVariants = 0;
    let femaleVariants = 0;
    let neutralVariants = 0;
    
    const byTheme: Record<string, { male: number; female: number; neutral: number }> = {};

    mockThemes.forEach(theme => {
      const themeStats = { male: 0, female: 0, neutral: 0 };
      
      theme.variants.forEach(variant => {
        totalVariants++;
        const gender = (variant as any).gender;
        
        if (gender === 'Male') {
          maleVariants++;
          themeStats.male++;
        } else if (gender === 'Female') {
          femaleVariants++;
          themeStats.female++;
        } else {
          neutralVariants++;
          themeStats.neutral++;
        }
      });
      
      byTheme[theme.id] = themeStats;
    });

    return {
      totalVariants,
      maleVariants,
      femaleVariants,
      neutralVariants,
      byTheme,
    };
  }
}

export const genderAdaptiveThemeService = new GenderAdaptiveThemeService();