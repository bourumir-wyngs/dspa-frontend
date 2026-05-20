const { expect, test } = require('@playwright/test');
const {
  login,
  mockBackend,
  mockProteinExperimentIDs,
  mockProteinSequence,
} = require('./support/app');

const getStructureLipScoreAt = async (structure, index) => {
  const lipScoreArray = await structure.getAttribute('lipscore-array');

  if (!lipScoreArray) {
    return undefined;
  }

  return JSON.parse(lipScoreArray)[index];
};

const removeWebpackDevOverlay = async (page) => {
  const overlay = page.locator('#webpack-dev-server-client-overlay');

  if (await overlay.count()) {
    await overlay.evaluate((element) => element.remove());
  }
};

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
});

test('renders the protein sequence and structural barcode viewer', async ({ page }) => {
  await login(page);

  const proteinResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/proteins') &&
    response.url().includes('proteinName=P0A9P4') &&
    response.status() === 200
  );
  const uniprotResponse = page.waitForResponse((response) =>
    response.url().includes('rest.uniprot.org/uniprotkb/P0A9P4.json') &&
    response.status() === 200
  );

  await page.goto('/visualize/P0A9P4');
  await proteinResponse;
  await uniprotResponse;

  await expect(page).toHaveURL(/\/visualize\/P0A9P4$/);
  await expect(page.getByRole('heading', { name: 'UniProt ID P0A9P4' })).toBeVisible();
  await expect(page.getByText('Mock structural barcode protein P0A9P4')).toBeVisible();

  const viewer = page.locator('#nightingale-manager-container');
  await expect(viewer).toBeVisible();
  await expect(page.getByText('Selected PDB ID: AF-P0A9P4-F1')).toBeVisible();

  const structure = page.locator('nightingale-structure');
  await expect(structure).toHaveAttribute('protein-accession', 'P0A9P4');
  await expect(structure).toHaveAttribute('structure-id', 'AF-P0A9P4-F1');
  await expect(structure).toHaveAttribute('highlight-color', '#FF6699');

  await expect(page.getByText('Sequence', { exact: true })).toBeVisible();
  const sequenceViewer = page.locator('nightingale-sequence#sequence');
  await expect(sequenceViewer).toHaveAttribute('sequence', mockProteinSequence);
  await expect(sequenceViewer).toHaveAttribute('length', String(mockProteinSequence.length));
  await expect(sequenceViewer).toHaveAttribute('display-start', '1');
  await expect(sequenceViewer).toHaveAttribute('display-end', String(mockProteinSequence.length));

  await expect(page.getByText('Structural-Barcode', { exact: true })).toBeVisible();
  const structuralBarcode = page.locator('nightingale-sequence-heatmap[heatmap-id="seq-heatmap"]');
  await expect(structuralBarcode).toHaveAttribute('length', String(mockProteinSequence.length));
  await expect(structuralBarcode).toHaveAttribute('display-start', '1');
  await expect(structuralBarcode).toHaveAttribute('display-end', String(mockProteinSequence.length));

  await expect(page.getByText('Domain', { exact: true })).toBeVisible();
  await expect(page.getByText('Binding site', { exact: true })).toBeVisible();
  await expect(page.getByText('Active site', { exact: true })).toBeVisible();
  await expect(page.getByText('Alpha helix', { exact: true })).toBeVisible();
  await expect(page.getByText('Turn', { exact: true })).toBeVisible();

  const domainTrack = page.locator('nightingale-track#domain');
  await expect(domainTrack).toHaveCount(1);
  await expect.poll(() => domainTrack.evaluate((track) => track.data?.length || 0)).toBe(2);
  await expect.poll(() => page.locator('nightingale-track#binding').evaluate((track) => track.data?.[0]?.description)).toBe('ATP binding');
  await expect.poll(() => page.locator('nightingale-track#act_site').evaluate((track) => track.data?.[0]?.description)).toBe('Catalytic residue');

  await expect(page.getByRole('button', { name: 'Malate 5 mM' })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Malate 5 mM' })).toHaveAttribute('title', `Experiment ${mockProteinExperimentIDs[0]}`);
  await expect(page.getByRole('button', { name: 'Malate 25 mM' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Malate 25 mM' })).toHaveAttribute('title', `Experiment ${mockProteinExperimentIDs[1]}`);
  await expect.poll(() => getStructureLipScoreAt(structure, 0)).toBe(5.81);
  await expect.poll(() => getStructureLipScoreAt(structure, 49)).toBe(3.83);
  await expect.poll(() => getStructureLipScoreAt(structure, 149)).toBe(-3.42);

  await removeWebpackDevOverlay(page);
  await page.getByRole('button', { name: 'Malate 25 mM' }).click();

  await expect(page.getByRole('button', { name: 'Malate 25 mM' })).toHaveClass(/selected/);
  await expect.poll(() => getStructureLipScoreAt(structure, 0)).toBe(2.2);
  await expect.poll(() => getStructureLipScoreAt(structure, 49)).toBe(-1.3);
  await expect.poll(() => getStructureLipScoreAt(structure, 149)).toBe(-2.5);
});
