import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}), { virtual: true });

jest.mock('@nightingale-elements/nightingale-sequence', () => ({}), { virtual: true });

jest.mock('../../components/NightingaleComponent.jsx', () => (props) => (
  <div data-testid="nightingale-component">
    {props.masterCondition}::{props.selectedPdbId}::{props.passedExperimentIDs.length}
  </div>
));

jest.mock('../../visualization/volcanoplot.js', () => (props) => (
  <div data-testid="volcano-plot">{props.highlightedProtein}</div>
));

jest.mock('../../visualization/DoseResponse.js', () => (props) => (
  <div data-testid="dose-response-curves">{props.curves.length}:{props.points.length}</div>
));

jest.mock('../../visualization/ProteinScoresTable.js', () => ({
  ProteinScoresTable: ({ experimentData, onProteinClick }) => (
    <div>
      <div data-testid="protein-scores-table">{experimentData.map(item => item.proteinAccession).join(',')}</div>
      {experimentData.map(item => (
        <button
          key={item.proteinAccession}
          type="button"
          onClick={() => onProteinClick(item.proteinAccession)}
        >
          Show {item.proteinAccession}
        </button>
      ))}
    </div>
  )
}));

import Condition from '../../components/ConditionView';

describe('ConditionView', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockNavigate.mockReset();
    mockUseParams.mockReset();
    mockUseParams.mockReturnValue({ selectedCondition: 'heat-shock' });

    global.fetch = jest.fn((url) => {
      if (url.includes('condition/allconditions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            conditions: [
              { value: 'heat-shock', label: 'Heat shock' },
              { value: 'cold-shock', label: 'Cold shock' },
            ],
          }),
        });
      }

      if (url.includes('condition/data?condition=heat-shock')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conditionData: {
              condition: 'heat-shock',
              differentialAbundanceDataList: [{ protein: 'P11111', log2fc: 2 }],
              experimentIDsList: ['EXP-1'],
              proteinScoresTable: [
                { proteinAccession: 'P11111' },
                { proteinAccession: 'P22222' },
              ],
              goTerms: ['stress response'],
              doseResponseExperiments: ['DYN-1'],
            },
          }),
        });
      }

      if (url.includes('condition/data?condition=cold-shock')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conditionData: {
              condition: 'cold-shock',
              differentialAbundanceDataList: [],
              experimentIDsList: ['EXP-2'],
              proteinScoresTable: [{ proteinAccession: 'P33333' }],
              goTerms: [],
              doseResponseExperiments: [],
            },
          }),
        });
      }

      if (url.includes('proteins?proteinName=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ proteinData: { sequence: 'MPEPTIDE' } }),
        });
      }

      if (url.includes('rest.uniprot.org/uniprotkb/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            uniProtKBCrossReferences: [
              {
                database: 'PDB',
                id: '1ABC',
                properties: [{ key: 'Method', value: 'X-ray' }],
              },
            ],
          }),
        });
      }

      if (url.includes('doseresponse?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            doseResponseDataPlotCurve: [{ id: 'curve-1' }],
            doseResponseDataPlotPoints: [{ id: 'point-1' }],
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  it('renders fetched condition data and dependent sections', async () => {
    render(<Condition />);

    expect(await screen.findByText(/Condition - Heat shock/i)).toBeInTheDocument();

    expect(screen.getByText(/Top proteins/i)).toBeInTheDocument();
    expect(screen.getByTestId('protein-scores-table')).toHaveTextContent('P11111');
    const volcano = await screen.findByTestId('volcano-plot');
    expect(volcano).toHaveTextContent('P11111');
    const nightingale = await screen.findByTestId('nightingale-component');
    expect(nightingale).toHaveTextContent('Heat shock::AF-P11111-F1::1');

    expect(await screen.findByText(/Dose-Response-Data for Peptides in P11111/i)).toBeInTheDocument();
    const dose = await screen.findByTestId('dose-response-curves');
    expect(dose).toHaveTextContent('1:1');
  });

  it('navigates when the selected condition changes', async () => {
    render(<Condition />);

    expect(await screen.findByText(/Condition - Heat shock/i)).toBeInTheDocument();
    expect(await screen.findByTestId('nightingale-component')).toHaveTextContent('Heat shock::AF-P11111-F1::1');
    expect(await screen.findByTestId('dose-response-curves')).toHaveTextContent('1:1');

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cold-shock' } });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/condition/cold-shock');
    });
  });

  it('updates the displayed protein and dependent panels when a protein is clicked', async () => {
    render(<Condition />);

    expect(await screen.findByText(/Condition - Heat shock/i)).toBeInTheDocument();
    expect(await screen.findByTestId('volcano-plot')).toHaveTextContent('P11111');

    fireEvent.click(screen.getByRole('button', { name: 'Show P22222' }));

    await waitFor(() => {
      expect(screen.getByTestId('volcano-plot')).toHaveTextContent('P22222');
    });

    expect(screen.getByRole('heading', { level: 2, name: 'P22222' })).toBeInTheDocument();
    expect(await screen.findByText(/Dose-Response-Data for Peptides in P22222/i)).toBeInTheDocument();

    const proteinFetches = global.fetch.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('proteins?proteinName='));
    expect(proteinFetches.some((url) => url.includes('proteinName=P22222'))).toBe(true);

    const doseResponseFetches = global.fetch.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('doseresponse?'));
    expect(doseResponseFetches.some((url) => url.includes('proteinName=P22222'))).toBe(true);
  });

  it('renders the condition value when no label is available', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('condition/allconditions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            conditions: [{ value: 'heat-shock' }],
          }),
        });
      }

      if (url.includes('condition/data?condition=heat-shock')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conditionData: {
              condition: 'heat-shock',
              differentialAbundanceDataList: [],
              experimentIDsList: [],
              proteinScoresTable: [],
              goTerms: [],
              doseResponseExperiments: [],
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ proteinData: {} }),
      });
    });

    render(<Condition />);

    expect(await screen.findByText('Condition - heat-shock')).toBeInTheDocument();
  });

  it('shows an error message when the condition request fails', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('condition/allconditions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            conditions: [{ value: 'heat-shock', label: 'Heat shock' }],
          }),
        });
      }

      if (url.includes('condition/data?condition=heat-shock')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<Condition />);

    expect(await screen.findByText(/Error: Error: HTTP error! Status: 500/i)).toBeInTheDocument();
  });
});
