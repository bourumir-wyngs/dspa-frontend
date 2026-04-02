import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProteinSearch from '../../components/Search';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null })
}), { virtual: true });

// Mock config
jest.mock('../../config.json', () => ({
  apiEndpoint: 'http://test-api.com/'
}), { virtual: true });

// Mock ProteinSearchResults to avoid rendering it completely
jest.mock('../../components/ProteinSearchResults', () => {
  return function MockProteinSearchResults({ searchResults }) {
    return <div data-testid="mock-search-results">Results: {searchResults.table.length}</div>;
  };
});

describe('ProteinSearch Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('renders initial form correctly', () => {
    render(<ProteinSearch />);
    
    expect(screen.getByRole('heading', { name: 'Search Protein' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('updates input value on change', () => {
    render(<ProteinSearch />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'P12345' } });
    
    expect(input.value).toBe('P12345');
  });

  it('shows error when search fails', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: false, message: 'Server error' })
    });

    render(<ProteinSearch />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Error: Server error')).toBeInTheDocument();
    });
  });

  it('navigates when exactly one result is found', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        table: [{ proteinName: 'P12345' }]
      })
    });

    render(<ProteinSearch />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'P123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/visualize/P12345');
    });
  });

  it('renders search results when multiple results are found', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        table: [{ proteinName: 'P12345' }, { proteinName: 'P67890' }]
      })
    });

    render(<ProteinSearch />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-search-results')).toHaveTextContent('Results: 2');
    });
  });
});
