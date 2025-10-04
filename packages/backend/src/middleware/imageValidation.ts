import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';

const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSIONS = { width: 4096, height: 4096 };

export async function validateImageFormat(req: Request, res: Response, next: NextFunction) {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return next();
    }

    // Fetch image to validate
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Check file size
    if (imageBuffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: 'Image too large',
        maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }

    // Validate image format and dimensions
    const metadata = await sharp(imageBuffer).metadata();
    
    if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
      return res.status(400).json({ 
        error: 'Invalid image format',
        allowedFormats: ALLOWED_FORMATS
      });
    }

    if (metadata.width && metadata.height) {
      if (metadata.width > MAX_DIMENSIONS.width || metadata.height > MAX_DIMENSIONS.height) {
        return res.status(400).json({ 
          error: 'Image dimensions too large',
          maxDimensions: MAX_DIMENSIONS
        });
      }
    }

    next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid image file' });
  }
}

export function compressImage(quality: number = 80) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return next();
      }

      // Add compression flag to request for processing service
      req.body.compressionQuality = quality;
      
      next();
    } catch (error) {
      next(error);
    }
  };
}