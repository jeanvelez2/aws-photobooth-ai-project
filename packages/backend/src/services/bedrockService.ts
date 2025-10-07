import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { contentModerationService } from './contentModerationService.js';

export interface PoseGenerationOptions {
  themeId: string;
  variantId?: string;
  action: string;
  mood: string;
  userFaceBuffer: Buffer;
  templateBuffer: Buffer;
}

export interface GeneratedPoseResult {
  imageBuffer: Buffer;
  prompt: string;
  model: string;
}

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: config.aws.region });
  }

  async generatePoseVariation(options: PoseGenerationOptions): Promise<GeneratedPoseResult> {
    try {
      // Validate theme-action-mood combination
      const themeValidation = contentModerationService.validateThemeAction(
        options.themeId, 
        options.action, 
        options.mood
      );
      
      if (!themeValidation.isAppropriate) {
        throw new Error(`Content moderation blocked request: ${themeValidation.reason}`);
      }

      const rawPrompt = this.buildPrompt(options);
      
      // Moderate and sanitize the prompt
      const moderation = contentModerationService.moderatePrompt(rawPrompt);
      if (!moderation.isAppropriate) {
        throw new Error(`Content moderation flagged prompt: ${moderation.reason}`);
      }
      
      const prompt = contentModerationService.sanitizePrompt(rawPrompt);
      
      // Use Stable Diffusion XL for image generation
      const modelId = 'stability.stable-diffusion-xl-v1';
      
      const requestBody = {
        text_prompts: [
          {
            text: prompt,
            weight: 1
          },
          {
            text: 'blurry, low quality, distorted face, multiple faces, cartoon, racist, sexist, discriminatory, offensive, inappropriate, explicit, nsfw, violence, hate, stereotypes, bias, prejudice, harmful content, derogatory, insulting, degrading',
            weight: -1
          }
        ],
        cfg_scale: 10,
        seed: Math.floor(Math.random() * 1000000),
        steps: 50,
        width: 1024,
        height: 1024,
        style_preset: 'photographic'
      };

      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(requestBody),
        contentType: 'application/json',
        accept: 'application/json'
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      if (!responseBody.artifacts || responseBody.artifacts.length === 0) {
        throw new Error('No image generated');
      }

      const imageBase64 = responseBody.artifacts[0].base64;
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      logger.info('Bedrock pose generation completed', {
        themeId: options.themeId,
        action: options.action,
        mood: options.mood,
        moderationPassed: true,
        promptLength: prompt.length
      });

      return {
        imageBuffer,
        prompt,
        model: modelId
      };
    } catch (error) {
      logger.error('Bedrock pose generation failed', { error, options });
      throw new Error('POSE_GENERATION_FAILED');
    }
  }

  private buildPrompt(options: PoseGenerationOptions): string {
    const themePrompts = {
      anime: 'anime style character, vibrant colors, detailed artwork',
      barbarian: 'fierce barbarian warrior, muscular, battle-ready, medieval fantasy',
      greek: 'ancient Greek hero, classical mythology, marble statue aesthetic',
      mystic: 'mystical wizard, magical aura, arcane powers, fantasy setting'
    };

    const variantPrompts = {
      // Anime variants
      'anime-mage': 'anime mage character, magical staff, flowing robes, spell casting',
      'anime-warrior': 'anime warrior, sword and armor, battle ready, heroic stance',
      // Barbarian variants
      'barbarian-berserker': 'berserker barbarian, wild fury, battle axe, primal rage',
      'barbarian-chieftain': 'barbarian chieftain, tribal leader, commanding presence',
      // Greek variants
      'greek-hero': 'Greek mythological hero, classical armor, noble bearing',
      'greek-god': 'Greek god, divine aura, powerful presence, olympian majesty',
      // Mystic variants
      'mystic-wizard': 'wise wizard, long beard, magical staff, arcane knowledge',
      'mystic-sorcerer': 'dark sorcerer, mysterious powers, shadowy magic'
    };

    const actionPrompts = {
      'cast-spell': 'casting a powerful spell, magical energy swirling, glowing hands',
      'serious-look': 'serious intense expression, determined gaze, dramatic lighting',
      'battle-stance': 'ready for battle, weapon raised, heroic pose',
      'meditation': 'peaceful meditation pose, serene expression, spiritual energy',
      'victory': 'triumphant victory pose, arms raised, celebrating'
    };

    const moodPrompts = {
      epic: 'epic cinematic lighting, dramatic atmosphere, heroic',
      dark: 'dark moody lighting, shadows, mysterious atmosphere',
      bright: 'bright vibrant lighting, cheerful, optimistic',
      mystical: 'mystical ethereal lighting, magical glow, otherworldly'
    };

    const basePrompt = themePrompts[options.themeId as keyof typeof themePrompts] || 'fantasy character';
    const variantKey = options.variantId ? `${options.themeId}-${options.variantId}` : null;
    const variantPrompt = variantKey ? variantPrompts[variantKey as keyof typeof variantPrompts] : null;
    const actionPrompt = actionPrompts[options.action as keyof typeof actionPrompts] || 'dynamic pose';
    const moodPrompt = moodPrompts[options.mood as keyof typeof moodPrompts] || 'dramatic';

    const finalPrompt = variantPrompt || basePrompt;
    const biasPreventionSuffix = 'inclusive, respectful, non-discriminatory, appropriate for all audiences';
    
    return `${finalPrompt}, ${actionPrompt}, ${moodPrompt}, ${biasPreventionSuffix}, high quality, detailed, realistic, professional photography, 4K resolution`;
  }

  async getAvailableActions(themeId: string): Promise<string[]> {
    const themeActions = {
      anime: ['cast-spell', 'serious-look', 'battle-stance', 'victory'],
      barbarian: ['battle-stance', 'serious-look', 'victory', 'roar'],
      greek: ['heroic-pose', 'serious-look', 'meditation', 'victory'],
      mystic: ['cast-spell', 'meditation', 'serious-look', 'mystical-gesture']
    };

    return themeActions[themeId as keyof typeof themeActions] || ['serious-look', 'victory'];
  }
}

export const bedrockService = new BedrockService();