jest.mock('d3', () => require('../../testUtils/d3Mock'));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import VolcanoPlot from '../../visualization/volcanoplot';

const makeData = () => [
  {
    experimentID: 'EXP-WIDE',
    dose: 'Wide Dose',
    data: [
      {
        pep_grouping_key: 'pep/shared key',
        pg_protein_accessions: 'P-HIGHLIGHT',
        diff: -3,
        adj_pval: 0.001,
      },
      {
        pep_grouping_key: 'pep-up',
        pg_protein_accessions: 'P-UP',
        diff: 2.2,
        adj_pval: 0.01,
      },
      {
        pep_grouping_key: 'pep-neutral',
        pg_protein_accessions: 'P-NEUTRAL',
        diff: 0.25,
        adj_pval: 0.5,
      },
    ],
  },
  {
    experimentID: 'EXP-DUPLICATE',
    dose: 'Duplicate Dose',
    data: [
      {
        pep_grouping_key: 'pep/shared key',
        pg_protein_accessions: 'P-DUPLICATE',
        diff: -1.8,
        adj_pval: 0.01,
      },
    ],
  },
  {
    experimentID: 'EXP-THIRD',
    dose: 'Third Dose',
    data: [
      {
        pep_grouping_key: 'pep-third',
        pg_protein_accessions: 'P-THIRD',
        diff: 1.3,
        adj_pval: 0.2,
      },
    ],
  },
];

describe('VolcanoPlot', () => {
  it('renders legends and controls without drawing plots for empty data', () => {
    const { container } = render(<VolcanoPlot differentialAbundanceDataList={[]} />);

    expect(screen.getByText('Up (adj.p < 0.05, log2FC > 1)')).toBeInTheDocument();
    expect(screen.getByText('Down (adj.p < 0.05, log2FC < -1)')).toBeInTheDocument();
    expect(screen.getByText('Not significant')).toBeInTheDocument();
    expect(screen.getByText('Selected Peptide')).toBeInTheDocument();
    expect(screen.getByText('Download CSV')).toBeInTheDocument();
    expect(container.querySelector('.plot-wrapper')).not.toBeInTheDocument();
  });

  it('draws the first page of volcano plots with significance and highlighted-protein styling', () => {
    const { container } = render(
      <VolcanoPlot
        differentialAbundanceDataList={makeData()}
        highlightedProtein="P-HIGHLIGHT"
      />
    );

    expect(screen.getByText('Peptides in P-HIGHLIGHT')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(2);
    expect(container).toHaveTextContent('Wide Dose');
    expect(container).toHaveTextContent('Duplicate Dose');

    const highlighted = container.querySelector('.pep-key-pep_shared_key');
    const significantUp = container.querySelector('.pep-key-pep-up');
    const neutral = container.querySelector('.pep-key-pep-neutral');

    expect(highlighted).toHaveStyle({ fill: '#ffa500' });
    expect(highlighted).toHaveAttribute('stroke', 'black');
    expect(highlighted).toHaveAttribute('stroke-width', '1.5');
    expect(significantUp).toHaveStyle({ fill: '#d62728' });
    expect(neutral).toHaveStyle({ fill: '#d9d9d9' });
  });

  it('highlights duplicate peptide keys across visible plots and updates the HTML tooltip', () => {
    const { container } = render(
      <VolcanoPlot
        differentialAbundanceDataList={makeData()}
        highlightedProtein="P-HIGHLIGHT"
      />
    );

    const matchingPeptides = container.querySelectorAll('.pep-key-pep_shared_key');
    expect(matchingPeptides).toHaveLength(2);

    fireEvent.mouseOver(matchingPeptides[0]);

    matchingPeptides.forEach(circle => {
      expect(circle).toHaveAttribute('fill', '#289b22');
      expect(circle).toHaveAttribute('r', '4.5');
      expect(circle).toHaveAttribute('stroke', '#289b22');
    });

    const tooltip = container.querySelector('#html-tooltip');
    expect(tooltip).toHaveStyle({ visibility: 'visible', opacity: '1' });
    expect(tooltip).toHaveTextContent('Pep Key: pep/shared key');
    expect(tooltip).toHaveTextContent('Protein: P-HIGHLIGHT');

    fireEvent.mouseOut(matchingPeptides[0]);

    matchingPeptides.forEach(circle => {
      expect(circle).toHaveAttribute('r', '3');
    });
    expect(tooltip).toHaveStyle({ visibility: 'hidden', opacity: '0' });
  });

  it('paginates two plots at a time and can expand to show all plots', () => {
    const { container } = render(<VolcanoPlot differentialAbundanceDataList={makeData()} />);

    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(2);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('>'));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(1);
    expect(container).toHaveTextContent('Third Dose');

    fireEvent.click(screen.getByText('Show All'));

    expect(screen.queryByText(/Page \d of \d/)).not.toBeInTheDocument();
    expect(screen.getByText('Show Less')).toBeInTheDocument();
    expect(container.querySelector('.volcano-plot-section')).toHaveClass('volcano-plot-section-expanded');
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(3);
  });

  it('downloads differential abundance data as CSV', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const OriginalBlob = global.Blob;
    class TestBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    }
    global.Blob = TestBlob;
    URL.createObjectURL = jest.fn(() => 'blob:volcano-csv');
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      render(<VolcanoPlot differentialAbundanceDataList={makeData()} />);

      fireEvent.click(screen.getByText('Download CSV'));

      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(TestBlob));
      expect(click).toHaveBeenCalledTimes(1);

      const csvBlob = URL.createObjectURL.mock.calls[0][0];
      const csvText = csvBlob.parts.join('');
      expect(csvBlob.options).toEqual({ type: 'text/csv;charset=utf-8;' });
      expect(csvText).toContain(
        'Experiment ID,Comparison,Peptide Key,Protein Accession,Fold Change (log2),q-value'
      );
      expect(csvText).toContain('EXP-WIDE,Wide Dose,pep-up,P-UP,2.2,0.01');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      global.Blob = OriginalBlob;
      click.mockRestore();
    }
  });
});
