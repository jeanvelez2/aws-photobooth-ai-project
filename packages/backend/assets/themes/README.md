# Theme Assets

This directory contains theme assets for the AI Photobooth application.

## Directory Structure

```
themes/
├── barbarian/
│   ├── male-template.jpg      # Background template for male variant
│   ├── male-mask.png          # Face mask for male variant
│   ├── male-thumb.jpg         # Thumbnail for male variant
│   ├── female-template.jpg    # Background template for female variant
│   ├── female-mask.png        # Face mask for female variant
│   └── female-thumb.jpg       # Thumbnail for female variant
├── greek/
│   ├── male-template.jpg
│   ├── male-mask.png
│   ├── male-thumb.jpg
│   ├── female-template.jpg
│   ├── female-mask.png
│   └── female-thumb.jpg
├── mystic/
│   ├── male-template.jpg
│   ├── male-mask.png
│   ├── male-thumb.jpg
│   ├── female-template.jpg
│   ├── female-mask.png
│   └── female-thumb.jpg
└── anime/
    ├── male-template.jpg
    ├── male-mask.png
    ├── male-thumb.jpg
    ├── female-template.jpg
    ├── female-mask.png
    └── female-thumb.jpg
```

## File Requirements

- **Templates**: 1920x1080 JPG images with transparent face area
- **Masks**: PNG images with alpha channel defining face blend area
- **Thumbnails**: 300x200 JPG preview images

## Upload to S3

Run the upload script to sync these assets to S3:

```bash
npm run upload:assets
```