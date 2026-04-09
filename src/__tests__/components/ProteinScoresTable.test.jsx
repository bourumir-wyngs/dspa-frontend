import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ProteinScoresTable } from '../../visualization/ProteinScoresTable';

describe('ProteinScoresTable', () => {
  const baseData = [
    {
      proteinAccession: 'P22222',
      averageScore: 11.7,
      protein_description: 'Second protein',
    },
    {
      proteinAccession: 'P11111',
      averageScore: 42.2,
      protein_description: 'Top protein',
    },
    {
      proteinAccession: 'P33333',
      averageScore: 0,
      protein_description: 'Zero score protein',
    },
  ];

  it('renders headers and sorts proteins by descending average score', () => {
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
    expect(screen.getByText('Average LiP Score among Experiments')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('P11111');
    expect(rows[2]).toHaveTextContent('P22222');
    expect(rows[3]).toHaveTextContent('P33333');
  });

  it('rounds scores and falls back to 0 when averageScore is missing', () => {
    render(
      <ProteinScoresTable
        experimentData={[
          {
            proteinAccession: 'P99999',
            averageScore: 12.6,
            protein_description: 'Rounded protein',
          },
          {
            proteinAccession: 'P88888',
            protein_description: 'Missing score protein',
          },
        ]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
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

  it('renders an empty table body when no experiment data is provided', () => {
    render(
      <ProteinScoresTable
        experimentData={[]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('handles duplicate scores correctly', () => {
    const dataWithDuplicates = [
      { proteinAccession: 'A-acc', averageScore: 50, protein_description: 'A-desc' },
      { proteinAccession: 'B-acc', averageScore: 50, protein_description: 'B-desc' },
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
    // Should still render both
    expect(screen.getByText('A-acc')).toBeInTheDocument();
    expect(screen.getByText('B-acc')).toBeInTheDocument();
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
        experimentData={[{ proteinAccession: 'P1', averageScore: 10 }]}
        onProteinClick={jest.fn()}
        displayedProtein={null}
        goTerms={[]}
        onGoTermSelect={jest.fn()}
      />
    );
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('P1');
    // The description cell should be empty but the row should render
    const cells = rows[1].querySelectorAll('td');
    expect(cells[2].textContent).toBe('');
  });
});
