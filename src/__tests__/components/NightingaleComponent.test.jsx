import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NightingaleComponent from '../../components/NightingaleComponent';

// Mock the custom nightingale elements to avoid errors during test rendering
jest.mock('@nightingale-elements/nightingale-sequence', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-navigation', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-manager', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-colored-sequence', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-msa', () => ({}), { virtual: true });
jest.mock('@nightingale-elements/nightingale-sequence-heatmap', () => ({}), { virtual: true });
jest.mock('@dspa-nightingale/nightingale-structure', () => {
    return {
        LIP_SCALE: [{ threshold: 1, color: 'red' }, { threshold: -Infinity, color: 'default' }]
    };
}, { virtual: true });
jest.mock('@dspa-nightingale/nightingale-track', () => ({}), { virtual: true });

describe('NightingaleComponent', () => {
    const mockProteinData = {
        proteinName: 'TestProtein',
        proteinDescription: 'A test protein',
        proteinSequence: 'ACDEFGHIKLMNPQRSTVWY',
        experimentIDsList: ['exp1', 'exp2'],
        lipscoreList: [
            { experimentID: 'exp1', data: Array(20).fill(1) },
            { experimentID: 'exp2', data: Array(20).fill(0.5) }
        ],
        experimentMetaData: [
            { dpx_comparison: 'comp1', condition: 'cond1', dose: '10mg' },
            { dpx_comparison: 'comp2', condition: 'cond2', dose: '20mg' }
        ],
        differentialAbundanceData: {
            'comp1': [{ index: 0, score: 0.5 }, { index: 1, score: 1.0 }],
            'comp2': [{ index: 0, score: 0.2 }, { index: 1, score: 0.8 }]
        },
        featuresData: {
            sequence: 'ACDEFGHIKLMNPQRSTVWY',
            features: [
                { type: 'DOMAIN', start: 1, end: 5, description: 'Test Domain' },
                { type: 'BINDING', start: 6, end: 10, ligand: { name: 'ATP' } }
            ]
        },
        barcodeSequence: {
            'seq1': 'ACDEFGHIKLMNPQRSTVWY'
        }
    };

    beforeAll(() => {
        // Mock ResizeObserver
        global.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };

        // Define custom elements as empty HTMLElements for testing if they are used in JSX
        const elements = [
            'nightingale-manager',
            'nightingale-structure',
            'nightingale-navigation',
            'nightingale-sequence',
            'nightingale-sequence-heatmap',
            'nightingale-track'
        ];
        elements.forEach(el => {
            if (!customElements.get(el)) {
                class DummyElement extends HTMLElement {}
                customElements.define(el, DummyElement);
            }
        });
    });

    it('renders the component with basic data', () => {
        render(
            <NightingaleComponent 
                proteinData={mockProteinData} 
                selectedPdbId="1XYZ" 
                showHeatmap={true}
            />
        );

        // Check for protein description
        expect(screen.getByText('A test protein')).toBeInTheDocument();
        
        // Check for PDB ID
        expect(screen.getByText('Selected PDB ID: 1XYZ')).toBeInTheDocument();

        // Check for experiment buttons since there are less than 5 experiments
        expect(screen.getByText('Experiment exp1')).toBeInTheDocument();
        expect(screen.getByText('Experiment exp2')).toBeInTheDocument();
    });

    it('renders correct tracks based on features data', () => {
        const { container } = render(
            <NightingaleComponent 
                proteinData={mockProteinData} 
                selectedPdbId="1XYZ" 
                showHeatmap={true}
            />
        );

        // The tracks are rendered in a table, check if the labels are present
        expect(screen.getByText('Domain')).toBeInTheDocument();
        expect(screen.getByText('Binding site')).toBeInTheDocument();
        expect(screen.queryByText('Alpha helix')).not.toBeInTheDocument(); // not in mock data
    });

    it('renders dropdown when more than 5 experiments', () => {
        const manyExperimentsData = {
            ...mockProteinData,
            experimentIDsList: ['exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6'],
            lipscoreList: Array.from({length: 6}, (_, i) => ({
                experimentID: `exp${i+1}`,
                data: Array(20).fill(1)
            }))
        };

        render(
            <NightingaleComponent 
                proteinData={manyExperimentsData} 
                selectedPdbId="1XYZ" 
            />
        );

        expect(screen.getByLabelText('Color structure according to experiment:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
});
