import React, { useEffect, useMemo, useRef, useState } from 'react';

const WOODS_PLOT_HEIGHT = 320;
const WOODS_PLOT_TOP_MARGIN = 20;
const WOODS_PLOT_BOTTOM_MARGIN = 30;
const MIN_ABSOLUTE_LOG2FC = 1;
const Y_DOMAIN_PADDING_FACTOR = 1.1;
const MIN_Y_TICK_SPACING = 16;

/**
 * Calculates a symmetric log2FC domain for every comparison available to the
 * current view. Keeping one domain prevents the vertical scale from jumping when
 * the selected comparison changes. A minimum of +/-1 ensures both cutoff lines
 * remain visible when data is empty or all fold changes are small.
 *
 * @param {Array<object>} peptideData Peptide rows containing `diff` log2FC values.
 * @returns {[number, number]} The padded `[minimum, maximum]` log2FC domain.
 */
export const getWoodsPlotYDomain = (peptideData) => {
    const maxAbsoluteLog2FC = peptideData.reduce((currentMaximum, { diff }) => {
        if (diff == null || diff === '') return currentMaximum;

        const numericDiff = Number(diff);
        return Number.isFinite(numericDiff)
            ? Math.max(currentMaximum, Math.abs(numericDiff))
            : currentMaximum;
    }, MIN_ABSOLUTE_LOG2FC);

    // A percentile cap can replace this maximum later without changing consumers.
    const yLimit = maxAbsoluteLog2FC * Y_DOMAIN_PADDING_FACTOR;
    return [-yLimit, yLimit];
};

/**
 * Maps log2FC values onto the fixed Woods plot pixel height. SVG coordinates
 * increase downwards, so the positive end of the domain maps to the top margin.
 *
 * @param {[number, number]} domain Symmetric log2FC domain.
 * @returns {(value: number) => number} A log2FC-to-pixel conversion function.
 */
export const createWoodsPlotYScale = ([domainMinimum, domainMaximum]) => {
    const rangeBottom = WOODS_PLOT_HEIGHT - WOODS_PLOT_BOTTOM_MARGIN;
    const rangeTop = WOODS_PLOT_TOP_MARGIN;
    const domainSpan = domainMaximum - domainMinimum;

    return (value) => rangeBottom
        + ((Number(value) - domainMinimum) / domainSpan) * (rangeTop - rangeBottom);
};

/**
 * Reads one numeric boundary from a Nightingale navigation change event.
 *
 * Nightingale can provide a combined detail object such as
 * `{ 'display-start': 10, 'display-end': 30 }`, or a single-property event
 * such as `{ type: 'display-start', value: 10 }`. Missing, empty, and
 * non-numeric values leave the current boundary unchanged via `fallback`.
 *
 * @param {object | undefined} detail The navigation event's `detail` object.
 * @param {'display-start' | 'display-end'} attribute The boundary to read.
 * @param {number} fallback The current boundary, returned when no valid value is present.
 * @returns {number} The parsed navigation boundary or `fallback`.
 */
const getRangeValue = (detail, attribute, fallback) => {
    const value = detail?.[attribute] ?? (detail?.type === attribute ? detail.value : undefined);
    if (value == null || value === '') return fallback;

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : fallback;
};

/**
 * Renders the Woods plot track and keeps its visible protein region synchronized
 * with the surrounding Nightingale manager. This initial version displays the
 * current residue boundaries and inclusive range as text; later plot rendering
 * can use the same `displayRange` state to position peptide rectangles.
 *
 * @param {object} props The component properties.
 * @param {number} props.length The protein sequence length in amino-acid residues.
 * It defines the initial full-sequence range before navigation updates arrive.
 * @param {Array<object>} props.peptideData Peptide-level differential-abundance rows.
 * Each row identifies its comparison, peptide, sequence coordinates, log2FC, and adjusted p-value.
 * @param {string} props.selectedComparison The comparison currently selected by the parent plot.
 * @returns {React.ReactElement} The managed Woods plot custom element.
 */
