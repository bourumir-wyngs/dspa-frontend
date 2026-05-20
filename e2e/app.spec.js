const { expect, test } = require('@playwright/test');
const { login, mockBackend } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('requires login before showing the application shell', async ({ page }) => {
  await expect(page.locator('.login-form')).toBeVisible();
  await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
});

test('logs in and renders the home page navigation', async ({ page }) => {
  await login(page);

  await expect(page.getByText('DynaProt', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /find proteins/i })).toBeVisible();
  await expect(page.locator('#condition-select')).toContainText('Oxidative stress');
});

test('runs a protein search from the search page', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /find proteins/i }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('heading', { name: /search protein/i })).toBeVisible();

  await page.locator('.search-input').fill('P0A9P4');
  await page.getByRole('button', { name: /^search$/i }).click();

  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'P0A9P4' })).toBeVisible();
});
