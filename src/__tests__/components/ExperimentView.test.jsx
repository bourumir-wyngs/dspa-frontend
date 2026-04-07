import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';

const mockUseParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
}), { virtual: true });

jest.mock('../../visualization/volcanoplot.js', () => (props) => (
  <div data-testid="volcano-plot">{props.differentialAbundanceDataList.length}</div>
));

import ExperimentView from '../../components/ExperimentView';

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const settleEffects = async () => {
  await flushPromises();
  await flushPromises();
  await flushPromises();
};

describe('ExperimentView', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockUseParams.mockReset();
    mockUseParams.mockReturnValue({ experimentID: 'DYN-1' });

    global.fetch = jest.fn((url) => {
      if (url.includes('experiment?experimentID=DYN-1&includeQcPdf=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            experimentData: {
              metaData: {
                qc_pdf_file: {
                  data: [37, 80, 68, 70],
                },
              },
            },
          }),
        });
      }

      if (url.includes('experiment?experimentID=DYN-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            experimentData: {
              experimentID: 'DYN-1',
              perturbation: 'Heat shock',
              differentialAbundanceDataList: [
                { protein: 'P11111', log2fc: 2.1 },
                { protein: 'P22222', log2fc: -1.4 },
              ],
              metaData: {
                condition: 'Stress',
                taxonomy_id: '9606',
                strain: 'K12',
                publication: 'Nature',
                instrument: 'Orbitrap',
                experiment: 'LiP-MS',
                digestion_protocol: 'Protocol A',
                protease: 'Trypsin',
                pk_digestion_time_in_sec: 60,
              },
              significantProteins: [
                {
                  proteinAccession: 'P11111',
                  protein_description: 'Heat shock protein',
                  maxLog2FC: 2.345,
                  n_peptides: 4,
                  comparison: 'heat-vs-control',
                },
                {
                  pg_protein_accessions: 'P22222',
                  protein_description: '',
                  maxLog2FC: null,
                  n_peptides: null,
                  dpx_comparison: '',
                },
              ],
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });
  });

  afterEach(async () => {
    await settleEffects();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = null;
    jest.restoreAllMocks();
  });

  it('renders fetched experiment details and significant proteins', async () => {
    await act(async () => {
      root.render(<ExperimentView />);
    });

    await settleEffects();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('experiment?experimentID=DYN-1'));
    expect(container.textContent).toContain('DynaProt Experiment Comparison ID: DYN-1');
    expect(container.textContent).toContain('Perturbation: Heat shock');
    expect(container.textContent).toContain('Condition: Stress');
    expect(container.textContent).toContain('Taxonomy ID: 9606');
    expect(container.textContent).toContain('Instrument: Orbitrap');
    expect(container.textContent).toContain('Volcano Plots per comparison');
    expect(container.querySelector('[data-testid="volcano-plot"]').textContent).toBe('2');
    expect(container.textContent).toContain('Significant Proteins across Comparisons');
    expect(container.textContent).toContain('P11111');
    expect(container.textContent).toContain('Heat shock protein');
    expect(container.textContent).toContain('2.35');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('heat-vs-control');
    expect(container.textContent).toContain('P22222');
    expect(container.textContent).toContain('N/A');

    const firstProteinLink = container.querySelector('tbody tr a');
    expect(firstProteinLink.getAttribute('href')).toBe('/visualize/P11111');
  });

  it('limits significant proteins table to 25 rows and expands on show_all click', async () => {
    const manyProteins = Array.from({ length: 30 }, (_, index) => ({
      proteinAccession: `P${String(index + 1).padStart(5, '0')}`,
      protein_description: `Protein ${index + 1}`,
      maxLog2FC: index + 0.5,
      n_peptides: index + 1,
      comparison: `comparison-${index + 1}`,
    }));

    global.fetch = jest.fn((url) => {
      if (url.includes('experiment?experimentID=DYN-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            experimentData: {
              experimentID: 'DYN-1',
              perturbation: 'Heat shock',
              differentialAbundanceDataList: [],
              metaData: {
                condition: 'Stress',
                taxonomy_id: '9606',
                strain: 'K12',
                publication: 'Nature',
                instrument: 'Orbitrap',
                experiment: 'LiP-MS',
                digestion_protocol: 'Protocol A',
                protease: 'Trypsin',
                pk_digestion_time_in_sec: 60,
              },
              significantProteins: manyProteins,
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    await act(async () => {
      root.render(<ExperimentView />);
    });

    await settleEffects();

    expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
    expect(container.textContent).toContain('Showing 25 of 30,');
    expect(container.textContent).toContain('show all');
    expect(container.textContent).not.toContain('Protein 30');

    const showAllButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'show all'
    );

    await act(async () => {
      Simulate.click(showAllButton);
    });

    expect(container.querySelectorAll('tbody tr')).toHaveLength(30);
    expect(container.textContent).toContain('Protein 30');
    expect(container.textContent).not.toContain('Showing 25 of 30,');
  });

  it('downloads the QC PDF when requested', async () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;

    window.URL.createObjectURL = jest.fn(() => 'blob:qc-pdf');
    window.URL.revokeObjectURL = jest.fn();

    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    await act(async () => {
      root.render(<ExperimentView />);
    });

    await settleEffects();

    const createdLinks = [];
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        element.click = jest.fn();
        createdLinks.push(element);
      }
      return element;
    });

    const downloadButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Download QC Data as PDF'
    );

    await act(async () => {
      Simulate.click(downloadButton);
    });

    await settleEffects();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('includeQcPdf=true'));
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0].href).toBe('blob:qc-pdf');
    expect(createdLinks[0].download).toBe('Experiment_DYN-1_QC.pdf');
    expect(createdLinks[0].click).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(createdLinks[0]);
    expect(removeChildSpy).toHaveBeenCalledWith(createdLinks[0]);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:qc-pdf');

    createElementSpy.mockRestore();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });
});