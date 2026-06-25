import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Impressum from '../../components/Impressum';

describe('Impressum', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  it('renders the page heading without lab information by default', () => {
    act(() => {
      root.render(<Impressum />);
    });

    expect(container.textContent).toContain('Impressum');
    expect(container.textContent).not.toContain('Picotti/Beltrao Lab');
  });

  it('renders lab information for official builds', () => {
    act(() => {
      root.render(<Impressum showLabInfo />);
    });

    expect(container.textContent).toContain('Impressum');
    expect(container.textContent).toContain('Picotti/Beltrao Lab');
  });
});
