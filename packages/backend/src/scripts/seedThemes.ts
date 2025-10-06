#!/usr/bin/env node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';


const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const THEMES_TABLE = process.env.THEMES_TABLE || 'photobooth-themes-dev';
// Get S3_BUCKET_URL from environment or parameter
function getS3BucketUrl(bucketUrlParam?: string): string {
  if (bucketUrlParam) return bucketUrlParam;
  if (process.env.S3_BUCKET_URL) return process.env.S3_BUCKET_URL;
  if (process.env.S3_BUCKET_NAME) {
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com`;
  }
  return 'https://example.com';
}

// Function to convert relative URLs to absolute S3 URLs
function makeAbsoluteUrl(relativeUrl: string, bucketUrl: string): string {
  if (relativeUrl.startsWith('http')) return relativeUrl;
  // Remove leading slash from relative URL to avoid double slashes
  const cleanRelativeUrl = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
  return `${bucketUrl}/${cleanRelativeUrl}`;
}

async function seedThemes(bucketUrlParam?: string) {
  const S3_BUCKET_URL = getS3BucketUrl(bucketUrlParam);
  console.log('🌱 Seeding themes to DynamoDB...');
  console.log(`📦 Using S3 bucket URL: ${S3_BUCKET_URL}`);
  
  try {
    const themes = [
      {
        id: 'barbarian', name: 'Barbarian', description: 'Fierce warrior from ancient times with rugged armor and battle-worn weapons', category: 'fantasy',
        thumbnailUrl: 'themes/barbarian/barbarian-thumb.jpg', templateUrl: 'themes/barbarian/barbarian-template.jpg',
        variants: [
          { id: 'barbarian-warrior', name: 'Warrior', description: 'Classic barbarian warrior with sword and shield', thumbnailUrl: 'themes/barbarian/barbarian-warrior-thumb.jpg', templateUrl: 'themes/barbarian/barbarian-warrior-template.jpg', gender: 'Male', faceRegion: { x: 0.35, y: 0.25, width: 0.3, height: 0.35, rotation: 0 }, blendingMask: 'themes/barbarian/barbarian-warrior-mask.png', colorAdjustments: { brightness: 1.1, contrast: 1.2, saturation: 1.1, hue: 0 } },
          { id: 'barbarian-berserker', name: 'Berserker', description: 'Wild berserker with dual axes and fierce expression', thumbnailUrl: 'themes/barbarian/barbarian-berserker-thumb.jpg', templateUrl: 'themes/barbarian/barbarian-berserker-template.jpg', gender: 'Male', faceRegion: { x: 0.4, y: 0.2, width: 0.25, height: 0.3, rotation: -5 }, blendingMask: 'themes/barbarian/barbarian-berserker-mask.png', colorAdjustments: { brightness: 1.0, contrast: 1.3, saturation: 1.2, hue: 10 } },
          { id: 'barbarian-chieftain', name: 'Chieftain', description: 'Noble barbarian leader with ceremonial armor', thumbnailUrl: 'themes/barbarian/barbarian-chieftain-thumb.jpg', templateUrl: 'themes/barbarian/barbarian-chieftain-template.jpg', gender: 'Male', faceRegion: { x: 0.38, y: 0.22, width: 0.28, height: 0.32, rotation: 2 }, blendingMask: 'themes/barbarian/barbarian-chieftain-mask.png', colorAdjustments: { brightness: 1.15, contrast: 1.1, saturation: 1.0, hue: -5 } }
        ]
      },
      {
        id: 'greek', name: 'Greek', description: 'Classical Greek mythology style with togas, laurels, and marble columns', category: 'mythology',
        thumbnailUrl: 'themes/greek/greek-thumb.jpg', templateUrl: 'themes/greek/greek-template.jpg',
        variants: [
          { id: 'greek-philosopher', name: 'Philosopher', description: 'Wise Greek philosopher with toga and scroll', thumbnailUrl: 'themes/greek/greek-philosopher-thumb.jpg', templateUrl: 'themes/greek/greek-philosopher-template.jpg', gender: 'Male', faceRegion: { x: 0.42, y: 0.28, width: 0.25, height: 0.3, rotation: 0 }, blendingMask: 'themes/greek/greek-philosopher-mask.png', colorAdjustments: { brightness: 1.2, contrast: 1.0, saturation: 0.9, hue: 0 } },
          { id: 'greek-goddess', name: 'Goddess', description: 'Divine Greek goddess with flowing robes and golden accessories', thumbnailUrl: 'themes/greek/greek-goddess-thumb.jpg', templateUrl: 'themes/greek/greek-goddess-template.jpg', gender: 'Female', faceRegion: { x: 0.4, y: 0.25, width: 0.28, height: 0.33, rotation: 3 }, blendingMask: 'themes/greek/greek-goddess-mask.png', colorAdjustments: { brightness: 1.25, contrast: 0.95, saturation: 1.1, hue: 15 } },
          { id: 'greek-hero', name: 'Hero', description: 'Legendary Greek hero with bronze armor and spear', thumbnailUrl: 'themes/greek/greek-hero-thumb.jpg', templateUrl: 'themes/greek/greek-hero-template.jpg', gender: 'Male', faceRegion: { x: 0.36, y: 0.24, width: 0.32, height: 0.36, rotation: -2 }, blendingMask: 'themes/greek/greek-hero-mask.png', colorAdjustments: { brightness: 1.1, contrast: 1.15, saturation: 1.05, hue: -10 } }
        ]
      },
      {
        id: 'mystic', name: 'Mystic', description: 'Magical and mysterious atmosphere with crystals, potions, and ethereal effects', category: 'magic',
        thumbnailUrl: 'themes/mystic/mystic-thumb.jpg', templateUrl: 'themes/mystic/mystic-template.jpg',
        variants: [
          { id: 'mystic-wizard', name: 'Wizard', description: 'Powerful wizard with staff and flowing robes', thumbnailUrl: 'themes/mystic/mystic-wizard-thumb.jpg', templateUrl: 'themes/mystic/mystic-wizard-template.jpg', gender: 'Male', faceRegion: { x: 0.38, y: 0.26, width: 0.26, height: 0.31, rotation: 0 }, blendingMask: 'themes/mystic/mystic-wizard-mask.png', colorAdjustments: { brightness: 0.95, contrast: 1.2, saturation: 1.3, hue: 20 } },
          { id: 'mystic-sorceress', name: 'Sorceress', description: 'Enchanting sorceress with magical aura and crystal orb', thumbnailUrl: 'themes/mystic/mystic-sorceress-thumb.jpg', templateUrl: 'themes/mystic/mystic-sorceress-template.jpg', gender: 'Female', faceRegion: { x: 0.41, y: 0.23, width: 0.27, height: 0.32, rotation: 4 }, blendingMask: 'themes/mystic/mystic-sorceress-mask.png', colorAdjustments: { brightness: 1.05, contrast: 1.1, saturation: 1.4, hue: 35 } },
          { id: 'mystic-oracle', name: 'Oracle', description: 'Mystical oracle surrounded by swirling energy and ancient symbols', thumbnailUrl: 'themes/mystic/mystic-oracle-thumb.jpg', templateUrl: 'themes/mystic/mystic-oracle-template.jpg', gender: 'Female', faceRegion: { x: 0.39, y: 0.27, width: 0.24, height: 0.29, rotation: -3 }, blendingMask: 'themes/mystic/mystic-oracle-mask.png', colorAdjustments: { brightness: 1.0, contrast: 1.25, saturation: 1.2, hue: -15 } }
        ]
      },
      {
        id: 'anime', name: 'Anime', description: 'Japanese animation style with vibrant colors and dynamic poses', category: 'anime',
        thumbnailUrl: 'themes/anime/anime-thumb.jpg', templateUrl: 'themes/anime/anime-template.jpg',
        variants: [
          { id: 'anime-ninja', name: 'Ninja', description: 'Stealthy ninja with traditional garb and weapons', thumbnailUrl: 'themes/anime/anime-ninja-thumb.jpg', templateUrl: 'themes/anime/anime-ninja-template.jpg', gender: 'Male', faceRegion: { x: 0.37, y: 0.24, width: 0.28, height: 0.33, rotation: -1 }, blendingMask: 'themes/anime/anime-ninja-mask.png', colorAdjustments: { brightness: 1.0, contrast: 1.3, saturation: 1.4, hue: 0 } },
          { id: 'anime-samurai', name: 'Samurai', description: 'Honor-bound samurai warrior with katana and traditional armor', thumbnailUrl: 'themes/anime/anime-samurai-thumb.jpg', templateUrl: 'themes/anime/anime-samurai-template.jpg', gender: 'Male', faceRegion: { x: 0.35, y: 0.22, width: 0.3, height: 0.35, rotation: 2 }, blendingMask: 'themes/anime/anime-samurai-mask.png', colorAdjustments: { brightness: 1.1, contrast: 1.2, saturation: 1.3, hue: -5 } },
          { id: 'anime-mage', name: 'Mage', description: 'Powerful anime mage with elemental magic and staff', thumbnailUrl: 'themes/anime/anime-mage-thumb.jpg', templateUrl: 'themes/anime/anime-mage-template.jpg', gender: 'Male', faceRegion: { x: 0.4, y: 0.26, width: 0.25, height: 0.3, rotation: 0 }, blendingMask: 'themes/anime/anime-mage-mask.png', colorAdjustments: { brightness: 1.05, contrast: 1.15, saturation: 1.5, hue: 25 } },
          { id: 'anime-schoolgirl', name: 'School Girl', description: 'Classic anime school girl with uniform and cheerful expression', thumbnailUrl: 'themes/anime/anime-schoolgirl-thumb.jpg', templateUrl: 'themes/anime/anime-schoolgirl-template.jpg', gender: 'Female', faceRegion: { x: 0.42, y: 0.28, width: 0.24, height: 0.28, rotation: 1 }, blendingMask: 'themes/anime/anime-schoolgirl-mask.png', colorAdjustments: { brightness: 1.15, contrast: 1.05, saturation: 1.2, hue: 10 } }
        ]
      }
    ];
    
    for (const theme of themes) {
      // Convert relative URLs to absolute S3 URLs
      const processedTheme = {
        ...theme,
        thumbnailUrl: makeAbsoluteUrl(theme.thumbnailUrl, S3_BUCKET_URL),
        templateUrl: makeAbsoluteUrl(theme.templateUrl, S3_BUCKET_URL),
        variants: theme.variants.map(variant => ({
          ...variant,
          thumbnailUrl: makeAbsoluteUrl(variant.thumbnailUrl, S3_BUCKET_URL),
          templateUrl: makeAbsoluteUrl(variant.templateUrl, S3_BUCKET_URL),
          blendingMask: makeAbsoluteUrl(variant.blendingMask, S3_BUCKET_URL)
        }))
      };
      const command = new PutCommand({
        TableName: THEMES_TABLE,
        Item: {
          themeId: processedTheme.id,
          name: processedTheme.name,
          description: processedTheme.description,
          category: processedTheme.category,
          thumbnailUrl: processedTheme.thumbnailUrl,
          templateUrl: processedTheme.templateUrl,
          variants: processedTheme.variants,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

      await docClient.send(command);
      console.log(`✅ Seeded theme: ${theme.name}`);
    }

    console.log(`🎉 Successfully seeded ${themes.length} themes!`);
  } catch (error) {
    console.error('❌ Error seeding themes:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedThemes();
}

export { seedThemes };