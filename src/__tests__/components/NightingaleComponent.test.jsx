import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@nightingale-elements/nightingale-sequence', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-navigation', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-manager', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-colored-sequence', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-msa', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-sequence-heatmap', () => ({}), { virtual: true });
jest.mock('@dspa-nightingale/nightingale-structure', () => {
  return {
    LIP_SCALE: [
      { threshold: 1, color: 'red', label: 'high' },
      { threshold: -Infinity, color: 'default', label: 'default' },
    ],
  };
}, { virtual: true });
jest.mock('@dspa-nightingale/nightingale-track', () => ({}), { virtual: true });

const NightingaleComponent = require('../../components/NightingaleComponent').default;

describe('NightingaleComponent', () => {
  const baseProteinData = {
    proteinName: 'TestProtein',
    proteinDescription: 'A test protein',
    proteinSequence: 'ACDEFGHIKLMNPQRSTVWY',
    experimentIDsList: ['exp1', 'exp2'],
    lipscoreList: [
      { experimentID: 'exp1', data: Array(20).fill(1) },
      { experimentID: 'exp2', data: Array(20).fill(0.5) },
      { experimentID: 'exp3', data: Array(20).fill(0.2) },
    ],
    experimentMetaData: [
      { dpx_comparison: 'comp1', condition: 'cond1', dose: '10mg' },
      { dpx_comparison: 'comp2', condition: 'cond2', dose: '20mg' },
    ],
    differentialAbundanceData: {
      comp1: [{ index: 0, score: 0.5 }, { index: 1, score: 1.0 }],
      comp2: [{ index: 0, score: 0.2 }, { index: 1, score: 0.8 }],
    },
    featuresData: {
      sequence: 'ACDEFGHIKLMNPQRSTVWY',
      features: [
        { type: 'DOMAIN', start: 1, end: 5, description: 'Test Domain' },
        { type: 'BINDING', start: 6, end: 10, ligand: { name: 'ATP' } },
      ],
    },
    barcodeSequence: {
      seq1: 'ACDEFGHIKLMNPQRSTVWY',
    },
  };

  let originalCustomElements;

  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);

    if (!global.MutationObserver) {
      global.MutationObserver = class {
        observe() {}
        disconnect() {}
      };
    }

    const elements = [
      'nightingale-manager',
      'nightingale-structure',
      'nightingale-navigation',
      'nightingale-sequence',
      'nightingale-sequence-heatmap',
      'nightingale-track',
      'nightingale-colored-sequence',
      'nightingale-msa',
    ];

    elements.forEach((el) => {
      if (!customElements.get(el)) {
        class DummyElement extends HTMLElement {
          setHeatmapData() {}
          applyZoomTranslation() {}
          closest(selector) {
            return HTMLElement.prototype.closest.call(this, selector);
          }
        }
        customElements.define(el, DummyElement);
      }
    });

    originalCustomElements = global.customElements;
    global.customElements = {
      ...originalCustomElements,
      define: originalCustomElements.define.bind(originalCustomElements),
      get: originalCustomElements.get.bind(originalCustomElements),
      whenDefined: jest.fn(() => Promise.resolve()),
    };
  });

  afterAll(() => {
    global.customElements = originalCustomElements;
  });

  const renderComponent = (props = {}) => render(
    <NightingaleComponent
      proteinData={baseProteinData}
      selectedPdbId="1XYZ"
      setSelectedPdbId={jest.fn()}
      containerRef={{ current: null }}
      {...props}
    />
  );

  it('renders the component with basic data', () => {
    renderComponent();

    expect(screen.getByText('A test protein')).toBeInTheDocument();
    expect(screen.getByText('Selected PDB ID: 1XYZ')).toBeInTheDocument();
    expect(screen.getByText('Experiment exp1')).toBeInTheDocument();
    expect(screen.getByText('Experiment exp2')).toBeInTheDocument();
  });

  it('renders correct tracks based on features data', () => {
    renderComponent();

    expect(screen.getByText('Domain')).toBeInTheDocument();
    expect(screen.getByText('Binding site')).toBeInTheDocument();
    expect(screen.queryByText('Alpha helix')).not.toBeInTheDocument();
  });

  it('renders dropdown when more than 5 experiments', () => {
    const manyExperimentsData = {
      ...baseProteinData,
      experimentIDsList: ['exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6'],
      lipscoreList: Array.from({ length: 6 }, (_, i) => ({
        experimentID: `exp${i + 1}`,
        data: Array(20).fill(1),
      })),
    };

    renderComponent({ proteinData: manyExperimentsData });

    expect(screen.getByLabelText('Color structure according to experiment:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('uses passedExperimentIDs when they match available lipscore entries', () => {
    renderComponent({ passedExperimentIDs: ['exp3', 'missing-exp'] });

    expect(screen.getByText('Experiment exp3')).toBeInTheDocument();
    expect(screen.queryByText('Experiment exp1')).not.toBeInTheDocument();
    expect(screen.queryByText('Experiment exp2')).not.toBeInTheDocument();
  });

  it('falls back to experimentIDsList when passedExperimentIDs do not match available entries', () => {
    renderComponent({ passedExperimentIDs: ['missing-exp'] });

    expect(screen.getByText('Experiment exp1')).toBeInTheDocument();
    expect(screen.getByText('Experiment exp2')).toBeInTheDocument();
  });

  it('falls back to lipscoreList experiment IDs when experimentIDsList is empty', () => {
    renderComponent({
      proteinData: {
        ...baseProteinData,
        experimentIDsList: [],
      },
    });

    expect(screen.getByText('Experiment exp1')).toBeInTheDocument();
    expect(screen.getByText('Experiment exp2')).toBeInTheDocument();
    expect(screen.getByText('Experiment exp3')).toBeInTheDocument();
  });

  it('initializes the first valid experiment as selected', () => {
    renderComponent();

    expect(screen.getByText('Experiment exp1')).toHaveClass('selected');
  });

  it('clicking the same experiment keeps that experiment selected without changing selection', () => {
    renderComponent();

    const experimentOneButton = screen.getByText('Experiment exp1');
    const experimentTwoButton = screen.getByText('Experiment exp2');

    expect(experimentOneButton).toHaveClass('selected');
    expect(experimentTwoButton).not.toHaveClass('selected');

    fireEvent.click(experimentOneButton);

    expect(experimentOneButton).toHaveClass('selected');
    expect(experimentTwoButton).not.toHaveClass('selected');
  });

  it('renders split heatmap labels when masterCondition is provided', () => {
    const { container } = renderComponent({ masterCondition: 'cond1' });

    expect(screen.getAllByText(/Structural-Barcode/)).toHaveLength(2);
    expect(container.textContent).toContain('Structural-Barcode(cond1)');
    expect(container.textContent).toContain('Structural-Barcode(other conditions)');
  });

  it('shows fallback when no experiment rows match the selected masterCondition', () => {
    renderComponent({ masterCondition: 'missing-condition' });

    expect(screen.getByText('No experiment rows match this condition.')).toBeInTheDocument();
    expect(screen.queryByText('No experiment rows from other conditions.')).not.toBeInTheDocument();
  });

  it('shows fallback when there are no rows from other conditions', () => {
    const proteinData = {
      ...baseProteinData,
      experimentMetaData: [
        { dpx_comparison: 'comp1', condition: 'cond1', dose: '10mg' },
        { dpx_comparison: 'comp2', condition: 'cond1', dose: '20mg' },
      ],
    };

    renderComponent({ proteinData, masterCondition: 'cond1' });

    expect(screen.getByText('No experiment rows from other conditions.')).toBeInTheDocument();
    expect(screen.queryByText('No experiment rows match this condition.')).not.toBeInTheDocument();
  });

  it('omits heatmap rows when showHeatmap is false', () => {
    renderComponent({ showHeatmap: false });

    expect(screen.queryByText('Structural-Barcode')).not.toBeInTheDocument();
  });
});
