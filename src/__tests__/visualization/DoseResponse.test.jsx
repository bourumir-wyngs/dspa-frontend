jest.mock('d3', () => require('../../testUtils/d3Mock'));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DoseResponseCurves from '../../visualization/DoseResponse';

function makePoint(key, dose = 1, intensity = 2) {
  return {
    pep_grouping_key: key,
    dose,
    normalised_intensity_log2: intensity,
  };
}

function makeCurve(key, dose = 1, prediction = 2) {
  return {
    pep_grouping_key: key,
    dose,
    lower: prediction - 0.5,
    upper: prediction + 0.5,
    prediction,
  };
}

describe('DoseResponseCurves', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders one plot per peptide key with matching point and curve data', () => {
    const points = [
      [makePoint('PEP_A', 1, 2), makePoint('PEP_A', 10, 3)],
      [makePoint('PEP_B', 1, 4)],
    ];
    const curves = [
      [makeCurve('PEP_A', 1, 2), makeCurve('PEP_A', 10, 3)],
      [makeCurve('PEP_B', 1, 4), makeCurve('PEP_B', 10, 5)],
    ];

    const { container } = render(<DoseResponseCurves points={points} curves={curves} />);

    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(2);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container).toHaveTextContent('PEP_A');
    expect(container).toHaveTextContent('PEP_B');
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelectorAll('path[fill="#f6d5eb"]')).toHaveLength(2);
    expect(container.querySelectorAll('path[stroke="black"]')).toHaveLength(2);
  });

  it('does not render plots when points or curves are missing', () => {
    const { container, rerender } = render(<DoseResponseCurves points={null} curves={[]} />);
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(0);

    rerender(<DoseResponseCurves points={[]} curves={null} />);
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(0);
  });

  it('renders pagination and moves between pages when there are more than eight peptide keys', () => {
    const keys = Array.from({ length: 9 }, (_, index) => `PEP_${index + 1}`);
    const points = keys.map((key, index) => [makePoint(key, 1, index + 1)]);
    const curves = keys.map((key, index) => [
      makeCurve(key, 1, index + 1),
      makeCurve(key, 10, index + 2),
    ]);

    const { container } = render(<DoseResponseCurves points={points} curves={curves} />);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(8);
    expect(container).toHaveTextContent('PEP_1');
    expect(container).not.toHaveTextContent('PEP_9');

    fireEvent.click(screen.getByText('>'));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(container.querySelectorAll('.plot-wrapper')).toHaveLength(1);
    expect(container).toHaveTextContent('PEP_9');
    expect(container).not.toHaveTextContent('PEP_1');
  });
});
