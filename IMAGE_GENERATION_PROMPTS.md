# AI Photobooth Theme Image Generation Prompts

## 📋 Overview
Generate high-quality theme images for the AI Photobooth application. Each theme needs:
- **Template**: Full character/scene with face area for blending (1024x1024px)
- **Mask**: PNG with transparency showing face region (1024x1024px)
- **Thumbnail**: Smaller preview image (400x300px)

## 🎨 BARBARIAN THEME

### Barbarian Warrior (Male)
**Template Prompt:**
```
Epic barbarian warrior, muscular male figure, rugged leather and metal armor, holding a large battle sword and wooden shield, standing in a heroic pose, ancient battlefield background with stone ruins, dramatic lighting, photorealistic style, face area clearly visible and well-lit for face replacement, 1024x1024 resolution
```

**Mask Instructions:** Create PNG mask covering the face area (coordinates: x=35%, y=25%, width=30%, height=35%)

**Thumbnail Prompt:**
```
Barbarian warrior thumbnail, sword and shield, leather armor, battle-ready pose, 400x300 resolution
```

### Barbarian Berserker (Male)
**Template Prompt:**
```
Wild barbarian berserker, fierce male warrior, dual battle axes, torn leather armor with fur trim, wild hair and beard, aggressive stance, misty forest battlefield, dramatic shadows, photorealistic style, face clearly visible for replacement, 1024x1024 resolution
```

### Barbarian Chieftain (Male)
**Template Prompt:**
```
Noble barbarian chieftain, commanding male figure, ornate ceremonial armor with gold details, large war hammer, tribal decorations, throne room with stone pillars, regal lighting, photorealistic style, face area prominent and well-lit, 1024x1024 resolution
```

## 🏛️ GREEK THEME

### Greek Philosopher (Male)
**Template Prompt:**
```
Classical Greek philosopher, wise elderly male, white toga with gold trim, holding ancient scroll, marble columns and Greek architecture background, soft natural lighting, classical art style, serene expression area for face replacement, 1024x1024 resolution
```

### Greek Goddess (Female)
**Template Prompt:**
```
Divine Greek goddess, elegant female figure, flowing white and gold robes, golden laurel crown, holding a glowing orb, marble temple with columns, ethereal lighting with golden rays, classical mythology style, graceful face area for replacement, 1024x1024 resolution
```

### Greek Hero (Male)
**Template Prompt:**
```
Legendary Greek hero, athletic male warrior, bronze armor and red cape, holding spear and round shield, ancient Greek battlefield, dramatic sunset lighting, heroic pose, classical art style, noble face area clearly visible, 1024x1024 resolution
```

## 🔮 MYSTIC THEME

### Mystic Wizard (Male)
**Template Prompt:**
```
Powerful wizard, elderly male figure, dark blue robes with silver stars, long wooden staff with glowing crystal, magical library with floating books and potions, mystical purple and blue lighting, fantasy art style, wise face area for replacement, 1024x1024 resolution
```

### Mystic Sorceress (Female)
**Template Prompt:**
```
Enchanting sorceress, beautiful female figure, flowing purple and silver robes, holding crystal orb with swirling energy, magical tower room with floating crystals, ethereal lighting with magical sparkles, fantasy art style, elegant face area for replacement, 1024x1024 resolution
```

### Mystic Oracle (Female)
**Template Prompt:**
```
Mystical oracle, mysterious female figure, hooded robes with ancient symbols, surrounded by swirling energy and floating runes, dark temple with glowing crystals, mystical lighting, fantasy art style, serene face area visible for replacement, 1024x1024 resolution
```

## 🎌 ANIME THEME

### Anime Ninja (Male)
**Template Prompt:**
```
Anime ninja warrior, young male character, black ninja outfit with mask around neck, katana sword, dynamic action pose, Japanese village rooftops at night, moonlight and lantern lighting, vibrant anime art style, determined face area for replacement, 1024x1024 resolution
```

### Anime Samurai (Male)
**Template Prompt:**
```
Anime samurai warrior, noble male character, traditional samurai armor in red and black, katana at side, honorable standing pose, cherry blossom background, soft pink lighting, detailed anime art style, stoic face area clearly visible, 1024x1024 resolution
```

### Anime Mage (Male)
**Template Prompt:**
```
Anime elemental mage, young male character, blue and white robes with magical symbols, staff with glowing orb, casting spell pose, magical academy background, bright magical lighting effects, vibrant anime style, focused face area for replacement, 1024x1024 resolution
```