const WoodsPlot = ({ length, peptideData = [], selectedComparison = '' }) => {
    // The host reference lets this React component find the Nightingale manager
    // without coupling it to an id or to the page containing the plot.
    const elementRef = useRef(null);

    // Keep Nightingale's exact (potentially fractional) boundaries for future
    // coordinate scaling; rounding is applied only to the placeholder text.
    const [displayRange, setDisplayRange] = useState({
        start: 1,
        end: length || 1,
    });

    const yDomain = useMemo(() => getWoodsPlotYDomain(peptideData), [peptideData]);
    const yScale = useMemo(() => createWoodsPlotYScale(yDomain), [yDomain]);

    // Keep the data on the custom-element host so the drawing layer can consume
    // it directly when SVG rendering is introduced.
    useEffect(() => {
        if (!elementRef.current) return;

        elementRef.current.peptideData = peptideData;
        elementRef.current.selectedComparison = selectedComparison;
        elementRef.current.yDomain = yDomain;
        elementRef.current.yScale = yScale;
        elementRef.current.plotHeight = WOODS_PLOT_HEIGHT;
    }, [peptideData, selectedComparison, yDomain, yScale]);

    // A different sequence length means a different protein, so begin again with
    // its complete sequence until navigation provides a narrower visible range.
    useEffect(() => {
        setDisplayRange({ start: 1, end: length || 1 });
    }, [length]);

    // Range changes bubble from navigation and zoomable tracks to their manager.
    // Listening there keeps Woods synchronized regardless of which track changed it.
    useEffect(() => {
        const manager = elementRef.current?.closest('nightingale-manager');
        if (!manager) return undefined;

        const updateDisplayRange = (detail) => {
            // Ignore other Nightingale change events, including hover and highlight.
            const isDisplayRangeChange = detail && (
                Object.prototype.hasOwnProperty.call(detail, 'display-start') ||
                Object.prototype.hasOwnProperty.call(detail, 'display-end') ||
                detail.type === 'display-start' ||
                detail.type === 'display-end'
            );
            if (!isDisplayRangeChange) return;

            setDisplayRange((currentRange) => {
                const nextRange = {
                    start: getRangeValue(detail, 'display-start', currentRange.start),
                    end: getRangeValue(detail, 'display-end', currentRange.end),
                };

                return nextRange.start === currentRange.start && nextRange.end === currentRange.end
                    ? currentRange
                    : nextRange;
            });
        };

        const handleDisplayRangeChange = (event) => updateDisplayRange(event.detail);

        manager.addEventListener('change', handleDisplayRangeChange);

        // A Woods component can mount after the user has already zoomed. Seed it
        // from the navigation's current attributes instead of assuming full range.
        const navigation = manager.querySelector('nightingale-navigation');
        if (navigation) {
            updateDisplayRange({
                'display-start': navigation.getAttribute('display-start'),
                'display-end': navigation.getAttribute('display-end'),
            });
        }

        return () => manager.removeEventListener('change', handleDisplayRangeChange);
    }, []);

    // Match the integer labels shown by Nightingale and count both end residues.
    const displayedStart = Math.round(displayRange.start);
    const displayedEnd = Math.round(displayRange.end);
    const displayedLength = Math.max(0, displayedEnd - displayedStart + 1);
    const formattedYLimit = yDomain[1].toFixed(2);
    const yAxisTicks = [
        ...(Math.abs(yScale(yDomain[1]) - yScale(1)) >= MIN_Y_TICK_SPACING
            ? [{ value: yDomain[1], label: `+${formattedYLimit}` }]
            : []),
        { value: 1, label: '+1' },
        { value: 0, label: '0' },
        { value: -1, label: '-1' },
        ...(Math.abs(yScale(-1) - yScale(yDomain[0])) >= MIN_Y_TICK_SPACING
            ? [{ value: yDomain[0], label: `-${formattedYLimit}` }]
            : []),
    ];

    return (
        <nightingale-woods-plot
            ref={elementRef}
            style={{ display: 'block', lineHeight: 'normal', marginTop: '24px' }}
        >
            <div>Woods plot — position: {displayedStart}–{displayedEnd}; range: {displayedLength} residues</div>
            <svg
                aria-label={`Woods plot with log2FC axis from -${formattedYLimit} to +${formattedYLimit}`}
                height={WOODS_PLOT_HEIGHT}
                role="img"
                style={{ display: 'block', width: '100%' }}
                width="100%"
            >
                <line
                    className="woods-plot-cutoff-line woods-plot-cutoff-positive"
                    x1="0"
                    x2="100%"
                    y1={yScale(1)}
                    y2={yScale(1)}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                />
                <line
                    className="woods-plot-zero-line"
                    x1="0"
                    x2="100%"
                    y1={yScale(0)}
                    y2={yScale(0)}
                    stroke="#000"
                    strokeWidth="1.5"
                />
                <line
                    className="woods-plot-cutoff-line woods-plot-cutoff-negative"
                    x1="0"
                    x2="100%"
                    y1={yScale(-1)}
                    y2={yScale(-1)}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                />

                <line
                    className="woods-plot-y-axis"
                    x1="1"
                    x2="1"
                    y1={yScale(yDomain[1])}
                    y2={yScale(yDomain[0])}
                    stroke="#000"
                />
                <text className="woods-plot-y-axis-label" fill="#000" fontSize="11" x="9" y="12">
                    log2FC
                </text>
                {yAxisTicks.map(({ value, label }) => (
                    <g className="woods-plot-y-tick" key={value} transform={`translate(0 ${yScale(value)})`}>
                        <line x1="1" x2="6" y1="0" y2="0" stroke="#000" />
                        <text
                            dominantBaseline="middle"
                            fill="#000"
                            fontSize="11"
                            x="9"
                            y="0"
                        >
                            {label}
                        </text>
                    </g>
                ))}
            </svg>
        </nightingale-woods-plot>
    );
};

export default WoodsPlot;
