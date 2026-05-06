import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ProteinScoresTable } from '../../visualization/ProteinScoresTable';

describe('ProteinScoresTable', () => {
  const baseData = [
    {
      proteinAccession: 'P22222',
      maxLog2FC: 1.75,
      n_peptides: 3,
      protein_description: 'Second protein',
    },
    {
      proteinAccession: 'P11111',
      maxLog2FC: -4.25,
      n_peptides: 8,
      protein_description: 'Top protein',
    },
    {
      pg_protein_accessions: 'P33333',
      diff: 2.5,
      n_peptides: 1,
      protein_description: 'Fallback accession protein',
    },
  ];

  it('renders significant-protein headers and sorts proteins by absolute max log2FC', () => {
    render(
      <ProteinScoresTable
        experimentData={baseData}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Protein Accession')).toBeInTheDocument();
    expect(screen.getByText('Max log2FC among Experiments')).toBeInTheDocument();
    expect(screen.getByText('Number of Significant Peptides among Experiments')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('P11111');
    expect(rows[1]).toHaveTextContent('-4.25');
    expect(rows[1]).toHaveTextContent('8');
    expect(rows[2]).toHaveTextContent('P33333');
    expect(rows[2]).toHaveTextContent('2.50');
    expect(rows[3]).toHaveTextContent('P22222');
    expect(rows[3]).toHaveTextContent('1.75');
  });

  it('falls back to diff when maxLog2FC is missing and displays N/A for missing values', () => {
    render(
      <ProteinScoresTable
        experimentData={[
          {
            proteinAccession: 'P99999',
            diff: 12.678,
            n_peptides: 4,
            protein_description: 'Diff fallback protein',
          },
          {
            proteinAccession: 'P88888',
          },
        ]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    expect(screen.getByText('12.68')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onProteinClick with the clicked accession and marks the displayed protein as selected', () => {
    const onProteinClick = jest.fn();
    const { container } = render(
      <ProteinScoresTable
        experimentData={baseData}
        onProteinClick={onProteinClick}
        displayedProtein="P22222"
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    const selectedRow = container.querySelector('tr.protein-row.selected');
    expect(selectedRow).toHaveTextContent('P22222');

    fireEvent.click(screen.getByText('P11111'));
    expect(onProteinClick).toHaveBeenCalledWith('P11111');
  });

  it('renders an empty-state row when no experiment data is provided', () => {
    render(
      <ProteinScoresTable
        experimentData={[]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('No significant proteins found for this condition.')).toBeInTheDocument();
  });

  it('renders duplicate accessions safely with unique row keys', () => {
    const dataWithDuplicates = [
      { proteinAccession: 'A-acc', maxLog2FC: 5, n_peptides: 2, protein_description: 'A-desc' },
      { proteinAccession: 'A-acc', maxLog2FC: 4, n_peptides: 1, protein_description: 'A-desc duplicate' },
    ];
    render(
      <ProteinScoresTable
        experimentData={dataWithDuplicates}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(screen.getAllByText('A-acc')).toHaveLength(2);
  });

  it('does not mark any row as selected if displayedProtein is absent from dataset', () => {
    const { container } = render(
      <ProteinScoresTable
        experimentData={baseData}
        onProteinClick={jest.fn()}
        displayedProtein="UNKNOWN"
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );
    const selectedRow = container.querySelector('tr.protein-row.selected');
    expect(selectedRow).toBeNull();
  });

  it('renders safely when protein_description is missing', () => {
    render(
      <ProteinScoresTable
        experimentData={[{ proteinAccession: 'P1', maxLog2FC: 10, n_peptides: 1 }]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('P1');
    const cells = rows[1].querySelectorAll('td');
    expect(cells[3].textContent).toBe('N/A');
  });
});
