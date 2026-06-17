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
import NightingaleComponent, { getLipScoreColor, buildHeatmapRows, createHeatmapDataset, getHeatmapTooltip, getSequencePositionForTrackEvent, getSequencePositionForHeatmapEvent, applyExactTrackBaseWidth, refreshNightingaleDimensions, relayHeatmapHighlightEvent, dispatchHeatmapHoverHighlightEvent } from '../NightingaleComponent';

describe('NightingaleComponent Utilities', () => {
    describe('getLipScoreColor', () => {
        it('returns correct color based on thresholds', () => {
            expect(getLipScoreColor(11)).toBe('red');
            expect(getLipScoreColor(10)).toBe('red');
            expect(getLipScoreColor(7)).toBe('orange');
            expect(getLipScoreColor(5)).toBe('orange');
            expect(getLipScoreColor(2)).toBe('yellow');
            expect(getLipScoreColor(0)).toBe('yellow');
            expect(getLipScoreColor(null)).toBe('grey');
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
            expect(rows[0].cells[1].score).toBeNull(); // null preserved as no coverage
            
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
            expect(dataset.dataHeatmap).toHaveLength(10);
            expect(dataset.dataHeatmap[0]).toEqual({ xValue: 1, yValue: 'exp1', score: 5 });
            expect(dataset.dataHeatmap[1]).toMatchObject({
                xValue: 2,
                yValue: 'exp1',
                score: null,
                missingCoverageDataset: true,
            });
        });
    });

    describe('getSequencePositionForTrackEvent', () => {
        const rect = (left, width) => ({
            left,
            width,
            right: left + width,
            top: 0,
            bottom: 20,
            height: 20,
        });

        it('uses the track xScale and rendered svg bounds when available', () => {
            const track = document.createElement('nightingale-track');
            const shadowRoot = track.attachShadow({ mode: 'open' });
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.getBoundingClientRect = jest.fn(() => rect(100, 1200));
            shadowRoot.appendChild(svg);

            track.setAttribute('margin-left', '0');
            track.setAttribute('margin-right', '0');
            track.xScale = { invert: jest.fn((x) => (x / 10) + 1) };

            const event = new MouseEvent('mousemove', { clientX: 350 });

            expect(getSequencePositionForTrackEvent(event, track)).toBe(26);
            expect(track.xScale.invert).toHaveBeenCalledWith(250);
        });

        it('falls back to display range and margins when xScale is unavailable', () => {
            const track = document.createElement('nightingale-track');
            track.getBoundingClientRect = jest.fn(() => rect(100, 1000));
            track.setAttribute('length', '1000');
            track.setAttribute('display-start', '101');
            track.setAttribute('display-end', '200');
            track.setAttribute('margin-left', '10');
            track.setAttribute('margin-right', '10');

            const event = new MouseEvent('mousemove', { clientX: 600 });

            expect(getSequencePositionForTrackEvent(event, track)).toBe(151);
        });

        it('returns null outside the rendered sequence area', () => {
            const track = document.createElement('nightingale-track');
            track.getBoundingClientRect = jest.fn(() => rect(100, 1000));
            track.setAttribute('display-start', '1');
            track.setAttribute('display-end', '100');
            track.setAttribute('margin-left', '10');
            track.setAttribute('margin-right', '10');

            expect(getSequencePositionForTrackEvent(new MouseEvent('mousemove', { clientX: 105 }), track)).toBeNull();
            expect(getSequencePositionForTrackEvent(new MouseEvent('mousemove', { clientX: 1090 }), track)).toBeNull();
        });
    });

    describe('getSequencePositionForHeatmapEvent', () => {
        const rect = (left, width) => ({
            left,
            width,
            right: left + width,
            top: 0,
            bottom: 100,
            height: 100,
        });

        it('maps a heatmap canvas mouse position to a sequence position', () => {
            const heatmap = document.createElement('nightingale-sequence-heatmap');
            const shadowRoot = heatmap.attachShadow({ mode: 'open' });
            const canvas = document.createElement('canvas');
            canvas.getBoundingClientRect = jest.fn(() => rect(100, 1000));
            shadowRoot.appendChild(canvas);

            heatmap.setAttribute('length', '1000');
            heatmap.setAttribute('display-start', '101');
            heatmap.setAttribute('display-end', '200');
            heatmap.setAttribute('margin-left', '0');
            heatmap.setAttribute('margin-right', '0');

            const event = new MouseEvent('mousemove', { clientX: 600 });

            expect(getSequencePositionForHeatmapEvent(event, heatmap)).toBe(151);
        });

        it('returns null outside the heatmap sequence area', () => {
            const heatmap = document.createElement('nightingale-sequence-heatmap');
            heatmap.getBoundingClientRect = jest.fn(() => rect(100, 1000));
            heatmap.setAttribute('length', '100');
            heatmap.setAttribute('display-start', '1');
            heatmap.setAttribute('display-end', '100');
            heatmap.setAttribute('margin-left', '10');
            heatmap.setAttribute('margin-right', '10');

            expect(getSequencePositionForHeatmapEvent(new MouseEvent('mousemove', { clientX: 105 }), heatmap)).toBeNull();
            expect(getSequencePositionForHeatmapEvent(new MouseEvent('mousemove', { clientX: 1090 }), heatmap)).toBeNull();
        });
    });

    describe('applyExactTrackBaseWidth', () => {
        it('overrides the custom track minimum residue width with the exact xScale width', () => {
            const track = document.createElement('nightingale-track');
            track.xScale = jest.fn((position) => position * 2.5);

            applyExactTrackBaseWidth(track);

            expect(track.getSingleBaseWidth()).toBe(2.5);
            expect(track.__dspaExactTrackBaseWidth).toBe(true);
        });

        it('is idempotent once applied to a track element', () => {
            const track = document.createElement('nightingale-track');
            track.xScale = jest.fn((position) => position * 3);

            applyExactTrackBaseWidth(track);
            const getSingleBaseWidth = track.getSingleBaseWidth;
            applyExactTrackBaseWidth(track);

            expect(track.getSingleBaseWidth).toBe(getSingleBaseWidth);
            expect(track.getSingleBaseWidth()).toBe(3);
        });
    });

    describe('refreshNightingaleDimensions', () => {
        it('calls the Nightingale dimension refresh hook when available', () => {
            const element = { onDimensionsChange: jest.fn() };

            refreshNightingaleDimensions(element);

            expect(element.onDimensionsChange).toHaveBeenCalledTimes(1);
        });

        it('ignores elements that do not expose a dimension refresh hook', () => {
            expect(() => refreshNightingaleDimensions(document.createElement('div'))).not.toThrow();
            expect(() => refreshNightingaleDimensions(null)).not.toThrow();
        });
    });

    describe('getHeatmapTooltip', () => {
        it('handles null or NaN scores', () => {
            const result1 = getHeatmapTooltip({ score: null });
            expect(result1).toContain('no coverage');
            
            const result2 = getHeatmapTooltip({ score: NaN });
            expect(result2).toContain('no coverage');
        });

        it('distinguishes missing coverage dataset positions from null no-coverage positions', () => {
            const result = getHeatmapTooltip({ missingCoverageDataset: true, score: null });
            expect(result).toContain('This sequence position is not present in the coverage dataset');
        });

        it('formats valid score correctly', () => {
            const result = getHeatmapTooltip({ yValue: 'exp1', condition: 'CondA', score: 3.14159 });
            expect(result).toContain('exp1');
            expect(result).toContain('CondA');
            expect(result).toContain('3.14');
        });

        it('escapes untrusted experiment and condition values', () => {
            const result = getHeatmapTooltip({
                yValue: 'exp"><img src=x onerror=alert(1)>',
                condition: '<script>alert(2)</script>',
                score: 3.14159,
            });

            expect(result).toContain('/experiment/exp%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
            expect(result).toContain('exp&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
            expect(result).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');

            const container = document.createElement('div');
            container.innerHTML = result;

            expect(container.querySelector('img')).toBeNull();
            expect(container.querySelector('script')).toBeNull();
            expect(container.textContent).toContain('exp"><img src=x onerror=alert(1)>');
            expect(container.textContent).toContain('<script>alert(2)</script>');
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

    describe('dispatchHeatmapHoverHighlightEvent', () => {
        it('dispatches a manager highlight event for the hovered heatmap residue', () => {
            const manager = document.createElement('nightingale-manager');
            const heatmap = document.createElement('nightingale-sequence-heatmap');
            manager.appendChild(heatmap);
            document.body.appendChild(manager);

            heatmap.getBoundingClientRect = jest.fn(() => ({
                left: 100,
                width: 1000,
                right: 1100,
                top: 0,
                bottom: 100,
                height: 100,
            }));
            heatmap.setAttribute('length', '1000');
            heatmap.setAttribute('display-start', '101');
            heatmap.setAttribute('display-end', '200');
            heatmap.setAttribute('margin-left', '0');
            heatmap.setAttribute('margin-right', '0');

            let receivedEvent = null;
            manager.addEventListener('change', (event) => {
                receivedEvent = event;
            });

            const highlight = dispatchHeatmapHoverHighlightEvent(
                new MouseEvent('mousemove', { clientX: 600 }),
                heatmap
            );

            expect(highlight).toBe('151:151');
            expect(receivedEvent).not.toBeNull();
            expect(receivedEvent.detail).toMatchObject({
                eventType: 'mouseover',
                highlight: '151:151',
                feature: { position: 151 },
                __dspaRelayedHeatmapEvent: true,
            });

            document.body.removeChild(manager);
        });

        it('does not redispatch duplicate hover highlights for the same residue', () => {
            const manager = document.createElement('nightingale-manager');
            const heatmap = document.createElement('nightingale-sequence-heatmap');
            manager.appendChild(heatmap);
            document.body.appendChild(manager);

            heatmap.getBoundingClientRect = jest.fn(() => ({
                left: 0,
                width: 100,
                right: 100,
                top: 0,
                bottom: 100,
                height: 100,
            }));
            heatmap.setAttribute('length', '100');
            heatmap.setAttribute('display-start', '1');
            heatmap.setAttribute('display-end', '100');

            let eventCount = 0;
            manager.addEventListener('change', () => {
                eventCount++;
            });

            dispatchHeatmapHoverHighlightEvent(new MouseEvent('mousemove', { clientX: 10 }), heatmap);
            dispatchHeatmapHoverHighlightEvent(new MouseEvent('mousemove', { clientX: 10 }), heatmap);

            expect(eventCount).toBe(1);

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

    it('refreshes navigation dimensions after applying dynamic Nightingale attributes', async () => {
        const NavigationElement = customElements.get('nightingale-navigation');
        const TrackElement = customElements.get('nightingale-track');
        const originalNavigationRefresh = NavigationElement.prototype.onDimensionsChange;
        const originalTrackRefresh = TrackElement.prototype.onDimensionsChange;

        const navigationRefresh = jest.fn(function onDimensionsChange() {
            this.__dimensionRefreshSnapshot = {
                height: this.getAttribute('height'),
                length: this.getAttribute('length'),
                displayEnd: this.getAttribute('display-end'),
            };

            let svg = this.querySelector('svg');
            if (!svg) {
                svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                this.appendChild(svg);
            }
            svg.setAttribute('height', this.getAttribute('height'));
        });
        const trackRefresh = jest.fn();

        NavigationElement.prototype.onDimensionsChange = navigationRefresh;
        TrackElement.prototype.onDimensionsChange = trackRefresh;

        try {
            const { container } = render(
                <NightingaleComponent
                    proteinData={mockProteinData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );

            const navigation = container.querySelector('nightingale-navigation');
            await waitFor(() => expect(navigationRefresh).toHaveBeenCalled());

            expect(navigation.__dimensionRefreshSnapshot).toEqual({
                height: '30',
                length: '10',
                displayEnd: '10',
            });
            expect(navigation.querySelector('svg')).toHaveAttribute('height', '30');
            expect(trackRefresh).not.toHaveBeenCalled();
        } finally {
            if (originalNavigationRefresh) {
                NavigationElement.prototype.onDimensionsChange = originalNavigationRefresh;
            } else {
                delete NavigationElement.prototype.onDimensionsChange;
            }

            if (originalTrackRefresh) {
                TrackElement.prototype.onDimensionsChange = originalTrackRefresh;
            } else {
                delete TrackElement.prototype.onDimensionsChange;
            }
        }
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
            render(
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

        it('renders requested structural, domain/site, and PTM feature tracks', () => {
            const requestedFeatureData = {
                ...mockProteinData,
                featuresData: {
                    ...mockProteinData.featuresData,
                    features: [
                        { type: 'HELIX', start: 1, end: 2 },
                        { type: 'TURN', start: 3, end: 3 },
                        { type: 'STRAND', start: 4, end: 5 },
                        { type: 'BINDING', start: 6, end: 6 },
                        { type: 'ACT_SITE', start: 7, end: 7 },
                        { type: 'DOMAIN', start: 1, end: 5 },
                        { type: 'COILED', start: 8, end: 9 },
                        { type: 'METAL', start: 10, end: 10 },
                        { type: 'MOD_RES', start: 2, end: 2 },
                    ],
                },
            };

            render(
                <NightingaleComponent
                    proteinData={requestedFeatureData}
                    pdbIds={[]}
                    selectedPdbId={null}
                    setSelectedPdbId={() => {}}
                />
            );

            expect(screen.getByText('Alpha helix')).toBeInTheDocument();
            expect(screen.getByText('Turn')).toBeInTheDocument();
            expect(screen.getByText('Beta strand')).toBeInTheDocument();
            expect(screen.getByText('Binding site')).toBeInTheDocument();
            expect(screen.getByText('Active site')).toBeInTheDocument();
            expect(screen.getByText('Domain')).toBeInTheDocument();
            expect(screen.getByText('Coiled-coil')).toBeInTheDocument();
            expect(screen.getByText('Metal binding')).toBeInTheDocument();
            expect(screen.getByText('Modified residue')).toBeInTheDocument();
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
