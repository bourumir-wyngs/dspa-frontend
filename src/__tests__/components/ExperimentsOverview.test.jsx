import React, { act } from 'react';
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
    expect(container.textContent).not.toContain('DYN-2');

    const dataRows = container.querySelectorAll('tbody tr');

    act(() => {
      Simulate.click(dataRows[0]);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/experiment/DYN-1');
  });
});