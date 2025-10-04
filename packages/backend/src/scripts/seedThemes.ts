#!/usr/bin/env node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockThemes } from '../data/mockThemes.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const THEMES_TABLE = process.env.THEMES_TABLE || 'photobooth-themes-dev';

async function seedThemes() {
  console.log('🌱 Seeding themes to DynamoDB...');
  
  try {
    for (const theme of mockThemes) {
      const command = new PutCommand({
        TableName: THEMES_TABLE,
        Item: {
          id: theme.id,
          name: theme.name,
          description: theme.description,
          category: theme.category,
          variants: theme.variants,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

      await docClient.send(command);
      console.log(`✅ Seeded theme: ${theme.name}`);
    }

    console.log(`🎉 Successfully seeded ${mockThemes.length} themes!`);
  } catch (error) {
    console.error('❌ Error seeding themes:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedThemes();
}

export { seedThemes };