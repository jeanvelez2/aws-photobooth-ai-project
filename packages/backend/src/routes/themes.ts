import { Router } from 'express';
import { ThemeService } from '../services/themeService.js';
import { param, query } from 'express-validator';

const router = Router();
const themeService = new ThemeService();

// GET /api/themes - Get all themes
router.get('/', async (req, res) => {
  try {
    const themes = await themeService.getAllThemes();
    
    // Add asset URLs to each variant
    const themesWithUrls = themes.map(theme => ({
      ...theme,
      variants: theme.variants.map(variant => ({
        ...variant,
        templateUrl: themeService.getAssetUrl(theme.id, variant.id, 'template'),
        maskUrl: themeService.getAssetUrl(theme.id, variant.id, 'mask'),
        thumbnailUrl: themeService.getAssetUrl(theme.id, variant.id, 'thumbnail')
      }))
    }));

    res.json(themesWithUrls);
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// GET /api/themes/:id - Get theme by ID
router.get('/:id', 
  param('id').isString().trim().notEmpty(),
  async (req, res) => {
    try {
      const theme = await themeService.getThemeById(req.params.id);
      
      if (!theme) {
        return res.status(404).json({ error: 'Theme not found' });
      }

      // Add asset URLs to each variant
      const themeWithUrls = {
        ...theme,
        variants: theme.variants.map(variant => ({
          ...variant,
          templateUrl: themeService.getAssetUrl(theme.id, variant.id, 'template'),
          maskUrl: themeService.getAssetUrl(theme.id, variant.id, 'mask'),
          thumbnailUrl: themeService.getAssetUrl(theme.id, variant.id, 'thumbnail')
        }))
      };

      res.json(themeWithUrls);
    } catch (error) {
      console.error('Error fetching theme:', error);
      res.status(500).json({ error: 'Failed to fetch theme' });
    }
  }
);

// GET /api/themes/category/:category - Get themes by category
router.get('/category/:category',
  param('category').isString().trim().notEmpty(),
  async (req, res) => {
    try {
      const themes = await themeService.getThemesByCategory(req.params.category);
      
      // Add asset URLs to each variant
      const themesWithUrls = themes.map(theme => ({
        ...theme,
        variants: theme.variants.map(variant => ({
          ...variant,
          templateUrl: themeService.getAssetUrl(theme.id, variant.id, 'template'),
          maskUrl: themeService.getAssetUrl(theme.id, variant.id, 'mask'),
          thumbnailUrl: themeService.getAssetUrl(theme.id, variant.id, 'thumbnail')
        }))
      }));

      res.json(themesWithUrls);
    } catch (error) {
      console.error('Error fetching themes by category:', error);
      res.status(500).json({ error: 'Failed to fetch themes by category' });
    }
  }
);

export default router;