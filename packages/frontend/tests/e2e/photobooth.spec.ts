import { test, expect } from '@playwright/test';

test.describe('AI Photobooth E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Photobooth/);
    await expect(page.locator('h1')).toContainText('AI Photobooth');
  });

  test('should display theme selection', async ({ page }) => {
    const themeGrid = page.locator('[data-testid="theme-grid"]');
    await expect(themeGrid).toBeVisible();
    
    const themes = page.locator('[data-testid="theme-card"]');
    await expect(themes).toHaveCount.greaterThan(0);
  });

  test('should handle camera permissions gracefully', async ({ page }) => {
    // Mock camera permission denial
    await page.context().grantPermissions([]);
    
    const cameraButton = page.locator('[data-testid="camera-button"]');
    await cameraButton.click();
    
    const errorMessage = page.locator('[data-testid="camera-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Camera access');
  });

  test('should navigate with keyboard', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    await page.keyboard.press('Enter');
    // Should activate focused element
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    await expect(mobileMenu).toBeVisible();
    
    const themeGrid = page.locator('[data-testid="theme-grid"]');
    await expect(themeGrid).toHaveCSS('grid-template-columns', /1fr/);
  });

  test('should handle offline state', async ({ page }) => {
    await page.context().setOffline(true);
    
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible();
    
    await page.context().setOffline(false);
    await expect(offlineIndicator).not.toBeVisible();
  });

  test('should process image end-to-end', async ({ page }) => {
    // Grant camera permissions
    await page.context().grantPermissions(['camera']);
    
    // Select a theme
    const firstTheme = page.locator('[data-testid="theme-card"]').first();
    await firstTheme.click();
    
    // Start camera
    const cameraButton = page.locator('[data-testid="camera-button"]');
    await cameraButton.click();
    
    // Wait for camera to load
    await page.waitForTimeout(2000);
    
    // Capture photo
    const captureButton = page.locator('[data-testid="capture-button"]');
    await captureButton.click();
    
    // Check processing starts
    const processingIndicator = page.locator('[data-testid="processing-indicator"]');
    await expect(processingIndicator).toBeVisible();
    
    // Wait for result (with timeout)
    const resultImage = page.locator('[data-testid="result-image"]');
    await expect(resultImage).toBeVisible({ timeout: 30000 });
  });
});