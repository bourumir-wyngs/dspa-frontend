const fs = require('fs/promises');
const { expect, test } = require('@playwright/test');
const { login, mockBackend } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('renders experiment details, plots, downloads, and significant proteins', async ({ page }) => {
  await login(page);

  const experimentResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/experiment?') &&
    response.url().includes('experimentID=DPX000005') &&
    !response.url().includes('includeQcPdf=true') &&
    response.status() === 200
  );

  await page.goto('/experiment/DPX000005');
  await experimentResponse;

  await expect(page).toHaveURL(/\/experiment\/DPX000005$/);
  await expect(page.getByRole('heading', { name: /DynaProt Experiment Comparison ID: DPX000005/ })).toBeVisible();

  const metadata = page.locator('.experiment-metadata-container');
  await expect(metadata).toContainText('General Information');
  await expect(metadata).toContainText('Perturbation: Malate');
  await expect(metadata).toContainText('Condition: Malate 25 mM');
  await expect(metadata).toContainText('Taxonomy ID: 562');
  await expect(metadata).toContainText('Strain: K-12');
  await expect(metadata).toContainText('Publication: Mock publication');
  await expect(metadata).toContainText('Methods');
  await expect(metadata).toContainText('Instrument: Mock instrument');
  await expect(metadata).toContainText('Experiment: LiP-MS');
  await expect(metadata).toContainText('Digestion Protocol: Mock protocol');
  await expect(metadata).toContainText('Protease: Proteinase K');
  await expect(metadata).toContainText('Digestion Time (Sec): 60');

  const qcDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download QC Data as PDF' }).click();
  const qcDownload = await qcDownloadPromise;
  const qcPdf = await fs.readFile(await qcDownload.path());
  expect(qcDownload.suggestedFilename()).toBe('Experiment_DPX000005_QC.pdf');
  expect(qcPdf.subarray(0, 4).toString()).toBe('%PDF');

  await expect(page.getByRole('heading', { name: 'Volcano Plots per comparison' })).toBeVisible();
  await expect(page.locator('.experiment-volcano-plots-wrapper .plot-wrapper')).toHaveCount(2);
  await expect(page.locator('.experiment-volcano-plots-wrapper circle')).toHaveCount(6);
  await expect(page.locator('.experiment-volcano-plots-wrapper text').filter({ hasText: 'Mal_5mM_vs_CTR_LiP' })).toBeVisible();
  await expect(page.locator('.experiment-volcano-plots-wrapper text').filter({ hasText: 'Mal_25mM_vs_CTR_LiP' })).toBeVisible();

  const csvDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const csvDownload = await csvDownloadPromise;
  const csv = await fs.readFile(await csvDownload.path(), 'utf8');
  expect(csvDownload.suggestedFilename()).toBe('differential_abundance_data.csv');
  expect(csv.trim().split('\n')).toHaveLength(7);
  expect(csv).toContain('DPX000004-1,Mal_5mM_vs_CTR_LiP,P00561-peptide-1,P00561,5.81,0.001');
  expect(csv).toContain('DPX000005-1,Mal_25mM_vs_CTR_LiP,P76569-peptide-2,P76569,-2.5,0.01');

  await expect(page.getByRole('heading', { name: 'Gene Ontology Enrichment Analysis' })).toBeVisible();
  await expect(page.locator('.go-enrichment-visualization svg')).toBeVisible();
  await expect(page.locator('.go-enrichment-visualization text').filter({ hasText: 'Grouped Bar Plot of GO Enrichment by Experiment' })).toBeVisible();
  await expect(page.locator('.go-enrichment-visualization text').filter({ hasText: '-log10(Adj-pValue)' })).toBeVisible();
  await expect(page.locator('.go-enrichment-visualization text').filter({ hasText: 'Mal_5mM_vs_CTR_LiP' })).toBeVisible();
  await expect(page.locator('.go-enrichment-visualization text').filter({ hasText: 'Mal_25mM_vs_CTR_LiP' })).toBeVisible();
  await expect.poll(() =>
    page.locator('.go-enrichment-visualization rect').evaluateAll((rects) =>
      rects.filter((rect) => !rect.closest('.legend')).length
    )
  ).toBe(3);

  await expect(page.getByRole('heading', { name: 'Significant Proteins across Comparisons' })).toBeVisible();
  const proteinTable = page.locator('table.condition-protein-table');
  await expect(proteinTable.getByRole('columnheader', { name: 'Accession' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Description' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: /Max log.*FC/ })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Sig. peptides' })).toBeVisible();
  await expect(proteinTable.getByRole('columnheader', { name: 'Comparison' })).toBeVisible();

  await expect(proteinTable.locator('tbody tr')).toHaveCount(3);
  const p00561Row = proteinTable.locator('tbody tr').filter({ hasText: 'P00561' });
  await expect(p00561Row.getByRole('link', { name: 'P00561' })).toHaveAttribute('href', '/visualize/P00561');
  await expect(p00561Row).toContainText('Bifunctional aspartokinase/homoserine dehydrogenase 1');
  await expect(p00561Row).toContainText('5.81');
  await expect(p00561Row).toContainText('8');
  await expect(p00561Row).toContainText('Mal_5mM_vs_CTR_LiP');

  const yfgDRow = proteinTable.locator('tbody tr').filter({ hasText: 'P76569' });
  await expect(yfgDRow).toContainText('Uncharacterized protein YfgD');
  await expect(yfgDRow).toContainText('-3.42');
  await expect(yfgDRow).toContainText('5');
  await expect(yfgDRow).toContainText('Mal_25mM_vs_CTR_LiP');
});
