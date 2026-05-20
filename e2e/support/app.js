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

const mockExperiments = [
  {
    dynaprot_experiment: 'DPX000004-1',
    organism: 'Escherichia coli',
    perturbation: 'Malate',
    condition: 'Malate 5 mM',
    protease: 'Proteinase K',
    doi: 'https://doi.org/10.1021/mock-malate',
  },
  {
    dynaprot_experiment: 'DPX000005-1',
    organism: 'Escherichia coli',
    perturbation: 'Malate',
    condition: 'Malate 25 mM',
    protease: 'Proteinase K',
    doi: '',
  },
  {
    dynaprot_experiment: 'DPX000006-1',
    organism: 'Homo sapiens',
    perturbation: 'Rapamycin',
    condition: 'Rapamycin treatment',
    protease: 'Trypsin',
    doi: null,
  },
];

const mockProteinSequence = 'MSEGWNQHKLAAEKVQQRLSSLGGENIARTFATDKKLPYPQLAQELVRLQQGRLDAALKLAAEAGAQRQALEQGEQARREIGALADQLAELRAGAWTAVEKGRHAVAERVTALQDKLTAARGEAAERLAGLQRQWQKALTEATQTRDRAIAELKRQAEELKALEQGRLSRERALLAEKLAAGLARMPSTSTTSGWVSLETATPALYAKSYKGNKIHMARIFDHARALLGEGMDAGVADIHGPKGLGRVTTRPCLYCARLGRRSAGLKNVIGQVVPGRPRPHVSLMVLPAAMPDETVQFQSMGGV';

const mockProteinExperimentIDs = [
  'Mal_5mM_vs_CTR_LiP',
  'Mal_25mM_vs_CTR_LiP',
];

const createLipScoreArray = (scoresByIndex) => {
  const scores = Array(mockProteinSequence.length).fill(null);

  Object.entries(scoresByIndex).forEach(([index, score]) => {
    scores[Number(index)] = score;
  });

  return scores;
};

const mockProteinLipScoreList = [
  {
    experimentID: 'Mal_5mM_vs_CTR_LiP',
    data: createLipScoreArray({
      0: 5.81,
      49: 3.83,
      119: null,
      149: -3.42,
    }),
  },
  {
    experimentID: 'Mal_25mM_vs_CTR_LiP',
    data: createLipScoreArray({
      0: 2.2,
      49: -1.3,
      149: -2.5,
    }),
  },
];

const mockProteinDifferentialAbundanceData = Object.fromEntries(
  mockProteinLipScoreList.map(({ experimentID, data }) => [
    experimentID,
    data
      .map((score, index) => ({ index, score }))
      .filter(({ score }) => score !== null),
  ])
);

const mockProteinFeatures = [
  { type: 'DOMAIN', start: 1, end: 120, label: 'ATP-grasp domain', description: 'ATP-grasp domain' },
  { type: 'DOMAIN', start: 150, end: 300, label: 'Biotin/lipoyl attachment', description: 'Biotin/lipoyl attachment' },
  { type: 'BINDING', start: 50, end: 55, label: 'ATP binding', description: 'ATP binding' },
  { type: 'ACT_SITE', start: 120, end: 125, label: 'Catalytic residue', description: 'Catalytic residue' },
  { type: 'HELIX', start: 10, end: 30, label: 'Helix 1', description: 'Helix 1' },
  { type: 'HELIX', start: 200, end: 220, label: 'Helix 2', description: 'Helix 2' },
  { type: 'TURN', start: 40, end: 45, label: 'Turn 1', description: 'Turn 1' },
];

