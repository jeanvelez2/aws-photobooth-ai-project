#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load performance budget configuration
const budgetPath = path.join(__dirname, '../performance-budget.json');
const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

// Check if dist directory exists
const distPath = path.join(__dirname, '../dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Build directory not found. Run "npm run build" first.');
  process.exit(1);
}

// Analyze bundle sizes
function analyzeBundle() {
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  // Get all JS files in dist
  const jsFiles = getJSFiles(distPath);
  
  // Check each budget constraint
  budget.budgets.forEach(budgetItem => {
    const result = checkBudgetItem(budgetItem, jsFiles);
    results.details.push(result);
    
    if (result.status === 'passed') {
      results.passed++;
    } else if (result.status === 'warning') {
      results.warnings++;
    } else {
      results.failed++;
    }
  });

  return results;
}

function getJSFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.js') && !item.includes('.map')) {
        const size = stat.size;
        const relativePath = path.relative(distPath, fullPath);
        files.push({ path: relativePath, size });
      }
    });
  }
  
  traverse(dir);
  return files;
}

function checkBudgetItem(budgetItem, files) {
  const { type, name, maximumWarning, maximumError } = budgetItem;
  
  let totalSize = 0;
  let matchedFiles = [];
  
  switch (type) {
    case 'bundle':
      matchedFiles = files.filter(file => 
        name === 'main' ? file.path.includes('index') : 
        name === 'vendor' ? file.path.includes('vendor') : 
        file.path.includes(name)
      );
      break;
    case 'initial':
      matchedFiles = files.filter(file => !file.path.includes('chunk'));
      break;
    case 'any':
      matchedFiles = files;
      break;
    default:
      matchedFiles = files;
  }
  
  totalSize = matchedFiles.reduce((sum, file) => sum + file.size, 0);
  
  const warningBytes = parseSize(maximumWarning);
  const errorBytes = parseSize(maximumError);
  
  let status = 'passed';
  if (totalSize > errorBytes) {
    status = 'failed';
  } else if (totalSize > warningBytes) {
    status = 'warning';
  }
  
  return {
    type,
    name: name || 'all',
    size: totalSize,
    warningLimit: warningBytes,
    errorLimit: errorBytes,
    status,
    files: matchedFiles
  };
}

function parseSize(sizeStr) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const [, number, unit] = match;
  return parseFloat(number) * units[unit];
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function printResults(results) {
  console.log('\n📊 Performance Budget Analysis\n');
  
  results.details.forEach(detail => {
    const icon = detail.status === 'passed' ? '✅' : 
                 detail.status === 'warning' ? '⚠️' : '❌';
    
    const percentage = ((detail.size / detail.errorLimit) * 100).toFixed(1);
    
    console.log(`${icon} ${detail.type}${detail.name !== 'all' ? ` (${detail.name})` : ''}`);
    console.log(`   Size: ${formatSize(detail.size)} (${percentage}% of limit)`);
    console.log(`   Warning: ${formatSize(detail.warningLimit)}`);
    console.log(`   Error: ${formatSize(detail.errorLimit)}`);
    
    if (detail.files.length > 0 && detail.files.length <= 5) {
      console.log(`   Files: ${detail.files.map(f => f.path).join(', ')}`);
    } else if (detail.files.length > 5) {
      console.log(`   Files: ${detail.files.length} files`);
    }
    console.log('');
  });
  
  console.log('📈 Summary:');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ⚠️  Warnings: ${results.warnings}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\n❌ Performance budget check failed!');
    console.log('Consider optimizing bundle sizes or adjusting budget limits.');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('\n⚠️  Performance budget check passed with warnings.');
    console.log('Consider optimizing bundle sizes to stay within warning limits.');
  } else {
    console.log('\n✅ All performance budget checks passed!');
  }
}

// Run the analysis
try {
  const results = analyzeBundle();
  printResults(results);
} catch (error) {
  console.error('❌ Error analyzing performance budget:', error.message);
  process.exit(1);
}