import { Router } from 'express';
import { ThemeService } from '../services/themeService.js';
import { param, query } from 'express-validator';
import { seedThemes } from '../scripts/seedThemes.js';

const router = Router();
const themeService = new ThemeService();

// GET /api/themes - Get all themes
router.get('/', async (req, res) => {
  try {
    const themes = await themeService.getAllThemes();
    
    res.json(themes);
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

      res.json(theme);
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
      
      res.json(themes);
    } catch (error) {
      console.error('Error fetching themes by category:', error);
      res.status(500).json({ error: 'Failed to fetch themes by category' });
    }
  }
);

// POST /api/themes/seed - Seed themes with optional CloudFront URL
router.post('/seed', async (req, res) => {
  try {
    const cloudFrontUrl = req.headers['x-cloudfront-url'] as string;
    await seedThemes(cloudFrontUrl);
    res.json({ message: 'Themes seeded successfully', cloudFrontUrl });
  } catch (error) {
    console.error('Error seeding themes:', error);
    res.status(500).json({ error: 'Failed to seed themes' });
  }
});

export default router;