/**
 * Accessibility-focused Visual Regression Tests
 * Tests visual consistency of accessibility features
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility Visual Tests @visual @a11y', () => {
  test.beforeEach(async ({ page }) => {
    // Mock camera API
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.resolve({
            getTracks: () => [{ stop: () => {} }],
            getVideoTracks: () => [{ stop: () => {} }],
          }),
        },
        writable: true,
      });
      window.URL.createObjectURL = () => 'blob:mock-url';
    });
  });

  test('focus indicators visibility', async ({ page }) => {
    await page.goto('/');
    
    // Test focus indicators on interactive elements
    const interactiveElements = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    for (const selector of interactiveElements) {
      const elements = await page.locator(selector).all();
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements[i];
        if (element) {
          await element.focus();
        }
        
        // Screenshot focused element
        if (element) {
          await expect(element).toHaveScreenshot(`focus-${selector.replace(/[^a-zA-Z0-9]/g, '-')}-${i}.png`);
        }
      }
    }
  });

  test('high contrast mode compatibility', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    
    const pages = ['/', '/themes', '/process'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      const pageName = pagePath === '/' ? 'home' : pagePath.slice(1);
      await expect(page).toHaveScreenshot(`high-contrast-${pageName}.png`, {
        fullPage: true,
      });
    }
  });

  test('reduced motion preferences', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that animations are reduced/disabled
    await expect(page).toHaveScreenshot('reduced-motion-capture.png');
    
    await page.goto('/process');
    await page.waitForLoadState('networkidle');
    
    // Processing page with reduced motion
    await expect(page).toHaveScreenshot('reduced-motion-processing.png');
  });

  test('screen reader compatible layouts', async ({ page }) => {
    await page.goto('/');
    
    // Test with screen reader simulation
    await page.addInitScript(() => {
      // Add screen reader simulation styles
      const style = document.createElement('style');
      style.textContent = `
        .sr-only:not(:focus):not(:active) {
          position: static !important;
          width: auto !important;
          height: auto !important;
          padding: 2px 4px !important;
          margin: 2px !important;
          overflow: visible !important;
          clip: auto !important;
          white-space: normal !important;
          background: yellow !important;
          color: black !important;
          border: 2px solid red !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    await expect(page).toHaveScreenshot('screen-reader-layout.png', {
      fullPage: true,
    });
  });

  test('keyboard navigation visual feedback', async ({ page }) => {
    await page.goto('/');
    
    // Navigate through the page using keyboard
    let tabCount = 0;
    const maxTabs = 10;
    
    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;
      
      // Take screenshot every few tabs to show navigation flow
      if (tabCount % 3 === 0) {
        await expect(page).toHaveScreenshot(`keyboard-nav-step-${tabCount}.png`);
      }
    }
  });

  test('color contrast validation visual', async ({ page }) => {
    await page.goto('/');
    
    // Add contrast checking overlay
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        /* Highlight potential contrast issues */
        * {
          outline: 1px solid rgba(255, 0, 0, 0.1) !important;
        }
        
        /* Highlight text elements */
        p, span, div, h1, h2, h3, h4, h5, h6, button, a {
          box-shadow: inset 0 0 0 1px rgba(0, 255, 0, 0.3) !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    await expect(page).toHaveScreenshot('contrast-validation.png', {
      fullPage: true,
    });
  });

  test('text scaling compatibility', async ({ page }) => {
    // Test with different text scaling levels
    const scaleLevels = [1.25, 1.5, 2.0];
    
    for (const scale of scaleLevels) {
      await page.addInitScript((scale) => {
        document.documentElement.style.fontSize = `${scale * 16}px`;
      }, scale);
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot(`text-scale-${scale}x.png`, {
        fullPage: true,
      });
    }
  });

  test('touch target sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
    
    await page.goto('/');
    
    // Add overlay to visualize touch targets
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"]) {
          position: relative !important;
        }
        
        button::after, a::after, input::after, select::after, textarea::after, 
        [role="button"]::after, [tabindex]:not([tabindex="-1"])::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 44px;
          height: 44px;
          transform: translate(-50%, -50%);
          border: 2px solid rgba(255, 0, 0, 0.5);
          pointer-events: none;
          z-index: 9999;
        }
      `;
      document.head.appendChild(style);
    });
    
    await expect(page).toHaveScreenshot('touch-targets-mobile.png', {
      fullPage: true,
    });
  });

  test('error message accessibility', async ({ page }) => {
    // Mock camera error
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.reject(new Error('Permission denied')),
        },
        writable: true,
      });
    });
    
    await page.goto('/');
    
    // Wait for error state
    await page.waitForSelector('text=Failed to get camera devices', { timeout: 5000 });
    
    // Screenshot of accessible error display
    await expect(page).toHaveScreenshot('accessible-error-display.png');
  });

  test('loading states accessibility', async ({ page }) => {
    // Mock slow loading
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    await page.goto('/themes');
    
    // Capture accessible loading state
    await page.waitForSelector('[role="status"], [aria-live]', { timeout: 2000 });
    await expect(page).toHaveScreenshot('accessible-loading.png');
  });

  test('form labels and descriptions', async ({ page }) => {
    await page.goto('/');
    
    // Add visual indicators for form accessibility
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        /* Highlight form elements and their labels */
        label {
          background: rgba(0, 255, 0, 0.2) !important;
          border: 2px solid green !important;
        }
        
        input, select, textarea {
          background: rgba(0, 0, 255, 0.1) !important;
          border: 2px solid blue !important;
        }
        
        [aria-describedby]::after {
          content: '📝';
          position: absolute;
          right: -20px;
          top: 0;
        }
        
        [aria-labelledby]::after {
          content: '🏷️';
          position: absolute;
          right: -40px;
          top: 0;
        }
      `;
      document.head.appendChild(style);
    });
    
    await expect(page).toHaveScreenshot('form-accessibility.png', {
      fullPage: true,
    });
  });

  test('skip links functionality', async ({ page }) => {
    await page.goto('/');
    
    // Press Tab to reveal skip links
    await page.keyboard.press('Tab');
    
    // Screenshot with skip links visible
    await expect(page).toHaveScreenshot('skip-links-visible.png');
  });

  test('aria landmarks visualization', async ({ page }) => {
    await page.goto('/');
    
    // Add visual indicators for ARIA landmarks
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        [role="banner"]::before { content: "BANNER: "; background: red; color: white; }
        [role="navigation"]::before { content: "NAV: "; background: blue; color: white; }
        [role="main"]::before { content: "MAIN: "; background: green; color: white; }
        [role="contentinfo"]::before { content: "FOOTER: "; background: purple; color: white; }
        [role="complementary"]::before { content: "ASIDE: "; background: orange; color: white; }
        [role="search"]::before { content: "SEARCH: "; background: teal; color: white; }
        
        main::before { content: "MAIN: "; background: green; color: white; }
        header::before { content: "HEADER: "; background: red; color: white; }
        footer::before { content: "FOOTER: "; background: purple; color: white; }
        nav::before { content: "NAV: "; background: blue; color: white; }
        aside::before { content: "ASIDE: "; background: orange; color: white; }
      `;
      document.head.appendChild(style);
    });
    
    await expect(page).toHaveScreenshot('aria-landmarks.png', {
      fullPage: true,
    });
  });
});