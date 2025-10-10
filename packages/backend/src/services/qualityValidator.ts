import { logger } from '../utils/logger.js';
import { QualityMetrics } from './styleTransferEngine.js';
import sharp from 'sharp';

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  recommendations: string[];
}

export interface QualityIssue {
  type: QualityIssueType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedRegion?: BoundingBox;
  confidence: number;
}

export enum QualityIssueType {
  FACIAL_DISTORTION = 'FACIAL_DISTORTION',
  UNCANNY_VALLEY = 'UNCANNY_VALLEY',
  POOR_BLENDING = 'POOR_BLENDING',
  COLOR_MISMATCH = 'COLOR_MISMATCH',
  LIGHTING_INCONSISTENCY = 'LIGHTING_INCONSISTENCY',
  TEXTURE_ARTIFACTS = 'TEXTURE_ARTIFACTS',
  IDENTITY_LOSS = 'IDENTITY_LOSS',
  LOW_RESOLUTION = 'LOW_RESOLUTION'
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Quality Validator
 * Validates the quality and realism of style transfer results
 */
export class QualityValidator {
  private qualityThresholds = {
    overall: 0.7,
    facialProportions: 0.8,
    skinTexture: 0.6,
    lightingConsistency: 0.7,
    edgeBlending: 0.75,
    colorHarmony: 0.65,
    identityPreservation: 0.8
  };

  /**
   * Validate quality of processed result
   */
  async validate(result: Buffer, original: Buffer): Promise<QualityMetrics> {
    logger.debug('Starting quality validation');

    try {
      const [resultMetrics, originalMetrics] = await Promise.all([
        this.analyzeImage(result),
        this.analyzeImage(original)
      ]);

      const qualityMetrics: QualityMetrics = {
        overall: 0,
        facialProportions: await this.validateFacialProportions(result, original),
        skinTexture: await this.validateSkinTexture(result),
        lightingConsistency: await this.validateLightingConsistency(result),
        edgeBlending: await this.validateEdgeBlending(result),
        colorHarmony: await this.validateColorHarmony(result),
        identityPreservation: await this.validateIdentityPreservation(result, original)
      };

      // Calculate overall score as weighted average
      qualityMetrics.overall = this.calculateOverallScore(qualityMetrics);

      logger.debug('Quality validation completed', {
        overall: qualityMetrics.overall,
        facialProportions: qualityMetrics.facialProportions,
        identityPreservation: qualityMetrics.identityPreservation
      });

      return qualityMetrics;

    } catch (error) {
      logger.error('Quality validation failed', { error });
      
      // Return default metrics on failure
      return {
        overall: 0.5,
        facialProportions: 0.5,
        skinTexture: 0.5,
        lightingConsistency: 0.5,
        edgeBlending: 0.5,
        colorHarmony: 0.5,
        identityPreservation: 0.5
      };
    }
  }

  /**
   * Validate facial proportions
   */
  private async validateFacialProportions(result: Buffer, original: Buffer): Promise<number> {
    // Simplified implementation - in reality would use facial landmark detection
    try {
      const [resultStats, originalStats] = await Promise.all([
        sharp(result).stats(),
        sharp(original).stats()
      ]);

      // Compare image statistics as a proxy for facial proportion consistency
      const channelDiffs = resultStats.channels.map((channel, i) => {
        const originalChannel = originalStats.channels[i];
        return Math.abs(channel.mean - originalChannel.mean) / 255;
      });

      const avgDiff = channelDiffs.reduce((sum, diff) => sum + diff, 0) / channelDiffs.length;
      return Math.max(0, 1 - avgDiff * 2); // Convert to 0-1 score

    } catch (error) {
      logger.warn('Facial proportion validation failed', { error });
      return 0.7; // Default score
    }
  }

  /**
   * Validate skin texture quality
   */
  private async validateSkinTexture(result: Buffer): Promise<number> {
    try {
      const stats = await sharp(result).stats();
      
      // Check for texture smoothness and detail preservation
      const variance = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;
      
      // Normalize variance to 0-1 score (higher variance = better texture detail)
      const textureScore = Math.min(1, variance / 50);
      
      return textureScore;

    } catch (error) {
      logger.warn('Skin texture validation failed', { error });
      return 0.6;
    }
  }

