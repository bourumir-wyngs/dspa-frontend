import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProteinVisualization from '../../components/ProteinView';

// Mock react-router-dom
const mockedUseNavigate = jest.fn();
let mockProteinName = 'P12345';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockedUseNavigate,
  useParams: () => ({ proteinName: mockProteinName }),
  MemoryRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => <div>{element}</div>
}), { virtual: true });

// Mock config
jest.mock('../../config.json', () => ({
  apiEndpoint: 'http://test-api.com/'
}), { virtual: true });

// Mock NightingaleComponent
jest.mock('../../components/NightingaleComponent', () => {
  return function DummyNightingale(props) {
    return (
      <div data-testid="nightingale-component">
        <span>Nightingale Component</span>
        <span>Selected PDB: {props.selectedPdbId}</span>
        <span>PDB count: {props.pdbIds.length}</span>
      </div>
    );
  };
});

// Mock fetch
global.fetch = jest.fn();

describe('ProteinVisualization', () => {
  beforeEach(() => {
    fetch.mockClear();
    // Suppress console.error for expected errors in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  const renderComponent = (proteinName = 'P12345') => {
    return render(
      <ProteinVisualization />
    );
  };

  it('renders loading state initially', async () => {
    fetch.mockImplementation(() => new Promise(resolve => {})); // pending promise
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load protein data/)).toBeInTheDocument();
    });
  });

  it('renders error state when the backend returns a non-ok response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load protein data/)).toBeInTheDocument();
    });
  });

  it('renders protein data and NightingaleComponent on success', async () => {
    // Mock the backend fetch
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        proteinData: {
          proteinName: 'P12345',
          description: 'Test protein'
        }
      })
    });

    // Mock the UniProt fetch
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uniProtKBCrossReferences: [
          { database: 'PDB', id: '1XYZ', properties: [{ key: 'Method', value: 'X-ray' }] }
        ]
      })
    });

    renderComponent();

    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // UniProt ID should be displayed
    expect(screen.getByText('UniProt ID P12345')).toBeInTheDocument();
    
    // Nightingale component should be rendered
    expect(screen.getByTestId('nightingale-component')).toBeInTheDocument();
    expect(screen.getByText('Selected PDB: AF-P12345-F1')).toBeInTheDocument();
    expect(screen.getByText('PDB count: 2')).toBeInTheDocument();
  });

  it('falls back to AlphaFold when the UniProt PDB lookup fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        proteinData: {
          proteinName: 'P12345',
          description: 'Test protein'
        }
      })
    });

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('UniProt ID P12345')).toBeInTheDocument();
    });

    expect(screen.getByTestId('nightingale-component')).toBeInTheDocument();
    expect(screen.getByText('Selected PDB: AF-P12345-F1')).toBeInTheDocument();
    expect(screen.getByText('PDB count: 1')).toBeInTheDocument();
  });

  it('renders nothing when proteinName is absent in proteinData', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        proteinData: {
          description: 'No name protein'
        }
      })
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uniProtKBCrossReferences: [] })
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/UniProt ID/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('nightingale-component')).not.toBeInTheDocument();
  });

  it('refetches data when proteinName parameter changes', async () => {
    mockProteinName = 'P11111';

    const mockFetch = jest.fn((url) => {
      if (url.includes('P11111')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ proteinData: { proteinName: 'P11111' } })
        });
      }
      if (url.includes('P22222')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ proteinData: { proteinName: 'P22222' } })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = mockFetch;

    const { rerender } = render(<ProteinVisualization />);
    
    await waitFor(() => {
      expect(screen.getByText('UniProt ID P11111')).toBeInTheDocument();
    });

    // Change param
    mockProteinName = 'P22222';
    rerender(<ProteinVisualization />);

    await waitFor(() => {
      expect(screen.getByText('UniProt ID P22222')).toBeInTheDocument();
    });
    
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('P11111'));
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('P22222'));
  });
});
