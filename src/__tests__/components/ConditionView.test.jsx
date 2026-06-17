import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}), { virtual: true });

jest.mock('../../components/NightingaleComponent.jsx', () => (props) => (
  <div data-testid="nightingale-component">
    {props.masterCondition}::{props.selectedPdbId}::{props.passedExperimentIDs.length}
  </div>
));

jest.mock('../../visualization/volcanoplot.js', () => (props) => (
  <div data-testid="volcano-plot">{props.highlightedProtein}</div>
));


jest.mock('../../visualization/ProteinScoresTable.js', () => ({
  ProteinScoresTable: ({ experimentData, onProteinClick }) => (
    <div>
      <div data-testid="protein-scores-table">{(experimentData || []).map(item => item.proteinAccession).join(',')}</div>
      {(experimentData || []).map(item => (
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

import Condition, { getPdbIds } from '../../components/ConditionView';

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

    expect(screen.getByText(/Significant Proteins across Condition Comparisons/i)).toBeInTheDocument();
    expect(screen.getByTestId('protein-scores-table')).toHaveTextContent('P11111');
    const volcano = await screen.findByTestId('volcano-plot');
    expect(volcano).toHaveTextContent('P11111');
    const nightingale = await screen.findByTestId('nightingale-component');
    expect(nightingale).toHaveTextContent('Heat shock::AF-P11111-F1::1');

  });

  it('keeps protein details when a canonical condition refetch selects the same protein', async () => {
    mockUseParams.mockReturnValue({ selectedCondition: 'heat-shock|||123' });

    let resolveCanonicalCondition;
    const canonicalConditionResponse = new Promise(resolve => {
      resolveCanonicalCondition = resolve;
    });

    const conditionData = {
      condition: 'heat-shock',
      differentialAbundanceDataList: [{ protein: 'P11111', log2fc: 2 }],
      experimentIDsList: ['EXP-1'],
      proteinScoresTable: [
        { proteinAccession: 'P11111' },
        { proteinAccession: 'P22222' },
      ],
      goTerms: ['stress response'],
    };

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

      if (url.includes('condition/data?condition=heat-shock%7C%7C%7C123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ conditionData }),
        });
      }

      if (url.includes('condition/data?condition=heat-shock')) {
        return canonicalConditionResponse;
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
          json: async () => ({ uniProtKBCrossReferences: [] }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<Condition />);

    expect(await screen.findByTestId('nightingale-component')).toHaveTextContent('Heat shock::AF-P11111-F1::1');

    resolveCanonicalCondition({
      ok: true,
      json: async () => ({ conditionData }),
    });

    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url]) => url.includes('condition/data?condition=heat-shock'))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('nightingale-component')).toHaveTextContent('Heat shock::AF-P11111-F1::1');
    });
  });

  it('navigates when the selected condition changes', async () => {
    render(<Condition />);

    expect(await screen.findByText(/Condition - Heat shock/i)).toBeInTheDocument();
    expect(await screen.findByTestId('nightingale-component')).toHaveTextContent('Heat shock::AF-P11111-F1::1');

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cold-shock' } });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/condition/cold-shock');
    });
  });

  it('encodes the selected condition query parameter', async () => {
    mockUseParams.mockReturnValue({ selectedCondition: 'heat-shock&admin=true' });

    global.fetch = jest.fn((url) => {
      if (url.includes('condition/allconditions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            conditions: [
              { value: 'heat-shock&admin=true', label: 'Heat shock admin literal' },
            ],
          }),
        });
      }

      if (url.includes('condition/data?condition=heat-shock%26admin%3Dtrue')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conditionData: {
              condition: 'heat-shock&admin=true',
              differentialAbundanceDataList: [],
              experimentIDsList: [],
              proteinScoresTable: [],
              goTerms: [],
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<Condition />);

    expect(await screen.findByText(/Condition - Heat shock admin literal/i)).toBeInTheDocument();
    expect(global.fetch.mock.calls.some(([url]) => url.includes('condition/data?condition=heat-shock%26admin%3Dtrue'))).toBe(true);
    expect(global.fetch.mock.calls.some(([url]) => url.includes('condition/data?condition=heat-shock&admin=true'))).toBe(false);
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
    const proteinFetches = global.fetch.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('proteins?proteinName='));
    expect(proteinFetches.some((url) => url.includes('proteinName=P22222'))).toBe(true);

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

  describe('getPdbIds helper', () => {
    it('returns AlphaFold + PDB IDs on success', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({
          uniProtKBCrossReferences: [
            { database: 'PDB', id: '1ABC', properties: [{ key: 'Method', value: 'X-ray' }] }
          ]
        })
      }));
      const ids = await getPdbIds('P12345');
      expect(ids).toHaveLength(2);
      expect(ids[0].id).toBe('AF-P12345-F1');
      expect(ids[1].id).toBe('1ABC');
    });

    it('returns only AlphaFold fallback on fetch failure', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
      const ids = await getPdbIds('P12345');
      expect(ids).toHaveLength(1);
      expect(ids[0].id).toBe('AF-P12345-F1');
    });

    it('handles missing uniProtKBCrossReferences', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({})
      }));
      const ids = await getPdbIds('P12345');
      expect(ids).toHaveLength(1);
      expect(ids[0].id).toBe('AF-P12345-F1');
    });
  });

  describe('fetch failure handling', () => {
    it('shows error when condition/allconditions fails', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('condition/allconditions')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ success: false, message: 'Failed to fetch conditions' })
          });
        }
        if (url.includes('condition/data')) {
          return Promise.resolve({
            ok: true,
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<Condition />);
      expect(await screen.findByText(/Error: Failed to fetch conditions/i)).toBeInTheDocument();
    });

    it('handles protein fetch failure gracefully', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('condition/allconditions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, conditions: [{ value: 'heat-shock' }] }),
          });
        }
        if (url.includes('condition/data?condition=heat-shock')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              conditionData: {
                condition: 'heat-shock',
                differentialAbundanceDataList: [],
                experimentIDsList: ['EXP-1'],
                proteinScoresTable: [{ proteinAccession: 'P11111' }],
                goTerms: [],
              },
            }),
          });
        }
        if (url.includes('proteins?proteinName=')) {
          return Promise.resolve({
            ok: false,
            statusText: 'Not Found'
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<Condition />);
      expect(await screen.findByText(/Error fetching protein data: Failed to fetch protein data: Not Found/i)).toBeInTheDocument();
    });

  });

  describe('conditional rendering', () => {

    it('renders safely when proteinScoresTable is empty', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('condition/allconditions')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, conditions: [] }) });
        }
        if (url.includes('condition/data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              conditionData: {
                condition: 'heat-shock',
                differentialAbundanceDataList: [],
                experimentIDsList: [],
                proteinScoresTable: [], // empty
                goTerms: [],
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<Condition />);
      expect(await screen.findByText(/Significant Proteins across Condition Comparisons/i)).toBeInTheDocument();
      expect(screen.queryByTestId('nightingale-component')).not.toBeInTheDocument();
    });
  });

  describe('condition label/value handling', () => {
    it('uses string directly if conditionOption is a string', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('condition/allconditions')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, conditions: ['string-condition'] }) });
        }
        if (url.includes('condition/data')) {
          return new Promise(() => {}); // hang
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<Condition />);
      // Before condition/data loads, it shows "Condition - heat-shock" initially from useParams
      // But the dropdown should contain 'string-condition'
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveTextContent('string-condition');
      });
    });

    it('falls back to condition/value if label is missing in object', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('condition/allconditions')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, conditions: [{ condition: 'fallback-cond', value: 'val-1' }] }) });
        }
        if (url.includes('condition/data')) {
          return new Promise(() => {});
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<Condition />);
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveTextContent('fallback-cond');
      });
    });
  });
});
