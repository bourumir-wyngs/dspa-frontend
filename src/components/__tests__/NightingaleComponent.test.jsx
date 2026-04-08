// Mock the custom web components so React doesn't complain
beforeAll(() => {
    const components = [
        'nightingale-manager',
        'nightingale-structure',
        'nightingale-navigation',
        'nightingale-sequence',
        'nightingale-sequence-heatmap',
        'nightingale-track',
        'nightingale-colored-sequence',
        'nightingale-msa'
    ];
    
    components.forEach(name => {
        if (!customElements.get(name)) {
            class MockElement extends HTMLElement {
                setHeatmapData() {}
            }
            customElements.define(name, MockElement);
        }
    });

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});

// Mock the nightingale imports before everything else
jest.mock('@nightingale-elements/nightingale-sequence', () => ({}));
jest.mock('@nightingale-elements/nightingale-navigation', () => ({}));
jest.mock('@nightingale-elements/nightingale-manager', () => ({}));
jest.mock('@nightingale-elements/nightingale-colored-sequence', () => ({}));
jest.mock('@nightingale-elements/nightingale-sequence-heatmap', () => ({}));
jest.mock('@nightingale-elements/nightingale-msa', () => ({}));
jest.mock('@dspa-nightingale/nightingale-track', () => ({}));
jest.mock('@dspa-nightingale/nightingale-structure', () => {
    return {
        LIP_SCALE: [
            { threshold: 10, color: 'red', label: '> 10' },
            { threshold: 5, color: 'orange', label: '> 5' },
            { threshold: 0, color: 'yellow', label: '> 0' },
            { threshold: -Infinity, color: 'grey', label: 'No data' }
        ]
    };
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NightingaleComponent, { getLipScoreColor, buildHeatmapRows, createHeatmapDataset } from '../NightingaleComponent';

describe('NightingaleComponent Utilities', () => {
    describe('getLipScoreColor', () => {
        it('returns correct color based on thresholds', () => {
            expect(getLipScoreColor(11)).toBe('red');
            expect(getLipScoreColor(10)).toBe('red');
            expect(getLipScoreColor(7)).toBe('orange');
            expect(getLipScoreColor(5)).toBe('orange');
            expect(getLipScoreColor(2)).toBe('yellow');
            expect(getLipScoreColor(0)).toBe('yellow');
            expect(getLipScoreColor(-1)).toBe('grey');
        });
    });

    describe('buildHeatmapRows', () => {
        it('merges differential abundance data with experiment metadata', () => {
            const diffData = {
                'exp1': [{ index: 0, score: 5 }, { index: 1, score: null }],
                'exp2': [{ index: 0, score: 2 }]
            };
            const meta = [
                { dpx_comparison: 'exp1', condition: 'CondA' }
            ];
            
            const rows = buildHeatmapRows(diffData, meta);
            
            expect(rows).toHaveLength(2);
            expect(rows[0].condition).toBe('CondA');
            expect(rows[0].cells[1].score).toBe(0); // null converted to 0
            
            // Missing metadata fallback
            expect(rows[1].condition).toBe('N/A');
        });
    });

    describe('createHeatmapDataset', () => {
        it('constructs correct dataset for Nightingale heatmap', () => {
            const rows = [
                {
                    yValue: 'exp1',
                    cells: [
                        { xValue: 1, yValue: 'exp1', score: 5 }
                    ]
                }
            ];
            const dataset = createHeatmapDataset(rows, 10);
            
            expect(dataset.xDomain).toHaveLength(10);
            expect(dataset.xDomain[0]).toBe(1);
            expect(dataset.xDomain[9]).toBe(10);
            expect(dataset.yDomain).toEqual(['exp1']);
            expect(dataset.dataHeatmap).toEqual([{ xValue: 1, yValue: 'exp1', score: 5 }]);
        });
    });
});

describe('NightingaleComponent Rendering', () => {
    const mockProteinData = {
        proteinName: 'P12345',
        proteinSequence: 'MVLSPADKTN',
        proteinDescription: 'Test Protein',
        experimentIDsList: ['exp1', 'exp2'],
        lipscoreList: [
            { experimentID: 'exp1', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
        ],
        experimentMetaData: [
            { dpx_comparison: 'exp1', condition: 'CondA', dose: '10uM' }
        ],
        differentialAbundanceData: {
            'exp1': [{ index: 0, score: 5 }]
        },
        featuresData: {
            sequence: 'MVLSPADKTN',
            features: [
                { type: 'DOMAIN', start: 1, end: 5, description: 'Test Domain' }
            ]
        },
        barcodeSequence: {}
    };

    it('renders without crashing with minimal props', () => {
        render(
            <NightingaleComponent 
                proteinData={mockProteinData}
                pdbIds={[]}
                selectedPdbId={null}
                setSelectedPdbId={() => {}}
            />
        );
        expect(screen.getByText('Test Protein')).toBeInTheDocument();
    });

    it('splits heatmap when masterCondition is provided', () => {
        const { container } = render(
            <NightingaleComponent 
                proteinData={mockProteinData}
                pdbIds={[]}
                selectedPdbId={null}
                setSelectedPdbId={() => {}}
                showHeatmap={true}
                masterCondition="CondA"
            />
        );
        
        // When split, we expect specific labels
        expect(container.textContent).toContain('(CondA)');
        expect(container.textContent).toContain('(other conditions)');
    });

    it('renders unsplit heatmap when masterCondition is absent', () => {
        const { container } = render(
            <NightingaleComponent 
                proteinData={mockProteinData}
                pdbIds={[]}
                selectedPdbId={null}
                setSelectedPdbId={() => {}}
                showHeatmap={true}
                masterCondition={undefined}
            />
        );
        
        // We shouldn't see the split condition text
        expect(container.textContent).not.toContain('(other conditions)');
        
        // Heatmap should just be 'Structural-Barcode'
        const tdNodes = Array.from(container.querySelectorAll('td'));
        const hasStructuralBarcode = tdNodes.some(td => td.textContent.trim() === 'Structural-Barcode');
        expect(hasStructuralBarcode).toBe(true);
    });

    it('handles empty experiment lists gracefully', () => {
        const emptyData = {
            ...mockProteinData,
            experimentIDsList: [],
            lipscoreList: [],
            differentialAbundanceData: {}
        };
        
        const { container } = render(
            <NightingaleComponent 
                proteinData={emptyData}
                pdbIds={[]}
                selectedPdbId={null}
                setSelectedPdbId={() => {}}
            />
        );
        
        expect(container).toBeInTheDocument();
        expect(screen.getByText('Test Protein')).toBeInTheDocument();
    });
});