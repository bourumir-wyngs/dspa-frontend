import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}), { virtual: true });

jest.mock('@nightingale-elements/nightingale-sequence', () => ({}), { virtual: true });

import Home from '../../components/Home';

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const settleEffects = async () => {
  await flushPromises();
  await flushPromises();
  await flushPromises();
};

describe('Home', () => {
  let container;
  let root;
  let originalResizeObserver;
  let originalRequestAnimationFrame;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockNavigate.mockReset();
    mockUseLocation.mockReset();
    mockUseLocation.mockReturnValue({ state: null });

    originalResizeObserver = global.ResizeObserver;
    originalRequestAnimationFrame = window.requestAnimationFrame;

    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };

    window.requestAnimationFrame = (callback) => callback();

    global.fetch = jest.fn((url) => {
      if (url.includes('condition/allconditions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            conditions: [
              { value: 'heat-shock', label: 'Heat shock' },
              { value: 'cold-shock', label: 'Cold shock' },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });
  });

  afterEach(async () => {
    await settleEffects();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    container = null;
    global.ResizeObserver = originalResizeObserver;
    window.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('loads conditions and navigates to the selected condition', async () => {
    await act(async () => {
      root.render(<Home />);
    });

    await settleEffects();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('condition/allconditions'), expect.any(Object));

    const conditionSelect = container.querySelector('#condition-select');
    const proceedButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Proceed with selection'
    );

    expect(conditionSelect).not.toBeNull();
    expect(proceedButton.disabled).toBe(true);
    expect(Array.from(conditionSelect.options).map((option) => option.textContent)).toEqual([
      'Select a Condition',
      'Heat shock',
      'Cold shock',
    ]);

    act(() => {
      Simulate.change(conditionSelect, { target: { value: 'cold-shock' } });
    });

    expect(proceedButton.disabled).toBe(false);

    act(() => {
      Simulate.click(proceedButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/condition/cold-shock');
  });

  it('navigates to search with the entered protein name', async () => {
    await act(async () => {
      root.render(<Home />);
    });

    await settleEffects();

    const searchInput = container.querySelector('#protein-search');
    const searchForm = container.querySelector('form');

    expect(searchInput.getAttribute('placeholder')).toBe('P0A9P4');

    act(() => {
      Simulate.change(searchInput, { target: { value: 'HSP90AA1' } });
    });

    act(() => {
      Simulate.submit(searchForm);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/search', {
      state: { searchTerm: 'HSP90AA1' },
    });
  });

  it('navigates to the experiments overview from the shortcut button', async () => {
    await act(async () => {
      root.render(<Home />);
    });

    await settleEffects();

    const experimentsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'View Experiments'
    );

    act(() => {
      Simulate.click(experimentsButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/experiments');
  });
});
