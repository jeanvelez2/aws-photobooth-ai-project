#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUNDLE_SIZE_BUDGET = 500; // KB
const DIST_DIR = 'dist';

function getDirectorySize(dir) {
  let totalSize = 0;
  
  try {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const filePath = join(dir, file);
      const stats = statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return totalSize;
}

async function checkBundleSize() {
  try {
    const totalSizeBytes = getDirectorySize(DIST_DIR);
    const totalSizeKB = Math.round(totalSizeBytes / 1024);
    
    console.log(`📦 Bundle size: ${totalSizeKB}KB`);
    console.log(`🎯 Budget: ${BUNDLE_SIZE_BUDGET}KB`);
    
    if (totalSizeKB > BUNDLE_SIZE_BUDGET) {
      const overage = totalSizeKB - BUNDLE_SIZE_BUDGET;
      const percentage = ((overage / BUNDLE_SIZE_BUDGET) * 100).toFixed(1);
      
      console.error(`❌ Bundle size exceeds budget by ${overage}KB (${percentage}%)`);
      console.error('Consider:');
      console.error('- Code splitting');
      console.error('- Tree shaking');
      console.error('- Removing unused dependencies');
      console.error('- Lazy loading components');
      
      process.exit(1);
    } else {
      const remaining = BUNDLE_SIZE_BUDGET - totalSizeKB;
      console.log(`✅ Bundle size within budget (${remaining}KB remaining)`);
    }
    
    // Write bundle size for runtime monitoring
    const envContent = `VITE_BUNDLE_SIZE=${totalSizeKB}\n`;
    try {
      const { writeFileSync } = await import('fs');
      writeFileSync('.env.production.local', envContent);
    } catch (error) {
      console.warn('Could not write bundle size to env file:', error.message);
    }
    
  } catch (error) {
    console.error('Error checking bundle size:', error.message);
    process.exit(1);
  }
}

checkBundleSize().catch(console.error);