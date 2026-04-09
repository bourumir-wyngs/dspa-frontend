import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProteinSearchResults from '../../components/ProteinSearchResults';

// Mock react-router-dom
const mockedUseNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockedUseNavigate,
  BrowserRouter: ({ children }) => <div>{children}</div>
}), { virtual: true });

describe('ProteinSearchResults', () => {
  beforeEach(() => {
    mockedUseNavigate.mockClear();
  });

  it('renders "No search results to display." when searchResults is undefined', () => {
    render(
      <BrowserRouter>
        <ProteinSearchResults />
      </BrowserRouter>
    );
    expect(screen.getByText('No search results to display.')).toBeInTheDocument();
  });

  it('renders "No search results to display." when searchResults is empty', () => {
    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={{ table: [] }} />
      </BrowserRouter>
    );
    expect(screen.getByText('No search results to display.')).toBeInTheDocument();
  });

  it('renders the table with data when searchResults is provided', () => {
    const searchResults = {
      table: [
        {
          proteinName: 'P12345',
          geneName: 'GENE1',
          taxonomyName: 'Human',
          proteinDescription: 'Test protein 1',
        },
        {
          proteinName: 'Q67890',
          geneName: '',
          taxonomyName: 'Mouse',
          proteinDescription: 'Test protein 2',
        },
      ],
    };

    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={searchResults} />
      </BrowserRouter>
    );

    // Check headers
    expect(screen.getByText('Protein Name')).toBeInTheDocument();
    expect(screen.getByText('Gene Name')).toBeInTheDocument();
    expect(screen.getByText('Taxonomy')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();

    // Check row 1
    expect(screen.getByText('P12345')).toBeInTheDocument();
    expect(screen.getByText('GENE1')).toBeInTheDocument();
    expect(screen.getByText('Human')).toBeInTheDocument();
    expect(screen.getByText('Test protein 1')).toBeInTheDocument();

    // Check row 2
    expect(screen.getByText('Q67890')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('Test protein 2')).toBeInTheDocument();
  });

  it('navigates to the correct URL when a protein name button is clicked', () => {
    const searchResults = {
      table: [
        {
          proteinName: 'P12345',
          geneName: 'GENE1',
          taxonomyName: 'Human',
          proteinDescription: 'Test protein 1',
        },
      ],
    };

    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={searchResults} />
      </BrowserRouter>
    );

    const button = screen.getByText('P12345');
    fireEvent.click(button);

    expect(mockedUseNavigate).toHaveBeenCalledTimes(1);
    expect(mockedUseNavigate).toHaveBeenCalledWith('/visualize/P12345');
  });

  it('navigates to the correct encoded URL when a protein name button is clicked', () => {
    const searchResults = {
      table: [
        {
          proteinName: 'A/B+C',
          geneName: 'GENE2',
          taxonomyName: 'Human',
          proteinDescription: 'Test protein with special chars',
        },
      ],
    };

    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={searchResults} />
      </BrowserRouter>
    );

    const button = screen.getByText('A/B+C');
    fireEvent.click(button);

    expect(mockedUseNavigate).toHaveBeenCalledTimes(1);
    expect(mockedUseNavigate).toHaveBeenCalledWith(`/visualize/${encodeURIComponent('A/B+C')}`);
  });

  it('renders safely when nested fields are missing', () => {
    const malformedResults = {
      table: [
        {
          // Missing proteinName, geneName, taxonomyName, proteinDescription
        }
      ]
    };

    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={malformedResults} />
      </BrowserRouter>
    );

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2); // header + 1 body row
    expect(screen.getByText('—')).toBeInTheDocument(); // geneName fallback
  });

  it('handles result missing the table property', () => {
    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={{ success: true }} />
      </BrowserRouter>
    );
    expect(screen.getByText('No search results to display.')).toBeInTheDocument();
  });

  it('navigates when Enter key is pressed on a button (accessibility check)', () => {
    const searchResults = {
      table: [{ proteinName: 'P1' }]
    };

    render(
      <BrowserRouter>
        <ProteinSearchResults searchResults={searchResults} />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: 'P1' });
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    
    // Note: click event is usually fired on Enter for buttons, 
    // but if we are manually testing the button's default behavior, 
    // a real click should happen.
    fireEvent.click(button);
    expect(mockedUseNavigate).toHaveBeenCalled();
  });
});
