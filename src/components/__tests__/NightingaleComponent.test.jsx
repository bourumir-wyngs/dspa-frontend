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
jest.mock('@dspa-nightingale/nightingale-track', () => ({}), { virtual: true });
jest.mock('@dspa-nightingale/nightingale-structure', () => {
    return {
        LIP_SCALE: [
            { threshold: 10, color: 'red', label: '> 10' },
            { threshold: 5, color: 'orange', label: '> 5' },
            { threshold: 0, color: 'yellow', label: '> 0' },
            { threshold: -Infinity, color: 'grey', label: 'No data' }
        ]
    };
}, { virtual: true });

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NightingaleComponent, { getLipScoreColor, buildHeatmapRows, createHeatmapDataset, getHeatmapTooltip, relayHeatmapHighlightEvent } from '../NightingaleComponent';

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
    describe('getHeatmapTooltip', () => {
        it('handles zero or NaN scores', () => {
            const result1 = getHeatmapTooltip({ score: 0 });
            expect(result1).toContain('no coverage');
            
            const result2 = getHeatmapTooltip({ score: NaN });
            expect(result2).toContain('no coverage');
        });

        it('formats valid score correctly', () => {
            const result = getHeatmapTooltip({ yValue: 'exp1', condition: 'CondA', score: 3.14159 });
            expect(result).toContain('exp1');
            expect(result).toContain('CondA');
            expect(result).toContain('3.14');
        });
    });

    describe('relayHeatmapHighlightEvent', () => {
        it('dispatches relayed event to manager element', () => {
            const manager = document.createElement('nightingale-manager');
            const source = document.createElement('div');
            manager.appendChild(source);
            document.body.appendChild(manager);
            
            let receivedEvent = null;
            manager.addEventListener('change', (e) => {
                receivedEvent = e;
            });
            
            const initialEvent = new CustomEvent('change', { detail: 'highlight-1' });
            relayHeatmapHighlightEvent(initialEvent, source);
            
            expect(receivedEvent).not.toBeNull();
            expect(receivedEvent.detail).toHaveProperty('__dspaRelayedHeatmapEvent', true);
            expect(receivedEvent.detail.value).toBe('highlight-1');
            
            document.body.removeChild(manager);
        });

        it('prevents double firing if already relayed', () => {
            const manager = document.createElement('nightingale-manager');
            const source = document.createElement('div');
            manager.appendChild(source);
            document.body.appendChild(manager);
            
            let eventCount = 0;
            manager.addEventListener('change', () => {
                eventCount++;
            });
            
            const initialEvent = new CustomEvent('change', { detail: { value: 'highlight-1', __dspaRelayedHeatmapEvent: true } });
            relayHeatmapHighlightEvent(initialEvent, source);
            
            expect(eventCount).toBe(0);
            document.body.removeChild(manager);
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
            { experimentID: 'exp1', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
            { experimentID: 'exp2', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
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
                { type: 'DOMAIN', start: 1, end: 5, description: 'Test Domain' },
                { type: 'BINDING', start: 6, end: 8, ligand: { name: 'ATP' } },
            ]
        },
        barcodeSequence: {}
    };

    it('renders without crashing with minimal props', () => {
        render(
            <NightingaleComponent 
                proteinData={mockProteinData}
                pdbIds={[]}
                selectedPdbId="1XYZ"
                setSelectedPdbId={() => {}}
            />
        );
        expect(screen.getByText('Test Protein')).toBeInTheDocument();
        expect(screen.getByText('Selected PDB ID: 1XYZ')).toBeInTheDocument();
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
        expect(container.textContent).toContain('No experiment rows from other conditions.'); // Fallback text
    });

    it('renders fallback text when no matching rows exist for master condition', () => {
        const noMatchData = {
            ...mockProteinData,
            differentialAbundanceData: {
                'exp2': [{ index: 0, score: 5 }] // exp2 is not CondA
            },
            experimentMetaData: [
                { dpx_comparison: 'exp2', condition: 'CondB' }
            ]
        };
        const { container } = render(
            <NightingaleComponent 
                proteinData={noMatchData}
                pdbIds={[]}
                selectedPdbId={null}
                setSelectedPdbId={() => {}}
                showHeatmap={true}
                masterCondition="CondA"
            />
        );
        expect(container.textContent).toContain('No experiment rows match this condition.');
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

    describe('Experiment Fallbacks & Controls', () => {
        it('uses passedExperimentIDs when valid', () => {
            render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    passedExperimentIDs={['exp2']}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            // exp2 button should be present and selected
            const button = screen.getByText('Experiment exp2');
            expect(button).toHaveClass('selected');
        });

        it('falls back to proteinData.experimentIDsList', () => {
            render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            // first experiment from list
            const button = screen.getByText('10uM');
            expect(button).toHaveClass('selected');
        });

        it('falls back to proteinData.experimentIDsList when passedExperimentIDs do not match available entries', () => {
            render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    passedExperimentIDs={['missing-exp']}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            expect(screen.getByText('10uM')).toBeInTheDocument();
            expect(screen.getByText('Experiment exp2')).toBeInTheDocument();
        });

        it('falls back to available lipscoreList experiments if experimentIDsList is empty', () => {
            const data = {
                ...mockProteinData,
                experimentIDsList: []
            };
            render(
                <NightingaleComponent 
                    proteinData={data}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            const button = screen.getByText('10uM');
            expect(button).toHaveClass('selected');
        });

        it('renders dropdown when experiment count > 5', () => {
            const sixExperiments = ['exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6'];
            const data = {
                ...mockProteinData,
                experimentIDsList: sixExperiments,
                lipscoreList: sixExperiments.map(id => ({ experimentID: id, data: [] }))
            };
            const { container } = render(
                <NightingaleComponent 
                    proteinData={data}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            // buttons shouldn't be there, dropdown (select) should
            expect(container.querySelector('.experiment-button')).toBeNull();
            expect(container.querySelector('select')).toBeInTheDocument();
        });

        it('clicking the same experiment twice keeps selection', () => {
            render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            const button = screen.getByText('10uM');
            expect(button).toHaveClass('selected');
            
            fireEvent.click(button);
            expect(button).toHaveClass('selected');
        });
    });

    describe('Conditional track rendering', () => {
        it('omits heatmap rows when showHeatmap={false}', () => {
            const { container } = render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                    showHeatmap={false}
                />
            );
            
            const hasStructuralBarcode = Array.from(container.querySelectorAll('td'))
                .some(td => td.textContent.trim() === 'Structural-Barcode');
            expect(hasStructuralBarcode).toBe(false);
        });

        it('renders domain feature track if features exist', () => {
            const { container } = render(
                <NightingaleComponent 
                    proteinData={mockProteinData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            expect(screen.getByText('Domain')).toBeInTheDocument();
            expect(screen.getByText('Binding site')).toBeInTheDocument();
        });

        it('omits domain feature track if features do not exist', () => {
            const noFeatures = { ...mockProteinData, featuresData: { features: [] } };
            render(
                <NightingaleComponent 
                    proteinData={noFeatures}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );
            expect(screen.queryByText('Domain')).not.toBeInTheDocument();
        });
    });
});