const getMockProteinData = (proteinName) => ({
  proteinName,
  proteinSequence: mockProteinSequence,
  proteinDescription: `Mock structural barcode protein ${proteinName}`,
  featuresData: {
    sequence: mockProteinSequence,
    features: mockProteinFeatures,
  },
  experimentIDsList: mockProteinExperimentIDs,
  lipscoreList: mockProteinLipScoreList,
  experimentMetaData: [
    {
      dpx_comparison: 'Mal_5mM_vs_CTR_LiP',
      condition: 'Malate',
      dose: 'Malate 5 mM',
    },
    {
      dpx_comparison: 'Mal_25mM_vs_CTR_LiP',
      condition: 'Malate',
      dose: 'Malate 25 mM',
    },
  ],
  differentialAbundanceData: mockProteinDifferentialAbundanceData,
  barcodeSequence: {
    Mal_5mM_vs_CTR_LiP: mockProteinSequence,
    Mal_25mM_vs_CTR_LiP: mockProteinSequence,
  },
});

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

const mockExperimentSignificantProteins = [
  {
    ...mockConditionProteinScores[0],
    comparison: 'Mal_5mM_vs_CTR_LiP',
  },
  {
    ...mockConditionProteinScores[1],
    comparison: 'Mal_5mM_vs_CTR_LiP',
  },
  {
    ...mockConditionProteinScores[2],
    comparison: 'Mal_25mM_vs_CTR_LiP',
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

const mockGoEnrichmentData = [
  {
    go_term: 'amino acid biosynthetic process',
    dpx_comparison: 'Mal_5mM_vs_CTR_LiP',
    adj_pval: 0.001,
    accessions: 'P00561,P0C8J6',
  },
  {
    go_term: 'central metabolism',
    dpx_comparison: 'Mal_25mM_vs_CTR_LiP',
    adj_pval: 0.004,
    accessions: 'P76569',
  },
  {
    go_term: 'amino acid biosynthetic process',
    dpx_comparison: 'Mal_25mM_vs_CTR_LiP',
    adj_pval: 0.02,
    accessions: 'P00561',
  },
];

const mockConditionData = {
  condition: 'Malate|||562',
  conditionName: 'Malate',
  differentialAbundanceDataList: mockDifferentialAbundanceDataList,
  // These e2e tests cover condition navigation and the protein table, not the
  // heavier Nightingale rendering path.
  experimentIDsList: [],
  proteinScoresTable: mockConditionProteinScores,
  goTerms: [],
};

async function mockBackend(page) {
  await page.route('**/api/v1/experiments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        experiments: mockExperiments,
      }),
    });
  });

  await page.route('**/api/v1/experiment?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const experimentID = requestUrl.searchParams.get('experimentID') || 'DPX000004-1';
    const includeQcPdf = requestUrl.searchParams.get('includeQcPdf') === 'true';
    const isMalate25mM = experimentID === 'DPX000005' || experimentID === 'DPX000005-1';
    const condition = isMalate25mM ? 'Malate 25 mM' : 'Malate 5 mM';
    const qcPdfFile = includeQcPdf
      ? { data: [37, 80, 68, 70, 45, 49, 46, 55, 10] }
      : null;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        experimentData: {
          experimentID,
          perturbation: 'Malate',
          metaData: {
            condition,
            taxonomy_id: '562',
            strain: 'K-12',
            publication: 'Mock publication',
            instrument: 'Mock instrument',
            experiment: 'LiP-MS',
            digestion_protocol: 'Mock protocol',
            protease: 'Proteinase K',
            pk_digestion_time_in_sec: 60,
            qc_pdf_file: qcPdfFile,
          },
          differentialAbundanceDataList: mockDifferentialAbundanceDataList,
          goEnrichmentData: mockGoEnrichmentData,
          significantProteins: mockExperimentSignificantProteins,
        },
      }),
    });
  });

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
    const requestUrl = new URL(route.request().url());
    const proteinName = requestUrl.searchParams.get('proteinName') || 'P0A9P4';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        proteinData: getMockProteinData(proteinName),
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

module.exports = {
  login,
  mockBackend,
  mockProteinExperimentIDs,
  mockProteinSequence,
};
