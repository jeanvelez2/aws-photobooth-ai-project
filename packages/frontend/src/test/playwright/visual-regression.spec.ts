import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Mock camera API to avoid permission prompts
    await page.addInitScript(() => {
      // Mock getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.resolve({
            getTracks: () => [{ stop: () => {} }],
            getVideoTracks: () => [{ stop: () => {} }],
          }),
        },
        writable: true,
      });

      // Mock URL.createObjectURL
      window.URL.createObjectURL = () => 'blob:mock-url';
    });
  });

  test('capture page layout', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait for any animations to complete
    await page.waitForTimeout(1000);
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('capture-page-full.png', {
      fullPage: true,
    });
    
    // Take viewport screenshot
    await expect(page).toHaveScreenshot('capture-page-viewport.png');
  });

  test('capture page with camera preview', async ({ page }) => {
    await page.goto('/');
    
    // Wait for camera component to load
    await page.waitForSelector('[data-testid="camera-preview"]', { timeout: 10000 });
    
    // Take screenshot of camera section
    const cameraSection = page.locator('[data-testid="camera-section"]');
    await expect(cameraSection).toHaveScreenshot('camera-preview.png');
  });

  test('capture page with photo taken', async ({ page }) => {
    await page.goto('/');
    
    // Wait for camera and simulate photo capture
    await page.waitForSelector('[data-testid="camera-preview"]');
    await page.click('button:has-text("Capture Photo")');
    
    // Wait for photo preview to appear
    await page.waitForSelector('img[alt="Captured photo"]');
    
    // Take screenshot of photo preview state
    await expect(page).toHaveScreenshot('photo-preview.png');
  });

  test('theme selection page layout', async ({ page }) => {
    // Navigate to theme selection (mock having a photo)
    await page.goto('/themes');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Full page screenshot
    await expect(page).toHaveScreenshot('theme-selection-full.png', {
      fullPage: true,
    });
    
    // Theme gallery specific screenshot
    const themeGallery = page.locator('[data-testid="theme-gallery"]');
    await expect(themeGallery).toHaveScreenshot('theme-gallery.png');
  });

  test('theme selection with selected theme', async ({ page }) => {
    await page.goto('/themes');
    
    // Select a theme
    await page.click('[data-testid="theme-barbarian"]');
    
    // Wait for selection to be reflected
    await page.waitForTimeout(500);
    
    // Screenshot with selected state
    await expect(page).toHaveScreenshot('theme-selected.png');
  });

  test('theme variants display', async ({ page }) => {
    await page.goto('/themes');
    
    // Select theme with variants
    await page.click('[data-testid="theme-barbarian"]');
    
    // Wait for variants to appear
    await page.waitForSelector('[data-testid="theme-variants"]');
    
    // Screenshot of variants section
    const variants = page.locator('[data-testid="theme-variants"]');
    await expect(variants).toHaveScreenshot('theme-variants.png');
  });

  test('processing page layout', async ({ page }) => {
    await page.goto('/process');
    
    await page.waitForLoadState('networkidle');
    
    // Screenshot of processing page
    await expect(page).toHaveScreenshot('processing-page.png');
    
    // Screenshot of progress indicator
    const progressIndicator = page.locator('[data-testid="progress-indicator"]');
    await expect(progressIndicator).toHaveScreenshot('progress-indicator.png');
  });

  test('result page layout', async ({ page }) => {
    // Mock completed processing state
    await page.addInitScript(() => {
      window.localStorage.setItem('processingResult', JSON.stringify({
        id: 'job-123',
        status: 'completed',
        resultUrl: 'https://example.com/result.jpg',
        processingTime: 8500,
      }));
    });
    
    await page.goto('/result');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Full result page screenshot
    await expect(page).toHaveScreenshot('result-page-full.png', {
      fullPage: true,
    });
    
    // Result image section
    const resultSection = page.locator('[data-testid="result-section"]');
    await expect(resultSection).toHaveScreenshot('result-section.png');
  });

  test('error states visual consistency', async ({ page }) => {
    // Test camera permission denied error
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
    await page.waitForSelector('[data-testid="camera-error"]');
    
    // Screenshot of error state
    await expect(page).toHaveScreenshot('camera-error.png');
  });

  test('processing error display', async ({ page }) => {
    // Mock processing error
    await page.addInitScript(() => {
      window.localStorage.setItem('processingError', JSON.stringify({
        type: 'NO_FACE_DETECTED',
        message: 'No face detected in the uploaded image',
        retryable: false,
      }));
    });
    
    await page.goto('/process');
    
    // Wait for error display
    await page.waitForSelector('[data-testid="processing-error"]');
    
    // Screenshot of error state
    await expect(page).toHaveScreenshot('processing-error.png');
  });

  test('responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Mobile capture page
    await expect(page).toHaveScreenshot('mobile-capture-page.png');
    
    // Navigate to themes
    await page.goto('/themes');
    await page.waitForLoadState('networkidle');
    
    // Mobile theme selection
    await expect(page).toHaveScreenshot('mobile-theme-selection.png');
  });

  test('responsive design - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Tablet capture page
    await expect(page).toHaveScreenshot('tablet-capture-page.png');
    
    // Navigate to themes
    await page.goto('/themes');
    await page.waitForLoadState('networkidle');
    
    // Tablet theme selection
    await expect(page).toHaveScreenshot('tablet-theme-selection.png');
  });

  test('dark mode compatibility', async ({ page }) => {
    // Enable dark mode if supported
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Dark mode screenshots
    await expect(page).toHaveScreenshot('dark-mode-capture.png');
    
    await page.goto('/themes');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('dark-mode-themes.png');
  });

  test('high contrast mode', async ({ page }) => {
    // Enable high contrast
    await page.emulateMedia({ forcedColors: 'active' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // High contrast screenshots
    await expect(page).toHaveScreenshot('high-contrast-capture.png');
  });

  test('loading states consistency', async ({ page }) => {
    // Mock slow loading
    await page.route('**/api/themes', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    await page.goto('/themes');
    
    // Capture loading state
    await page.waitForSelector('[data-testid="loading-spinner"]');
    await expect(page).toHaveScreenshot('loading-state.png');
  });

  test('navigation header consistency', async ({ page }) => {
    const pages = ['/', '/themes', '/process', '/result'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Screenshot of navigation header
      const header = page.locator('header');
      const pageName = pagePath === '/' ? 'home' : pagePath.slice(1);
      await expect(header).toHaveScreenshot(`header-${pageName}.png`);
    }
  });

  test('button states and interactions', async ({ page }) => {
    await page.goto('/');
    
    // Normal button state
    const captureButton = page.locator('button:has-text("Capture Photo")');
    await expect(captureButton).toHaveScreenshot('button-normal.png');
    
    // Hover state
    await captureButton.hover();
    await expect(captureButton).toHaveScreenshot('button-hover.png');
    
    // Focus state
    await captureButton.focus();
    await expect(captureButton).toHaveScreenshot('button-focus.png');
    
    // Disabled state (navigate to a page with disabled button)
    await page.goto('/themes');
    const continueButton = page.locator('button:has-text("Continue to Processing")');
    await expect(continueButton).toHaveScreenshot('button-disabled.png');
  });

  test('form validation visual feedback', async ({ page }) => {
    // Navigate to a page with form validation (if any)
    await page.goto('/');
    
    // Trigger validation errors and capture visual feedback
    // This would depend on your specific form implementation
    
    // For now, test any validation messages that might appear
    await page.waitForLoadState('networkidle');
    
    // Screenshot of any validation states
    await expect(page).toHaveScreenshot('form-validation.png');
  });
});