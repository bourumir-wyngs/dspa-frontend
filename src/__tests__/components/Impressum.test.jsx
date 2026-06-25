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

  it('renders the page heading and lab information', () => {
    act(() => {
      root.render(<Impressum />);
    });

    expect(container.textContent).toContain('Impressum');
    expect(container.textContent).toContain('Picotti/Beltrao Lab');
  });

  it('suppresses lab information when requested', () => {
    act(() => {
      root.render(<Impressum suppressLabInfo />);
    });

    expect(container.textContent).toContain('Impressum');
    expect(container.textContent).not.toContain('Picotti/Beltrao Lab');
  });
});
