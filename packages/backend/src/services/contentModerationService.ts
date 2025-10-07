import { logger } from '../utils/logger.js';

export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  flaggedCategories: string[];
  reason?: string;
}

export class ContentModerationService {
  private readonly bannedTerms = [
    // Racial/ethnic slurs and discriminatory terms
    'racist', 'racial slur', 'ethnic slur', 'discriminatory',
    // Gender-based discrimination
    'sexist', 'misogynistic', 'gender discrimination',
    // General offensive content
    'offensive', 'derogatory', 'insulting', 'degrading',
    // Explicit content
    'explicit', 'nsfw', 'sexual', 'nude', 'naked',
    // Violence and hate
    'violent', 'hate', 'harmful', 'threatening',
    // Stereotypes
    'stereotype', 'prejudice', 'bias'
  ];

  private readonly appropriateTerms = [
    'heroic', 'noble', 'dignified', 'respectful', 'inclusive',
    'professional', 'artistic', 'creative', 'fantasy', 'magical',
    'epic', 'dramatic', 'cinematic', 'high quality'
  ];

  /**
   * Moderate text prompts before sending to Bedrock
   */
  moderatePrompt(prompt: string): ModerationResult {
    const lowerPrompt = prompt.toLowerCase();
    const flaggedCategories: string[] = [];
    let confidence = 1.0;

    // Check for banned terms
    for (const term of this.bannedTerms) {
      if (lowerPrompt.includes(term.toLowerCase())) {
        flaggedCategories.push(`inappropriate_language: ${term}`);
        confidence = 0.0;
      }
    }

    // Check for appropriate content indicators
    let appropriateScore = 0;
    for (const term of this.appropriateTerms) {
      if (lowerPrompt.includes(term.toLowerCase())) {
        appropriateScore += 0.1;
      }
    }

    confidence = Math.min(1.0, confidence + appropriateScore);

    const isAppropriate = flaggedCategories.length === 0 && confidence > 0.7;

    if (!isAppropriate) {
      logger.warn('Content moderation flagged prompt', {
        flaggedCategories,
        confidence,
        promptLength: prompt.length
      });
    }

    return {
      isAppropriate,
      confidence,
      flaggedCategories,
      reason: flaggedCategories.length > 0 
        ? `Content flagged for: ${flaggedCategories.join(', ')}`
        : undefined
    };
  }

  /**
   * Sanitize and enhance prompts for bias prevention
   */
  sanitizePrompt(prompt: string): string {
    let sanitized = prompt;

    // Remove any potentially problematic terms
    for (const term of this.bannedTerms) {
      const regex = new RegExp(term, 'gi');
      sanitized = sanitized.replace(regex, '');
    }

    // Clean up extra spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Add bias prevention terms if not already present
    const biasPreventionTerms = 'inclusive, respectful, appropriate';
    if (!sanitized.toLowerCase().includes('inclusive')) {
      sanitized += `, ${biasPreventionTerms}`;
    }

    return sanitized;
  }

  /**
   * Validate theme and action combinations for appropriateness
   */
  validateThemeAction(themeId: string, action: string, mood: string): ModerationResult {
    const inappropriateCombinations = [
      // Add specific combinations that should be blocked
      { theme: '*', action: 'violent', mood: '*' },
      { theme: '*', action: 'aggressive', mood: 'dark' }
    ];

    for (const combo of inappropriateCombinations) {
      if ((combo.theme === '*' || combo.theme === themeId) &&
          (combo.action === '*' || combo.action === action) &&
          (combo.mood === '*' || combo.mood === mood)) {
        return {
          isAppropriate: false,
          confidence: 0.0,
          flaggedCategories: ['inappropriate_combination'],
          reason: `Theme-action-mood combination not allowed: ${themeId}-${action}-${mood}`
        };
      }
    }

    return {
      isAppropriate: true,
      confidence: 1.0,
      flaggedCategories: []
    };
  }
}

export const contentModerationService = new ContentModerationService();