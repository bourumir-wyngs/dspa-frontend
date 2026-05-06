jest.mock('d3', () => require('../../testUtils/d3Mock'));

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import GOEnrichmentVisualization from '../../visualization/GOEnrichmentVisualization';

describe('GOEnrichmentVisualization', () => {
  const goEnrichmentData = [
    {
      go_term: 'GO term alpha',
      dpx_comparison: 'EXP_A',
      adj_pval: 0.01,
      accessions: 'P11111,P22222',
    },
    {
      go_term: 'GO term alpha',
      dpx_comparison: 'EXP_B',
      adj_pval: 0.001,
      accessions: 'P33333',
    },
    {
      go_term: 'GO term beta',
      dpx_comparison: 'EXP_A',
      adj_pval: 0.05,
      accessions: 'P44444',
    },
  ];

  it('renders a grouped bar chart with title, axis label, and legend', () => {
    const { container } = render(<GOEnrichmentVisualization goEnrichmentData={goEnrichmentData} />);

    expect(container.querySelector('.go-enrichment-visualization svg')).toBeInTheDocument();
    expect(container).toHaveTextContent('Grouped Bar Plot of GO Enrichment by Experiment');
    expect(container).toHaveTextContent('-log10(Adj-pValue)');
    expect(container).toHaveTextContent('EXP_A');
    expect(container).toHaveTextContent('EXP_B');

    const bars = Array.from(container.querySelectorAll('rect'))
      .filter(rect => rect.closest('.legend') === null);
    expect(bars).toHaveLength(3);
  });

  it('calls onProteinSelect with the first accession when a bar is clicked', () => {
    const onProteinSelect = jest.fn();
    const { container } = render(
      <GOEnrichmentVisualization
        goEnrichmentData={goEnrichmentData}
        onProteinSelect={onProteinSelect}
      />
    );

    const firstBar = Array.from(container.querySelectorAll('rect'))
      .find(rect => rect.closest('.legend') === null);
    fireEvent.click(firstBar);

    expect(onProteinSelect).toHaveBeenCalledWith('P11111');
  });

  it('renders only the container for empty data', () => {
    const { container } = render(<GOEnrichmentVisualization goEnrichmentData={[]} />);

    expect(container.querySelector('.go-enrichment-visualization')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