### Anime School Girl (Female)
**Template Prompt:**
```
Anime school girl, cheerful young female character, traditional Japanese school uniform (sailor style), holding school bag, happy pose, school courtyard with cherry blossoms, bright daylight, cute anime art style, smiling face area for replacement, 1024x1024 resolution
```

## 🎭 MASK GENERATION INSTRUCTIONS

For each template, create a corresponding mask:

1. **File Format**: PNG with transparency
2. **Size**: 1024x1024px (same as template)
3. **Mask Area**: White/opaque where face should be blended, transparent everywhere else
4. **Shape**: Oval/circular face region matching the character's face position
5. **Feathering**: Soft edges (10-20px feather) for smooth blending
6. **Coverage**: Include face, neck, and part of hair for natural integration

### Face Region Coordinates (from mockThemes.ts):
- **Barbarian Warrior**: x=35%, y=25%, width=30%, height=35%
- **Barbarian Berserker**: x=40%, y=20%, width=25%, height=30%
- **Barbarian Chieftain**: x=38%, y=22%, width=28%, height=32%
- **Greek Philosopher**: x=42%, y=28%, width=25%, height=30%
- **Greek Goddess**: x=40%, y=25%, width=28%, height=33%
- **Greek Hero**: x=36%, y=24%, width=32%, height=36%
- **Mystic Wizard**: x=38%, y=26%, width=26%, height=31%
- **Mystic Sorceress**: x=41%, y=23%, width=27%, height=32%
- **Mystic Oracle**: x=39%, y=27%, width=24%, height=29%
- **Anime Ninja**: x=37%, y=24%, width=28%, height=33%
- **Anime Samurai**: x=35%, y=22%, width=30%, height=35%
- **Anime Mage**: x=40%, y=26%, width=25%, height=30%
- **Anime School Girl**: x=42%, y=28%, width=24%, height=28%

## 📁 FILE NAMING CONVENTION

### Templates:
- `barbarian-warrior-template.jpg`
- `barbarian-berserker-template.jpg`
- `barbarian-chieftain-template.jpg`
- `greek-philosopher-template.jpg`
- `greek-goddess-template.jpg`
- `greek-hero-template.jpg`
- `mystic-wizard-template.jpg`
- `mystic-sorceress-template.jpg`
- `mystic-oracle-template.jpg`
- `anime-ninja-template.jpg`
- `anime-samurai-template.jpg`
- `anime-mage-template.jpg`
- `anime-schoolgirl-template.jpg`

### Masks:
- `barbarian-warrior-mask.png`
- `barbarian-berserker-mask.png`
- `barbarian-chieftain-mask.png`
- `greek-philosopher-mask.png`
- `greek-goddess-mask.png`
- `greek-hero-mask.png`
- `mystic-wizard-mask.png`
- `mystic-sorceress-mask.png`
- `mystic-oracle-mask.png`
- `anime-ninja-mask.png`
- `anime-samurai-mask.png`
- `anime-mage-mask.png`
- `anime-schoolgirl-mask.png`

### Thumbnails:
- `barbarian-warrior-thumb.jpg`
- `barbarian-berserker-thumb.jpg`
- `barbarian-chieftain-thumb.jpg`
- `greek-philosopher-thumb.jpg`
- `greek-goddess-thumb.jpg`
- `greek-hero-thumb.jpg`
- `mystic-wizard-thumb.jpg`
- `mystic-sorceress-thumb.jpg`
- `mystic-oracle-thumb.jpg`
- `anime-ninja-thumb.jpg`
- `anime-samurai-thumb.jpg`
- `anime-mage-thumb.jpg`
- `anime-schoolgirl-thumb.jpg`

## 🎯 QUALITY REQUIREMENTS

- **Resolution**: Templates and masks at 1024x1024px, thumbnails at 400x300px
- **Quality**: High-quality, professional artwork suitable for face blending
- **Lighting**: Even, well-lit face areas for optimal face replacement
- **Style Consistency**: Each theme should have consistent art style across variants
- **Face Positioning**: Face should be clearly visible, front-facing or slight angle
- **Background**: Rich, detailed backgrounds that match the theme aesthetic

## 📝 USAGE NOTES

1. Generate all template images first
2. Create corresponding masks based on face positions
3. Generate thumbnail versions for UI display
4. Test face blending with sample photos
5. Adjust mask feathering if blending looks harsh
6. Upload to S3 using the provided upload scripts

Total images needed: **39 files** (13 templates + 13 masks + 13 thumbnails)