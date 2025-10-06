import { Theme, ThemeVariant } from 'shared';

export const mockThemes: Theme[] = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    description: 'Fierce warrior from ancient times with rugged armor and battle-worn weapons',
    category: 'fantasy',
    thumbnailUrl: 'themes/barbarian-thumb.svg',
    templateUrl: 'themes/barbarian-template.jpg',
    variants: [
      {
        id: 'barbarian-warrior',
        name: 'Warrior',
        description: 'Classic barbarian warrior with sword and shield',
        thumbnailUrl: 'themes/barbarian-warrior-thumb.svg',
        templateUrl: 'themes/barbarian-warrior-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.35,
          y: 0.25,
          width: 0.3,
          height: 0.35,
          rotation: 0
        },
        blendingMask: 'themes/barbarian-warrior-mask.png',
        colorAdjustments: {
          brightness: 1.1,
          contrast: 1.2,
          saturation: 1.1,
          hue: 0
        }
      },
      {
        id: 'barbarian-berserker',
        name: 'Berserker',
        description: 'Wild berserker with dual axes and fierce expression',
        thumbnailUrl: 'themes/barbarian-berserker-thumb.jpg',
        templateUrl: 'themes/barbarian-berserker-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.4,
          y: 0.2,
          width: 0.25,
          height: 0.3,
          rotation: -5
        },
        blendingMask: 'themes/barbarian-berserker-mask.png',
        colorAdjustments: {
          brightness: 1.0,
          contrast: 1.3,
          saturation: 1.2,
          hue: 10
        }
      },
      {
        id: 'barbarian-chieftain',
        name: 'Chieftain',
        description: 'Noble barbarian leader with ceremonial armor',
        thumbnailUrl: 'themes/barbarian-chieftain-thumb.jpg',
        templateUrl: 'themes/barbarian-chieftain-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.38,
          y: 0.22,
          width: 0.28,
          height: 0.32,
          rotation: 2
        },
        blendingMask: 'themes/barbarian-chieftain-mask.png',
        colorAdjustments: {
          brightness: 1.15,
          contrast: 1.1,
          saturation: 1.0,
          hue: -5
        }
      }
    ]
  },
  {
    id: 'greek',
    name: 'Greek',
    description: 'Classical Greek mythology style with togas, laurels, and marble columns',
    category: 'mythology',
    thumbnailUrl: 'themes/greek-thumb.svg',
    templateUrl: 'themes/greek-template.jpg',
    variants: [
      {
        id: 'greek-philosopher',
        name: 'Philosopher',
        description: 'Wise Greek philosopher with toga and scroll',
        thumbnailUrl: 'themes/greek-philosopher-thumb.jpg',
        templateUrl: 'themes/greek-philosopher-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.42,
          y: 0.28,
          width: 0.25,
          height: 0.3,
          rotation: 0
        },
        blendingMask: 'themes/greek-philosopher-mask.png',
        colorAdjustments: {
          brightness: 1.2,
          contrast: 1.0,
          saturation: 0.9,
          hue: 0
        }
      },
      {
        id: 'greek-goddess',
        name: 'Goddess',
        description: 'Divine Greek goddess with flowing robes and golden accessories',
        thumbnailUrl: 'themes/greek-goddess-thumb.jpg',
        templateUrl: 'themes/greek-goddess-template.jpg',
        gender: 'Female',
        faceRegion: {
          x: 0.4,
          y: 0.25,
          width: 0.28,
          height: 0.33,
          rotation: 3
        },
        blendingMask: 'themes/greek-goddess-mask.png',
        colorAdjustments: {
          brightness: 1.25,
          contrast: 0.95,
          saturation: 1.1,
          hue: 15
        }
      },
      {
        id: 'greek-hero',
        name: 'Hero',
        description: 'Legendary Greek hero with bronze armor and spear',
        thumbnailUrl: 'themes/greek-hero-thumb.jpg',
        templateUrl: 'themes/greek-hero-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.36,
          y: 0.24,
          width: 0.32,
          height: 0.36,
          rotation: -2
        },
        blendingMask: 'themes/greek-hero-mask.png',
        colorAdjustments: {
          brightness: 1.1,
          contrast: 1.15,
          saturation: 1.05,
          hue: -10
        }
      }
    ]
  },
  {
    id: 'mystic',
    name: 'Mystic',
    description: 'Magical and mysterious atmosphere with crystals, potions, and ethereal effects',
    category: 'magic',
    thumbnailUrl: 'themes/mystic-thumb.svg',
    templateUrl: 'themes/mystic-template.jpg',
    variants: [
      {
        id: 'mystic-wizard',
        name: 'Wizard',
        description: 'Powerful wizard with staff and flowing robes',
        thumbnailUrl: 'themes/mystic-wizard-thumb.jpg',
        templateUrl: 'themes/mystic-wizard-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.38,
          y: 0.26,
          width: 0.26,
          height: 0.31,
          rotation: 0
        },
        blendingMask: 'themes/mystic-wizard-mask.png',
        colorAdjustments: {
          brightness: 0.95,
          contrast: 1.2,
          saturation: 1.3,
          hue: 20
        }
      },
      {
        id: 'mystic-sorceress',
        name: 'Sorceress',
        description: 'Enchanting sorceress with magical aura and crystal orb',
        thumbnailUrl: 'themes/mystic-sorceress-thumb.jpg',
        templateUrl: 'themes/mystic-sorceress-template.jpg',
        gender: 'Female',
        faceRegion: {
          x: 0.41,
          y: 0.23,
          width: 0.27,
          height: 0.32,
          rotation: 4
        },
        blendingMask: 'themes/mystic-sorceress-mask.png',
        colorAdjustments: {
          brightness: 1.05,
          contrast: 1.1,
          saturation: 1.4,
          hue: 35
        }
      },
      {
        id: 'mystic-oracle',
        name: 'Oracle',
        description: 'Mystical oracle surrounded by swirling energy and ancient symbols',
        thumbnailUrl: 'themes/mystic-oracle-thumb.jpg',
        templateUrl: 'themes/mystic-oracle-template.jpg',
        gender: 'Female',
        faceRegion: {
          x: 0.39,
          y: 0.27,
          width: 0.24,
          height: 0.29,
          rotation: -3
        },
        blendingMask: 'themes/mystic-oracle-mask.png',
        colorAdjustments: {
          brightness: 1.0,
          contrast: 1.25,
          saturation: 1.2,
          hue: -15
        }
      }
    ]
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese animation style with vibrant colors and dynamic poses',
    category: 'anime',
    thumbnailUrl: 'themes/anime-thumb.svg',
    templateUrl: 'themes/anime-template.jpg',
    variants: [
      {
        id: 'anime-ninja',
        name: 'Ninja',
        description: 'Stealthy ninja with traditional garb and weapons',
        thumbnailUrl: 'themes/anime-ninja-thumb.jpg',
        templateUrl: 'themes/anime-ninja-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.37,
          y: 0.24,
          width: 0.28,
          height: 0.33,
          rotation: -1
        },
        blendingMask: 'themes/anime-ninja-mask.png',
        colorAdjustments: {
          brightness: 1.0,
          contrast: 1.3,
          saturation: 1.4,
          hue: 0
        }
      },
      {
        id: 'anime-samurai',
        name: 'Samurai',
        description: 'Honor-bound samurai warrior with katana and traditional armor',
        thumbnailUrl: 'themes/anime-samurai-thumb.jpg',
        templateUrl: 'themes/anime-samurai-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.35,
          y: 0.22,
          width: 0.3,
          height: 0.35,
          rotation: 2
        },
        blendingMask: 'themes/anime-samurai-mask.png',
        colorAdjustments: {
          brightness: 1.1,
          contrast: 1.2,
          saturation: 1.3,
          hue: -5
        }
      },
      {
        id: 'anime-mage',
        name: 'Mage',
        description: 'Powerful anime mage with elemental magic and staff',
        thumbnailUrl: 'themes/anime-mage-thumb.jpg',
        templateUrl: 'themes/anime-mage-template.jpg',
        gender: 'Male',
        faceRegion: {
          x: 0.4,
          y: 0.26,
          width: 0.25,
          height: 0.3,
          rotation: 0
        },
        blendingMask: 'themes/anime-mage-mask.png',
        colorAdjustments: {
          brightness: 1.05,
          contrast: 1.15,
          saturation: 1.5,
          hue: 25
        }
      },
      {
        id: 'anime-schoolgirl',
        name: 'School Girl',
        description: 'Classic anime school girl with uniform and cheerful expression',
        thumbnailUrl: 'themes/anime-schoolgirl-thumb.jpg',
        templateUrl: 'themes/anime-schoolgirl-template.jpg',
        gender: 'Female',
        faceRegion: {
          x: 0.42,
          y: 0.28,
          width: 0.24,
          height: 0.28,
          rotation: 1
        },
        blendingMask: 'themes/anime-schoolgirl-mask.png',
        colorAdjustments: {
          brightness: 1.15,
          contrast: 1.05,
          saturation: 1.2,
          hue: 10
        }
      }
    ]
  }
];

// Helper function to get theme by ID
export function getThemeById(id: string): Theme | undefined {
  return mockThemes.find(theme => theme.id === id);
}

// Helper function to get variant by theme and variant ID
export function getVariantById(themeId: string, variantId: string): { theme: Theme; variant: ThemeVariant } | undefined {
  const theme = getThemeById(themeId);
  if (!theme) return undefined;
  
  const variant = theme.variants.find(v => v.id === variantId);
  if (!variant) return undefined;
  
  return { theme, variant };
}

// Helper function to get all themes with variant count
export function getThemesWithVariantCount() {
  return mockThemes.map(theme => ({
    ...theme,
    variantCount: theme.variants.length
  }));
}