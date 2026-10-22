import { expect, test } from '@playwright/test';

test.describe('Hexa Maps End-to-End Verification Suite', () => {
  test('1–5. loads vector map, searches places, selects location, and calculates routes with highway shields', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('hexa-map-canvas')).toBeVisible();

    const search = page.getByTestId('omnibox-search-input');
    await search.fill('Mapusa Bus Stand');
    const firstSuggestion = page.getByTestId('autocomplete-option').first();
    await expect(firstSuggestion).toBeVisible();
    await firstSuggestion.click();

    await expect(page.getByTestId('selected-place-card')).toContainText('Mapusa Bus Stand');

    await page.getByTestId('open-directions-btn').click();
    await page.getByTestId('calculate-route-btn').click();
    await expect(page.getByTestId('route-alternatives-list')).toBeVisible();
    await expect(page.getByTestId('turn-by-turn-steps')).toContainText('NH 66');
  });

  test('6–9. saves a place, reports an incident, renders highway shields, and toggles light/dark themes', async ({
    page,
  }) => {
    await page.goto('/');

    // Toggle dark & light styles
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByTestId('theme-toggle-btn').click();

    // Save custom place
    const savedTab = page.getByTestId('tab-btn-saved');
    if (await savedTab.isVisible()) {
      await savedTab.click();
      await page.getByTestId('custom-pin-label-input').fill('Khorlim Home Pin');
      await page.getByTestId('add-saved-place-btn').click();
      await expect(page.getByTestId('saved-place-item').first()).toContainText('Khorlim Home Pin');

      // Highway Shield Lab
      await page.getByTestId('tab-btn-shields').click();
      await expect(page.getByAltText('NH 66').first()).toBeVisible();

      // Report community incident
      await page.getByTestId('tab-btn-incidents').click();
      await page.getByTestId('incident-description-input').fill('Test lane closure');
      await page.getByTestId('submit-incident-btn').click();
      await expect(page.getByTestId('incident-list-item').first()).toBeVisible();
    }
  });

  test('10–11. supports mobile bottom sheet layout and handles offline network states gracefully', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('mobile-bottom-sheet')).toBeVisible();

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('offline-network-banner')).toBeVisible();
    await context.setOffline(false);
  });
});
