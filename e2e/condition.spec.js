const fs = require('fs/promises');
const { expect, test } = require('@playwright/test');
const { login, mockBackend } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('navigates to a condition page from the home page condition controls', async ({ page }) => {
  await login(page);

  const conditionSelect = page.locator('#condition-select');
  await expect(conditionSelect).toContainText('Control');
  await expect(conditionSelect).toContainText('Oxidative stress');
  await expect(conditionSelect).toContainText('Rapamycin — Homo sapiens');

  await expect(page.locator('#protein-search')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed with selection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Experiments' })).toBeVisible();

  await conditionSelect.selectOption({ label: 'Rapamycin — Homo sapiens' });
  await page.getByRole('button', { name: 'Proceed with selection' }).click();

  await expect(page).toHaveURL(/\/condition\/rapamycin$/);
});

test('renders the selected condition page protein table', async ({ page }) => {
  await login(page);

  await page.locator('#condition-select').selectOption({ label: 'Malate — Escherichia coli' });
  const firstProteinResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/proteins') &&
    response.url().includes('proteinName=P00561') &&
    response.status() === 200
  );
  await page.getByRole('button', { name: 'Proceed with selection' }).click();
  await firstProteinResponse;

  await expect(page).toHaveURL(/\/condition\/Malate/);
  await expect(page.getByRole('heading', { name: /Condition - Malate/ })).toBeVisible({ timeout: 10000 });

  const conditionSelect = page.locator('#conditionSelect');
  await expect(conditionSelect).toHaveValue('Malate|||562');
  await expect(conditionSelect).toContainText('Control');
  await expect(conditionSelect).toContainText('Malate — Escherichia coli');

  await expect(page.getByRole('button', { name: 'Volcano Plot' })).toHaveClass(/active/);
  await expect(page.getByText('Peptides in P00561')).toBeVisible();
  await expect(page.getByText('Up (adj.p < 0.05, log2FC > 1)')).toBeVisible();
  await expect(page.getByText('Down (adj.p < 0.05, log2FC < -1)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const csv = await fs.readFile(downloadPath, 'utf8');

  expect(download.suggestedFilename()).toBe('differential_abundance_data.csv');
  expect(csv.trim().split('\n')).toHaveLength(7);
  expect(csv).toContain('Experiment ID,Comparison,Peptide Key,Protein Accession,Fold Change (log2),q-value');
  expect(csv).toContain('DPX000004-1,Mal_5mM_vs_CTR_LiP,P00561-peptide-1,P00561,5.81,0.001');
  expect(csv).toContain('DPX000005-1,Mal_25mM_vs_CTR_LiP,P76569-peptide-2,P76569,-2.5,0.01');

  await expect(page.locator('.volcano-plot-section .plot-wrapper')).toHaveCount(2);
  await expect(page.locator('.volcano-plot-section circle')).toHaveCount(6);
  await expect(page.locator('.volcano-plot-section circle.pep-key-P00561-peptide-1')).toHaveAttribute('stroke', 'black');
  await expect(page.locator('.volcano-plot-section circle.pep-key-P00561-peptide-2')).toHaveAttribute('stroke', 'black');
  await expect(page.locator('.volcano-plot-section text').filter({ hasText: 'Mal_5mM_vs_CTR_LiP' })).toBeVisible();
  await expect(page.locator('.volcano-plot-section text').filter({ hasText: 'Mal_25mM_vs_CTR_LiP' })).toBeVisible();

  await expect(page.getByRole('heading', { level: 2, name: 'Significant Proteins across Condition Comparisons' })).toBeVisible();
  const proteinTable = page.locator('.condition-protein-table');
  await expect(proteinTable.getByRole('columnheader', { name: 'Protein Accession' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Max log2FC among Experiments' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Number of Significant Peptides among Experiments' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Description' })).toBeVisible();

  await expect(proteinTable.getByRole('link', { name: 'P00561' })).toBeVisible({ timeout: 10000 });
  await expect(proteinTable.getByRole('link', { name: 'P0C8J6' })).toBeVisible();
  await expect(proteinTable.getByRole('link', { name: 'P76569' })).toBeVisible();

  const firstProteinRow = proteinTable.locator('tbody tr').filter({ hasText: 'P00561' });
  await expect(firstProteinRow).toContainText('5.81');
  await expect(firstProteinRow).toContainText('8');
  await expect(firstProteinRow).toContainText('Bifunctional aspartokinase/homoserine dehydrogenase 1');
  await expect(firstProteinRow).toHaveClass(/selected/);

  const gatYRow = proteinTable.locator('tbody tr').filter({ hasText: 'P0C8J6' });
  await expect(gatYRow).toContainText('3.83');
  await expect(gatYRow).toContainText('2');
  await expect(gatYRow).toContainText('D-tagatose-1,6-bisphosphate aldolase subunit GatY');

  const yfgDRow = proteinTable.locator('tbody tr').filter({ hasText: 'P76569' });
  await expect(yfgDRow).toContainText('-3.42');
  await expect(yfgDRow).toContainText('5');
  await expect(yfgDRow).toContainText('Uncharacterized protein YfgD');

  await expect(page.locator('.condition-protein-container').getByRole('heading', { name: 'P00561' })).toBeVisible();
  const yfgDProteinResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/proteins') &&
    response.url().includes('proteinName=P76569') &&
    response.status() === 200
  );
  await yfgDRow.click();
  await yfgDProteinResponse;

  await expect(yfgDRow).toHaveClass(/selected/);
  await expect(page.locator('.condition-protein-container').getByRole('heading', { name: 'P76569' })).toBeVisible();
  await expect(page.getByText('Peptides in P76569')).toBeVisible();
  await expect(page.locator('.volcano-plot-section circle.pep-key-P76569-peptide-1')).toHaveAttribute('stroke', 'black');
  await expect(page.locator('.volcano-plot-section circle.pep-key-P76569-peptide-2')).toHaveAttribute('stroke', 'black');
});
