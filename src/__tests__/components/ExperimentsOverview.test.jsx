import React, { act } from 'react';
import '@testing-library/jest-dom';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('react-select', () => (props) => (
  <div data-testid={props.placeholder}>
    {props.options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => props.onChange([option])}
      >
        {option.label}
      </button>
    ))}
    <button type="button" onClick={() => props.onChange([])}>
      Clear
    </button>
  </div>
));

import ExperimentsOverview from '../../components/ExperimentsOverview';

const experimentsResponse = {
  success: true,
  experiments: [
    {
      dynaprot_experiment: 'DYN-1',
      organism: 'Human',
      perturbation: 'Heat',
      condition: 'Stress',
      protease: 'Trypsin',
      doi: 'https://doi.org/10.1000/dyn-1',
    },
    {
      dynaprot_experiment: 'DYN-2',
      organism: 'Mouse',
      perturbation: 'Cold',
      condition: 'Recovery',
      protease: 'LysC',
      doi: '',
    },
    {
      dynaprot_experiment: 'DYN-3',
      organism: 'Human',
      perturbation: 'Heat',
      condition: '',
      protease: '',
      doi: null,
    },
  ],
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const settleEffects = async () => {
  await flushPromises();
  await flushPromises();
};

describe('ExperimentsOverview', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockNavigate.mockReset();
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => experimentsResponse,
    }));
  });

  afterEach(async () => {
    await settleEffects();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = null;
    jest.restoreAllMocks();
  });

  it('renders fetched experiments and filter controls', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Experiments');
    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).toContain('DYN-2');
    expect(container.textContent).toContain('Human');
    expect(container.textContent).toContain('Mouse');
    expect(container.textContent).toContain('https://doi.org/10.1000/dyn-1');
    expect(container.textContent).toContain('N/A');
    expect(container.querySelector('[data-testid="Filter by perturbation..."]')).not.toBeNull();
    expect(container.querySelector('[data-testid="Filter by organism..."]')).not.toBeNull();
    expect(container.querySelector('[data-testid="Filter by protease..."]')).toBeNull();
    expect(container.textContent).not.toContain('Protease');
    expect(container.textContent).not.toContain('Trypsin');
    expect(container.textContent).not.toContain('LysC');
  });

  it('only renders safe DOI and publication values as links', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        experiments: [
          {
            dynaprot_experiment: 'DYN-SAFE',
            organism: 'Human',
            perturbation: 'Heat',
            condition: 'Stress',
            doi: 'https://doi.org/10.1000/safe',
          },
          {
            dynaprot_experiment: 'DYN-BARE',
            organism: 'Human',
            perturbation: 'Heat',
            condition: 'Stress',
            doi: '10.1000/bare-doi',
          },
          {
            dynaprot_experiment: 'DYN-JS',
            organism: 'Human',
            perturbation: 'Heat',
            condition: 'Stress',
            doi: 'javascript:alert(1)',
          },
          {
            dynaprot_experiment: 'DYN-HTTP',
            organism: 'Human',
            perturbation: 'Heat',
            condition: 'Stress',
            doi: 'http://example.com/insecure',
          },
        ],
      }),
    }));

    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    const links = Array.from(container.querySelectorAll('tbody a'));
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('https://doi.org/10.1000/safe');
    expect(links[0].getAttribute('href')).toBe('https://doi.org/10.1000/safe');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[1]).toHaveTextContent('10.1000/bare-doi');
    expect(links[1].getAttribute('href')).toBe('https://doi.org/10.1000/bare-doi');

    expect(container.textContent).toContain('javascript:alert(1)');
    expect(container.textContent).toContain('http://example.com/insecure');
    expect(links.some((link) => link.getAttribute('href')?.startsWith('javascript:'))).toBe(false);
    expect(links.some((link) => link.getAttribute('href')?.startsWith('http://'))).toBe(false);

    act(() => {
      Simulate.click(links[0]);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('filters the table and navigates when an experiment row is clicked', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    const heatFilterButton = Array.from(
      container.querySelectorAll('[data-testid="Filter by perturbation..."] button')
    ).find((button) => button.textContent === 'Heat');

    act(() => {
      Simulate.click(heatFilterButton);
    });

    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).toContain('DYN-3');
    expect(container.textContent).not.toContain('DYN-2');

    const dataRows = container.querySelectorAll('tbody tr');

    act(() => {
      Simulate.click(dataRows[0]);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/experiment/DYN-1');
  });

  it('combines multiple filters to narrow results', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    const clickFilterOption = (testId, label) => {
      const button = Array.from(container.querySelectorAll(`[data-testid="${testId}"] button`))
        .find((candidate) => candidate.textContent === label);

      act(() => {
        Simulate.click(button);
      });
    };

    clickFilterOption('Filter by perturbation...', 'Heat');
    clickFilterOption('Filter by organism...', 'Human');
    clickFilterOption('Filter by condition...', 'Stress');

    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).not.toContain('DYN-2');
    expect(container.textContent).not.toContain('DYN-3');
  });

  it('clears a filter and restores all experiments', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    const perturbationButtons = container.querySelectorAll('[data-testid="Filter by perturbation..."] button');
    const heatButton = Array.from(perturbationButtons).find((button) => button.textContent === 'Heat');
    const clearButton = Array.from(perturbationButtons).find((button) => button.textContent === 'Clear');

    act(() => {
      Simulate.click(heatButton);
    });

    expect(container.textContent).not.toContain('DYN-2');

    act(() => {
      Simulate.click(clearButton);
    });

    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).toContain('DYN-2');
    expect(container.textContent).toContain('DYN-3');
  });

  it('renders N/A for missing condition and doi values', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });

    await settleEffects();

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const dyn3Row = rows.find((row) => row.textContent.includes('DYN-3'));

    expect(dyn3Row).toHaveTextContent('Human');
    expect(dyn3Row).toHaveTextContent('Heat');
    expect(dyn3Row.textContent.match(/N\/A/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('handles backend response with success: false', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ success: false, experiments: 'not an array' }),
    }));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      root.render(<ExperimentsOverview />);
    });
    await settleEffects();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Expected an array of experiments but got:',
      expect.objectContaining({ success: false })
    );

    // It should just render an empty table
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(0);

    consoleSpy.mockRestore();
  });

  it('handles fetch rejection safely', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network failure')));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      root.render(<ExperimentsOverview />);
    });
    await settleEffects();

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching experiments:', expect.any(Error));

    // It should render an empty table
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(0);

    consoleSpy.mockRestore();
  });

  it('renders an empty list when experiments array is empty', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ success: true, experiments: [] }),
    }));

    await act(async () => {
      root.render(<ExperimentsOverview />);
    });
    await settleEffects();

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(0);
  });

  it('clears one filter while another remains active', async () => {
    await act(async () => {
      root.render(<ExperimentsOverview />);
    });
    await settleEffects();

    const clickFilterOption = (testId, label) => {
      const button = Array.from(container.querySelectorAll(`[data-testid="${testId}"] button`))
        .find((candidate) => candidate.textContent === label);
      act(() => { Simulate.click(button); });
    };

    // Apply two filters
    clickFilterOption('Filter by perturbation...', 'Heat');
    clickFilterOption('Filter by organism...', 'Human');

    // Only DYN-1 and DYN-3 match both
    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).not.toContain('DYN-2');
    expect(container.textContent).toContain('DYN-3');

    // Clear perturbation filter (leaving organism=Human active)
    clickFilterOption('Filter by perturbation...', 'Clear');

    // Since DYN-1 and DYN-3 are the only Human ones anyway, they remain.
    // Let's verify DYN-2 (Mouse) is still NOT visible, proving organism filter works
    expect(container.textContent).toContain('DYN-1');
    expect(container.textContent).toContain('DYN-3');
    expect(container.textContent).not.toContain('DYN-2');
  });
});
