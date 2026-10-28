const { expect, test } = require('@playwright/test');
const { mockBackend } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('shows the application shell in a fresh browser context', async ({ page }) => {
  await expect(page.getByRole('banner').getByRole('link', { name: 'DYNAPROT', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Legal' })).toBeVisible();
});

test('renders the home page navigation', async ({ page }) => {
  await expect(page.getByText('DynaProt', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /find proteins/i })).toBeVisible();
  await expect(page.locator('#condition-select')).toContainText('Oxidative stress');
});

test('runs a protein search from the search page', async ({ page }) => {
  await page.getByRole('link', { name: /find proteins/i }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('heading', { name: /search protein/i })).toBeVisible();

  await page.locator('.search-input').fill('P0A9P4');
  await page.getByRole('button', { name: /^search$/i }).click();

  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'P0A9P4' })).toBeVisible();
});