  /**
   * Validate lighting consistency
   */
  private async validateLightingConsistency(result: Buffer): Promise<number> {
    try {
      // Analyze brightness distribution
      const { channels } = await sharp(result).stats();
      
      // Check for consistent lighting (not too much variation in brightness)
      const brightnessVariation = channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
      
      // Lower variation = better lighting consistency
      const consistencyScore = Math.max(0, 1 - brightnessVariation / 100);
      
      return consistencyScore;

    } catch (error) {
      logger.warn('Lighting consistency validation failed', { error });
      return 0.7;
    }
  }

  /**
   * Validate edge blending quality
   */
  private async validateEdgeBlending(result: Buffer): Promise<number> {
    try {
      // Apply edge detection to check for harsh transitions
      const edges = await sharp(result)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .raw()
        .toBuffer();

      // Count strong edges (potential blending issues)
      let strongEdges = 0;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i] > 128) { // Threshold for strong edges
          strongEdges++;
        }
      }

      const edgeRatio = strongEdges / edges.length;
      const blendingScore = Math.max(0, 1 - edgeRatio * 10); // Penalize too many strong edges

      return blendingScore;

    } catch (error) {
      logger.warn('Edge blending validation failed', { error });
      return 0.75;
    }
  }

  /**
   * Validate color harmony
   */
  private async validateColorHarmony(result: Buffer): Promise<number> {
    try {
      const stats = await sharp(result).stats();
      
      // Check color balance across channels
      const means = stats.channels.map(channel => channel.mean);
      const maxMean = Math.max(...means);
      const minMean = Math.min(...means);
      
      // Good color harmony has balanced channels
      const colorBalance = 1 - (maxMean - minMean) / 255;
      
      return Math.max(0, colorBalance);

    } catch (error) {
      logger.warn('Color harmony validation failed', { error });
      return 0.65;
    }
  }

  /**
   * Validate identity preservation
   */
  private async validateIdentityPreservation(result: Buffer, original: Buffer): Promise<number> {
    try {
      // Simplified implementation using image similarity
      const [resultStats, originalStats] = await Promise.all([
        sharp(result).resize(256, 256).greyscale().raw().toBuffer(),
        sharp(original).resize(256, 256).greyscale().raw().toBuffer()
      ]);

      // Calculate structural similarity
      let similarity = 0;
      const totalPixels = resultStats.length;
      
      for (let i = 0; i < totalPixels; i++) {
        const diff = Math.abs(resultStats[i] - originalStats[i]) / 255;
        similarity += 1 - diff;
      }
      
      return similarity / totalPixels;

    } catch (error) {
      logger.warn('Identity preservation validation failed', { error });
      return 0.8;
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(metrics: QualityMetrics): number {
    const weights = {
      facialProportions: 0.25,
      skinTexture: 0.15,
      lightingConsistency: 0.15,
      edgeBlending: 0.20,
      colorHarmony: 0.10,
      identityPreservation: 0.15
    };

    return (
      metrics.facialProportions * weights.facialProportions +
      metrics.skinTexture * weights.skinTexture +
      metrics.lightingConsistency * weights.lightingConsistency +
      metrics.edgeBlending * weights.edgeBlending +
      metrics.colorHarmony * weights.colorHarmony +
      metrics.identityPreservation * weights.identityPreservation
    );
  }

  /**
   * Analyze image for quality metrics
   */
  private async analyzeImage(image: Buffer) {
    return await sharp(image).stats();
  }

  /**
   * Check if quality meets minimum thresholds
   */
  isQualityAcceptable(metrics: QualityMetrics): boolean {
    return (
      metrics.overall >= this.qualityThresholds.overall &&
      metrics.facialProportions >= this.qualityThresholds.facialProportions &&
      metrics.identityPreservation >= this.qualityThresholds.identityPreservation
    );
  }

  /**
   * Get quality recommendations
   */
  getQualityRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.facialProportions < this.qualityThresholds.facialProportions) {
      recommendations.push('Facial proportions need improvement - consider adjusting style intensity');
    }

    if (metrics.skinTexture < this.qualityThresholds.skinTexture) {
      recommendations.push('Skin texture quality is low - enable advanced texture features');
    }

    if (metrics.lightingConsistency < this.qualityThresholds.lightingConsistency) {
      recommendations.push('Lighting inconsistency detected - improve lighting adaptation');
    }

    if (metrics.edgeBlending < this.qualityThresholds.edgeBlending) {
      recommendations.push('Edge blending needs improvement - use higher quality processing');
    }

    if (metrics.identityPreservation < this.qualityThresholds.identityPreservation) {
      recommendations.push('Identity preservation is low - reduce style intensity or use different approach');
    }

    return recommendations;
  }
}