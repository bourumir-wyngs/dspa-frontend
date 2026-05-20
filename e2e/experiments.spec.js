const { expect, test } = require('@playwright/test');
const { login, mockBackend } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('renders the experiments page as a filterable table', async ({ page }) => {
  await login(page);

  const experimentsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/experiments') &&
    response.status() === 200
  );

  await page.getByRole('link', { name: /^experiments$/i }).click();
  await experimentsResponse;

  await expect(page).toHaveURL(/\/experiments$/);
  await expect(page.getByRole('heading', { name: 'Experiments' })).toBeVisible();

  const table = page.locator('table.experiment-table');
  await expect(table).toBeVisible();
  await expect(page.locator('table')).toHaveCount(1);
  await expect(page.locator('.experiment-card')).toHaveCount(0);
  await expect(page.getByText('Protease')).toHaveCount(0);

  await expect(table.getByRole('columnheader', { name: /DynaProt Experiment ID/i })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /Organism/i })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /Perturbation/i })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /Condition/i })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /^DOI$/i })).toBeVisible();

  await expect(table.locator('tbody tr')).toHaveCount(3);

  const malate5mMRow = table.locator('tbody tr').filter({ hasText: 'DPX000004-1' });
  await expect(malate5mMRow).toContainText('Escherichia coli');
  await expect(malate5mMRow).toContainText('Malate');
  await expect(malate5mMRow).toContainText('Malate 5 mM');
  await expect(malate5mMRow.getByRole('link', { name: 'https://doi.org/10.1021/mock-malate' })).toHaveAttribute(
    'href',
    'https://doi.org/10.1021/mock-malate'
  );

  const malate25mMRow = table.locator('tbody tr').filter({ hasText: 'DPX000005-1' });
  await expect(malate25mMRow).toContainText('Malate 25 mM');
  await expect(malate25mMRow).toContainText('N/A');

  const rapamycinRow = table.locator('tbody tr').filter({ hasText: 'DPX000006-1' });
  await expect(rapamycinRow).toContainText('Homo sapiens');
  await expect(rapamycinRow).toContainText('Rapamycin treatment');
  await expect(rapamycinRow).toContainText('N/A');

  await table.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Homo sapiens' }).click();

  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('DPX000006-1');
  await expect(table).not.toContainText('DPX000004-1');
  await expect(table).not.toContainText('DPX000005-1');

  const experimentResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/experiment?') &&
    response.url().includes('experimentID=DPX000006-1') &&
    response.status() === 200
  );

  await table.locator('tbody tr').click();
  await experimentResponse;

  await expect(page).toHaveURL(/\/experiment\/DPX000006-1$/);
});
