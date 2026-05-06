jest.mock('d3', () => require('../../testUtils/d3Mock'));

import '@testing-library/jest-dom';
import { SumLipScoreVisualization } from '../../visualization/sumlipscore';

describe('SumLipScoreVisualization', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="sumlipscorebarplot"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a sorted bar chart with labels and metadata-based colors', () => {
    SumLipScoreVisualization({
      data: {
        LIP_LOW: 10,
        LIP_HIGH: 30,
        LIP_UNKNOWN: 20,
      },
      experimentMetaData: [
        { dpx_comparison: 'LIP_LOW', condition: 'Low condition', perturbation: 'low' },
        { dpx_comparison: 'LIP_HIGH', condition: 'High condition', perturbation: 'Small Molecule' },
      ],
    });

    const container = document.getElementById('sumlipscorebarplot');
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container).toHaveTextContent('Sum Lipid Score Visualization');
    expect(container).toHaveTextContent('Experiment');
    expect(container).toHaveTextContent('Score');

    const bars = Array.from(container.querySelectorAll('rect.bar'));
    expect(bars).toHaveLength(3);
    expect(bars.map(bar => bar.getAttribute('fill'))).toEqual([
      '#be9fd2',
      '#99c2c5',
      '#90EE90',
    ]);
  });

  it('replaces a previous chart instead of appending duplicate svgs', () => {
    const props = {
      data: { LIP_A: 5 },
      experimentMetaData: [{ dpx_comparison: 'LIP_A', condition: 'A', perturbation: 'medium' }],
    };

    SumLipScoreVisualization(props);
    SumLipScoreVisualization(props);

    expect(document.querySelectorAll('#sumlipscorebarplot svg')).toHaveLength(1);
    expect(document.querySelectorAll('#sumlipscorebarplot rect.bar')).toHaveLength(1);
  });

  it('shows tooltip content as text on bar hover', () => {
    SumLipScoreVisualization({
      data: { LIP_SAFE: 12 },
      experimentMetaData: [
        {
          dpx_comparison: 'LIP_SAFE',
          condition: '<img src=x onerror=alert(1)>',
          perturbation: 'medium',
        },
      ],
    });

    const bar = document.querySelector('#sumlipscorebarplot rect.bar');
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, pageX: 25, pageY: 35 }));

    const tooltip = document.querySelector('body > .tooltip');
    expect(tooltip).toHaveStyle({ visibility: 'visible' });
    expect(tooltip).toHaveTextContent('LIP_SAFE');
    expect(tooltip).toHaveTextContent('Score: 12');
    expect(tooltip).toHaveTextContent('Condition: <img src=x onerror=alert(1)>');
    expect(tooltip.querySelector('img')).toBeNull();
  });
});
