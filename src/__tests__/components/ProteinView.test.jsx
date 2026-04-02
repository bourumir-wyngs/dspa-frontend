import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProteinVisualization from '../../components/ProteinView';

// Mock react-router-dom
const mockedUseNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockedUseNavigate,
  useParams: () => ({ proteinName: 'P12345' }),
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
    return <div data-testid="nightingale-component">Nightingale Component</div>;
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
  });
});
