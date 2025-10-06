#!/usr/bin/env node

import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';


const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ai-photobooth-dev';

async function uploadThemeAssets() {
  console.log('📤 Uploading theme assets to S3...');

  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ S3 bucket ${BUCKET_NAME} is accessible`);

    const assetsDir = join(process.cwd(), 'assets', 'themes');
    
    const themes = [
      { id: 'barbarian', name: 'Barbarian', variants: [{ id: 'barbarian-warrior' }, { id: 'barbarian-berserker' }, { id: 'barbarian-chieftain' }] },
      { id: 'greek', name: 'Greek', variants: [{ id: 'greek-philosopher' }, { id: 'greek-goddess' }, { id: 'greek-hero' }] },
      { id: 'mystic', name: 'Mystic', variants: [{ id: 'mystic-wizard' }, { id: 'mystic-sorceress' }, { id: 'mystic-oracle' }] },
      { id: 'anime', name: 'Anime', variants: [{ id: 'anime-ninja' }, { id: 'anime-samurai' }, { id: 'anime-mage' }, { id: 'anime-schoolgirl' }] }
    ];
    
    for (const theme of themes) {
      console.log(`📁 Processing theme: ${theme.name}`);
      
      for (const variant of theme.variants) {
        // Upload template image
        const templatePath = join(assetsDir, theme.id, `${variant.id}-template.jpg`);
        if (existsSync(templatePath)) {
          await uploadFile(templatePath, `themes/${theme.id}/${variant.id}/template.jpg`);
        }

        // Upload mask image
        const maskPath = join(assetsDir, theme.id, `${variant.id}-mask.png`);
        if (existsSync(maskPath)) {
          await uploadFile(maskPath, `themes/${theme.id}/${variant.id}/mask.png`);
        }

        // Upload thumbnail
        const thumbnailPath = join(assetsDir, theme.id, `${variant.id}-thumb.jpg`);
        if (existsSync(thumbnailPath)) {
          await uploadFile(thumbnailPath, `themes/${theme.id}/${variant.id}/thumbnail.jpg`);
        }
      }
    }

    console.log('🎉 Theme assets uploaded successfully!');
  } catch (error) {
    console.error('❌ Error uploading theme assets:', error);
    process.exit(1);
  }
}

async function uploadFile(localPath: string, s3Key: string) {
  try {
    const fileContent = readFileSync(localPath);
    const contentType = s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg';

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: 'max-age=31536000'
    }));

    console.log(`  ✅ Uploaded: ${s3Key}`);
  } catch (error) {
    console.log(`  ⚠️  Skipped: ${s3Key} (file not found)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  uploadThemeAssets();
}

export { uploadThemeAssets };