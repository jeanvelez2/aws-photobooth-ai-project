const fs = require('fs');
const path = require('path');

const themes = ['barbarian', 'greek', 'mystic', 'anime'];
const variants = {
  barbarian: ['warrior', 'berserker', 'chieftain'],
  greek: ['philosopher', 'goddess', 'hero'],
  mystic: ['wizard', 'sorceress', 'oracle'],
  anime: ['ninja', 'samurai', 'mage', 'schoolgirl']
};

const colors = {
  barbarian: '#8B4513',
  greek: '#FFD700', 
  mystic: '#9370DB',
  anime: '#FF69B4'
};

const createSVG = (theme, type, variant = '') => {
  const color = colors[theme];
  const name = variant ? `${theme}-${variant}` : theme;
  return `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="${color}"/>
  <text x="100" y="100" text-anchor="middle" fill="white" font-size="16">${name}</text>
  <text x="100" y="120" text-anchor="middle" fill="white" font-size="12">${type}</text>
</svg>`;
};

const createJPG = (theme, type, variant = '') => {
  // For JPG, we'll create a simple HTML that can be converted
  const color = colors[theme];
  const name = variant ? `${theme}-${variant}` : theme;
  return `data:image/svg+xml,${encodeURIComponent(createSVG(theme, type, variant))}`;
};

const themesDir = 'packages/frontend/public/themes';

// Create theme thumbnails and templates
themes.forEach(theme => {
  // Main theme thumbnail
  fs.writeFileSync(path.join(themesDir, `${theme}-thumb.svg`), createSVG(theme, 'thumb'));
  fs.writeFileSync(path.join(themesDir, `${theme}-template.jpg`), createSVG(theme, 'template'));
  
  // Variants
  variants[theme].forEach(variant => {
    fs.writeFileSync(path.join(themesDir, `${theme}-${variant}-thumb.jpg`), createSVG(theme, 'thumb', variant));
    fs.writeFileSync(path.join(themesDir, `${theme}-${variant}-template.jpg`), createSVG(theme, 'template', variant));
    fs.writeFileSync(path.join(themesDir, `${theme}-${variant}-mask.png`), createSVG(theme, 'mask', variant));
  });
});

console.log('Created placeholder theme images');