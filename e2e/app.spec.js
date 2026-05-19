const { expect, test } = require('@playwright/test');

const mockSearchResults = {
  success: true,
  table: [
    {
      proteinName: 'P0A9P4',
      geneName: 'gapA',
      taxonomyName: 'Escherichia coli',
      proteinDescription: 'Mock glyceraldehyde-3-phosphate dehydrogenase result',
    },
    {
      proteinName: 'P0A9P5',
      geneName: 'mockB',
      taxonomyName: 'Escherichia coli',
      proteinDescription: 'Second mocked search result',
    },
  ],
};

const mockConditionProteinScores = [
  {
    proteinAccession: 'P00561',
    maxLog2FC: 5.81,
    n_peptides: 8,
    protein_description: 'Bifunctional aspartokinase/homoserine dehydrogenase 1',
  },
  {
    proteinAccession: 'P0C8J6',
    maxLog2FC: 3.83,
    n_peptides: 2,
    protein_description: 'D-tagatose-1,6-bisphosphate aldolase subunit GatY',
  },
  {
    proteinAccession: 'P76569',
    maxLog2FC: -3.42,
    n_peptides: 5,
    protein_description: 'Uncharacterized protein YfgD',
  },
];

const mockDifferentialAbundanceDataList = [
  {
    experimentID: 'DPX000004-1',
    dpx_comparison: 'Mal_5mM_vs_CTR_LiP',
    dose: 'Mal_5mM_vs_CTR_LiP',
    data: [
      {
        pep_grouping_key: 'P00561-peptide-1',
        pg_protein_accessions: 'P00561',
        diff: 5.81,
        adj_pval: 0.001,
      },
      {
        pep_grouping_key: 'P0C8J6-peptide-1',
        pg_protein_accessions: 'P0C8J6',
        diff: 3.83,
        adj_pval: 0.003,
      },
      {
        pep_grouping_key: 'P76569-peptide-1',
        pg_protein_accessions: 'P76569',
        diff: -3.42,
        adj_pval: 0.005,
      },
    ],
  },
  {
    experimentID: 'DPX000005-1',
    dpx_comparison: 'Mal_25mM_vs_CTR_LiP',
    dose: 'Mal_25mM_vs_CTR_LiP',
    data: [
      {
        pep_grouping_key: 'P00561-peptide-2',
        pg_protein_accessions: 'P00561',
        diff: 2.2,
        adj_pval: 0.02,
      },
      {
        pep_grouping_key: 'P0C8J6-peptide-2',
        pg_protein_accessions: 'P0C8J6',
        diff: -1.3,
        adj_pval: 0.04,
      },
      {
        pep_grouping_key: 'P76569-peptide-2',
        pg_protein_accessions: 'P76569',
        diff: -2.5,
        adj_pval: 0.01,
      },
    ],
  },
];

const mockConditionData = {
  condition: 'Malate|||562',
  conditionName: 'Malate',
  differentialAbundanceDataList: mockDifferentialAbundanceDataList,
  // This test covers condition navigation and the protein table, not the
  // heavier Nightingale rendering path.
  experimentIDsList: [],
  proteinScoresTable: mockConditionProteinScores,
  goTerms: [],
};

async function mockBackend(page) {
  await page.route('**/api/v1/condition/allconditions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        conditions: [
          { value: 'control', label: 'Control' },
          { value: 'oxidative-stress', label: 'Oxidative stress' },
          { value: 'rapamycin', label: 'Rapamycin — Homo sapiens' },
          { value: 'Malate|||562', label: 'Malate — Escherichia coli' },
        ],
      }),
    });
  });

  await page.route('**/api/v1/condition/data*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        conditionData: mockConditionData,
      }),
    });
  });
  await page.route('**/api/v1/proteins*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        proteinData: {
          featuresData: {
            sequence: 'MSEGWNQHKLAAEKVQQRLSSLGGENIARTFATDKKLPYPQLAQELVRLQQGRLDAALKLAAEAGAQRQALEQGEQARREIGALADQLAELRAGAWTAVEKGRHAVAERVTALQDKLTAARGEAAERLAGLQRQWQKALTEATQTRDRAIAELKRQAEELKALEQGRLSRERALLAEKLAAGLARMPSTSTTSGWVSLETATPALYAKSYKGNKIHMARIFDHARALLGEGMDAGVADIHGPKGLGRVTTRPCLYCARLGRRSAGLKNVIGQVVPGRPRPHVSLMVLPAAMPDETVQFQSMGGV',
            features: [
              { type: 'DOMAIN', start: 1, end: 120, label: 'ATP-grasp domain' },
              { type: 'DOMAIN', start: 150, end: 300, label: 'Biotin/lipoyl attachment' },
              { type: 'BINDING', start: 50, end: 55, label: 'ATP binding' },
              { type: 'ACT_SITE', start: 120, end: 125, label: 'Catalytic residue' },
              { type: 'HELIX', start: 10, end: 30, label: 'Helix 1' },
              { type: 'HELIX', start: 200, end: 220, label: 'Helix 2' },
              { type: 'TURN', start: 40, end: 45, label: 'Turn 1' },
            ],
          },
          differentialAbundanceData: {
            'Mal_5mM_vs_CTR_LiP': [],
            'Mal_25mM_vs_CTR_LiP': [],
          },
        },
      }),
    });
  });

  await page.route('**/rest.uniprot.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ uniProtKBCrossReferences: [] }),
    });
  });

  await page.route('**/api/v1/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSearchResults),
    });
  });
}

async function login(page) {
  await page.locator('.login-form input[type="text"]').fill('lipatlas');
  await page.locator('.login-form input[type="password"]').fill('lipatlas');
  await page.getByRole('button', { name: /^login$/i }).click();
}

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
test('home page has condition combo, protein search, and three buttons', async ({ page }) => {
  await login(page);

  // Assert entries from Select a Condition combo box
  const conditionSelect = page.locator('#condition-select');
  await expect(conditionSelect).toContainText('Control');
  await expect(conditionSelect).toContainText('Oxidative stress');
  await expect(conditionSelect).toContainText('Rapamycin — Homo sapiens');

  // Assert protein search box present
  await expect(page.locator('#protein-search')).toBeVisible();

  // Assert all 3 buttons present
  await expect(page.getByRole('button', { name: 'Proceed with selection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Experiments' })).toBeVisible();

  // Click Rapamycin and proceed with selection
  await conditionSelect.selectOption({ label: 'Rapamycin — Homo sapiens' });
  await page.getByRole('button', { name: 'Proceed with selection' }).click();
  await expect(page).toHaveURL(/\/condition\/rapamycin$/);
});
test('select condition dropdown navigates to Malate page', async ({ page }) => {
  await login(page);

  await page.locator('#condition-select').selectOption({ label: 'Malate — Escherichia coli' });
  await page.getByRole('button', { name: 'Proceed with selection' }).click();

  await expect(page).toHaveURL(/\/condition\/Malate/);
  await expect(page.getByRole('heading', { name: /Condition - Malate/ })).toBeVisible({ timeout: 10000 });

  const proteinTable = page.locator('.condition-protein-table');
  await expect(proteinTable.getByRole('link', { name: 'P00561' })).toBeVisible({ timeout: 10000 });
  await expect(proteinTable.getByRole('link', { name: 'P0C8J6' })).toBeVisible();
  await expect(proteinTable.getByRole('link', { name: 'P76569' })).toBeVisible();
});
