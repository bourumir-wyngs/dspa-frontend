const { expect, test } = require('@playwright/test');
const { mockBackend, mockUserId } = require('./support/app');
const appBasePath = (process.env.PLAYWRIGHT_APP_PATH || '').replace(/\/+$/, '');
const appPath = (path) => `${appBasePath}${path}`;
const isProtectedApp = process.env.PLAYWRIGHT_PRIVATE_APP === 'true';
const servicesPath = isProtectedApp ? appBasePath : '/db';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto(appPath('/'));
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

test('shows Services beside Experiments and opens the protected service routes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  const services = page.getByRole('region', { name: 'Services' });
  await expect(services).toBeVisible();
  await expect(services.getByRole('button')).toHaveText(['Import data', 'Direct SQL', isProtectedApp ? 'Logout' : 'My data']);
  if (isProtectedApp) {
    await expect(services.getByRole('button', { name: 'Logout' })).toHaveAttribute('title', `User ${mockUserId}`);
  }
  await expect(services.getByText(`User ${mockUserId}`, { exact: true })).toHaveCount(0);

  const boxes = page.locator('.home-container .box');
  await expect(boxes).toHaveCount(4);
  await expect(boxes.nth(2)).toContainText('Go to Experiments');
  await expect(boxes.nth(3)).toContainText('Services');
  const experimentsBox = await boxes.nth(2).boundingBox();
  const servicesBox = await services.boundingBox();
  expect(servicesBox.x).toBeGreaterThan(experimentsBox.x);
  expect(Math.abs(servicesBox.y - experimentsBox.y)).toBeLessThan(1);

  for (const [name, path] of [['Import data', `${servicesPath}/importer/`], ['Direct SQL', `${servicesPath}/adminer/`]]) {
    const targetURL = new URL(path, page.url()).href;
    await page.route(targetURL, (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><h1>${name}</h1>`,
    }));
    await services.getByRole('button', { name }).click();
    await expect(page).toHaveURL(targetURL);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.goto(appPath('/'));
  }
});

for (const status of [204, 401]) {
  test(`returns to the gateway after logout responds ${status}`, async ({ page }) => {
    test.skip(!isProtectedApp, 'Logout belongs to the protected application');
    await page.route(`**${servicesPath}/auth/logout`, (route) => route.fulfill({ status, body: '' }));
    await page.route(new URL('/', page.url()).href, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><h1>Gateway sign-in</h1>',
    }));

    const requestPromise = page.waitForRequest(`**${servicesPath}/auth/logout`);
    await page.getByRole('button', { name: 'Logout' }).click();
    const request = await requestPromise;

    expect(request.method()).toBe('POST');
    await expect(page.getByRole('heading', { name: 'Gateway sign-in' })).toBeVisible();
    await expect(page).toHaveURL(new URL('/', request.url()).href);
  });
}

test('keeps the Services card available when logout fails', async ({ page }) => {
  test.skip(!isProtectedApp, 'Logout belongs to the protected application');
  let respondToLogout;
  const logoutResponse = new Promise((resolve) => { respondToLogout = resolve; });
  await page.route(`**${servicesPath}/auth/logout`, async (route) => {
    await logoutResponse;
    await route.fulfill({ status: 503, body: '' });
  });

  const services = page.getByRole('region', { name: 'Services' });
  const requestPromise = page.waitForRequest(`**${servicesPath}/auth/logout`);
  await services.getByRole('button', { name: 'Logout' }).click();
  const request = await requestPromise;

  expect(request.method()).toBe('POST');
  await expect(services.getByRole('button', { name: 'Logging out…' })).toBeDisabled();
  respondToLogout();
  await expect(services.getByRole('alert')).toHaveText('Could not log out. Please try again.');
  await expect(services.getByRole('button', { name: 'Logout' })).toHaveAttribute('title', `User ${mockUserId}`);
  await expect(services.getByRole('button', { name: 'Logout' })).toBeEnabled();
});

test('runs a protein search from the search page', async ({ page }) => {
  await page.getByRole('link', { name: /find proteins/i }).click();

  await expect(page).toHaveURL(new URL(appPath('/search'), page.url()).href);
  await expect(page.getByRole('heading', { name: /search protein/i })).toBeVisible();

  await page.locator('.search-input').fill('P0A9P4');
  await page.getByRole('button', { name: /^search$/i }).click();

  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'P0A9P4' })).toBeVisible();
});

test('reloads deep links and keeps API calls and protein links on the application mount', async ({ page }) => {
  const apiRequest = page.waitForRequest(`**${appPath('/api/v1/experiment')}?*`);
  await page.goto(appPath('/experiment/DPX000004-1'));
  await apiRequest;
  const proteinLink = page.getByRole('link', { name: 'P00561', exact: true });
  await expect(proteinLink).toHaveAttribute('href', appPath('/visualize/P00561'));
  await page.reload();
  await expect(proteinLink).toBeVisible();
  await expect(page.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', appBasePath || '/');
});
