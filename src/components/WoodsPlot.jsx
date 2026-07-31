import React, { useEffect, useMemo, useRef, useState } from 'react';

const WOODS_PLOT_HEIGHT = 320;
const WOODS_PLOT_TOP_MARGIN = 20;
const WOODS_PLOT_BOTTOM_MARGIN = 30;
const MIN_ABSOLUTE_LOG2FC = 1;
const Y_DOMAIN_PADDING_FACTOR = 1.1;
const MIN_Y_TICK_SPACING = 16;
const POSITIVE_PEPTIDE_COLOR = '#003f5c';
const NEGATIVE_PEPTIDE_COLOR = '#8b0000';

/**
 * Calculates the global log2FC domain for every comparison available to the
 * current view. Keeping one domain prevents the vertical scale from jumping when
 * the selected comparison changes. Negative and positive limits are calculated
 * separately to avoid reserving unused space merely to keep zero centered. A
 * minimum of +/-1 ensures both cutoff lines remain visible.
 *
 * @param {Array<object>} peptideData Peptide rows containing `diff` log2FC values.
 * @returns {[number, number]} The padded `[minimum, maximum]` log2FC domain.
 */
export const getWoodsPlotYDomain = (peptideData) => {
    const limits = peptideData.reduce((currentLimits, { diff }) => {
        if (diff == null || diff === '') return currentLimits;

        const numericDiff = Number(diff);
        if (!Number.isFinite(numericDiff)) return currentLimits;

        return {
            minimum: Math.min(currentLimits.minimum, numericDiff),
            maximum: Math.max(currentLimits.maximum, numericDiff),
        };
    }, {
        minimum: -MIN_ABSOLUTE_LOG2FC,
        maximum: MIN_ABSOLUTE_LOG2FC,
    });

    // Percentile caps can replace these extrema later without changing consumers.
    return [
        limits.minimum * Y_DOMAIN_PADDING_FACTOR,
        limits.maximum * Y_DOMAIN_PADDING_FACTOR,
    ];
};

/**
 * Finds the peptide rows that define the global lower and upper log2FC limits.
 *
 * @param {Array<object>} peptideData Peptide rows containing `diff` values.
 * @returns {{minimum: object|null, maximum: object|null}} The two extreme rows.
 */
export const getWoodsPlotExtrema = (peptideData) => peptideData.reduce((extrema, peptide) => {
    if (peptide.diff == null || peptide.diff === '') return extrema;

    const diff = Number(peptide.diff);
    if (!Number.isFinite(diff)) return extrema;

    return {
        minimum: !extrema.minimum || diff < Number(extrema.minimum.diff) ? peptide : extrema.minimum,
        maximum: !extrema.maximum || diff > Number(extrema.maximum.diff) ? peptide : extrema.maximum,
    };
}, { minimum: null, maximum: null });

/**
 * Maps log2FC values onto the fixed Woods plot pixel height. SVG coordinates
 * increase downwards, so the positive end of the domain maps to the top margin.
 *
 * @param {[number, number]} domain Global log2FC domain.
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
 * with the surrounding Nightingale manager. Peptides from the selected comparison
 * are positioned by their sequence coordinates and log2FC values.
 *
 * @param {object} props The component properties.
 * @param {number} props.length The protein sequence length in amino-acid residues.
 * It defines the initial full-sequence range before navigation updates arrive.
 * @param {Array<object>} props.peptideData Peptide-level differential-abundance rows.
 * Each row identifies its comparison, peptide, sequence coordinates, log2FC, and adjusted p-value.
 * @param {Object<string, object>} props.comparisonMetadata Comparison labels keyed by comparison ID.
 * @param {string} props.selectedComparison The comparison currently selected by the parent plot.
 * @param {(comparisonId: string) => void} props.onComparisonSelect Selects a comparison in the parent plot.
 * @returns {React.ReactElement} The managed Woods plot custom element.
 */
const WoodsPlot = ({
    length,
    peptideData = [],
    comparisonMetadata = {},
    selectedComparison = '',
    onComparisonSelect,
}) => {
    // The host reference lets this React component find the Nightingale manager
    // without coupling it to an id or to the page containing the plot.
    const elementRef = useRef(null);

    // Keep Nightingale's exact (potentially fractional) boundaries for peptide
    // clipping and horizontal coordinate scaling.
    const [displayRange, setDisplayRange] = useState({
        start: 1,
        end: length || 1,
    });

    const yDomain = useMemo(() => getWoodsPlotYDomain(peptideData), [peptideData]);
    const yScale = useMemo(() => createWoodsPlotYScale(yDomain), [yDomain]);
    const extrema = useMemo(() => getWoodsPlotExtrema(peptideData), [peptideData]);
    const comparisonCount = useMemo(() => new Set(
        peptideData.map(({ dpx_comparison }) => dpx_comparison).filter(Boolean)
    ).size, [peptideData]);
    const showComparisonExtrema = comparisonCount > 1;

    // Keep the data on the custom-element host so the drawing layer can consume
    // it directly when SVG rendering is introduced.
    useEffect(() => {
        if (!elementRef.current) return;

        elementRef.current.peptideData = peptideData;
        elementRef.current.comparisonMetadata = comparisonMetadata;
        elementRef.current.selectedComparison = selectedComparison;
        elementRef.current.yDomain = yDomain;
        elementRef.current.yScale = yScale;
        elementRef.current.plotHeight = WOODS_PLOT_HEIGHT;
    }, [comparisonMetadata, peptideData, selectedComparison, yDomain, yScale]);

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

    const formattedYMinimum = yDomain[0].toFixed(2);
    const formattedYMaximum = yDomain[1].toFixed(2);
    const getComparisonLabel = (peptide) => {
        if (!peptide) return '';

        const metadata = comparisonMetadata[peptide.dpx_comparison];
        return metadata?.dose || metadata?.condition || peptide.dpx_comparison;
    };
    const minimumComparisonLabel = getComparisonLabel(extrema.minimum);
    const maximumComparisonLabel = getComparisonLabel(extrema.maximum);
    const selectExtremaComparison = (peptide) => {
        if (typeof onComparisonSelect !== 'function' || !peptide?.dpx_comparison) return;

        onComparisonSelect(peptide.dpx_comparison);
    };
    const handleExtremaKeyDown = (event, peptide) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        selectExtremaComparison(peptide);
    };
    const dispatchPeptideHighlight = (eventType, peptide, parentEvent) => {
        const sourceElement = elementRef.current;
        if (!sourceElement) return;

        const start = Number(peptide?.pos_start);
        const end = Number(peptide?.pos_end);
        const isMouseOver = eventType === 'mouseover';
        if (isMouseOver && (!Number.isFinite(start) || !Number.isFinite(end))) return;

        // Nightingale managers propagate `highlight` to every managed track. Use
        // the peptide's complete interval, including any portion outside the
        // current viewport, and clear it when the pointer leaves the peptide.
        sourceElement.dispatchEvent(new CustomEvent('change', {
            detail: {
                eventType,
                feature: isMouseOver ? { ...peptide, start, end } : null,
                highlight: isMouseOver ? `${start}:${end}` : undefined,
                parentEvent: parentEvent.nativeEvent || parentEvent,
            },
            bubbles: true,
            cancelable: true,
            composed: true,
        }));
    };
    const plottedPeptides = useMemo(() => {
        const xDomainStart = displayRange.start;
        // Nightingale display-end is inclusive, so use end + 1 as the right edge.
        const xDomainEnd = displayRange.end + 1;
        const xDomainSpan = xDomainEnd - xDomainStart;

        if (!selectedComparison || xDomainSpan <= 0) return [];

        return peptideData.flatMap((peptide, index) => {
            if (peptide.dpx_comparison !== selectedComparison) return [];
            if (peptide.pos_start == null || peptide.pos_end == null || peptide.diff == null) return [];

            const start = Number(peptide.pos_start);
            const end = Number(peptide.pos_end);
            const diff = Number(peptide.diff);
            if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(diff)) return [];
            if (start < 1 || end < start || end < xDomainStart || start > displayRange.end) return [];

            // Clamp partially visible peptides to the current horizontal viewport.
            const visibleStart = Math.max(start, xDomainStart);
            const visibleEnd = Math.min(end + 1, xDomainEnd);
            const x1 = ((visibleStart - xDomainStart) / xDomainSpan) * 100;
            const x2 = ((visibleEnd - xDomainStart) / xDomainSpan) * 100;

            return [{
                key: peptide.differential_abundance_id
                    ?? `${peptide.dpx_comparison}-${peptide.pep_grouping_key}-${start}-${end}-${index}`,
                peptide,
                x1,
                x2,
                y: yScale(diff),
            }];
        });
    }, [displayRange, peptideData, selectedComparison, yScale]);
    const yAxisTicks = [
        ...(Math.abs(yScale(yDomain[1]) - yScale(1)) >= MIN_Y_TICK_SPACING
            ? [{ value: yDomain[1], label: `+${formattedYMaximum}` }]
            : []),
        { value: 1, label: '+1' },
        { value: 0, label: '0' },
        { value: -1, label: '-1' },
        ...(Math.abs(yScale(-1) - yScale(yDomain[0])) >= MIN_Y_TICK_SPACING
            ? [{ value: yDomain[0], label: formattedYMinimum }]
            : []),
    ];

    return (
        <nightingale-woods-plot
            ref={elementRef}
            style={{ display: 'block', lineHeight: 'normal', marginTop: '24px' }}
        >
            <svg
                aria-label={`Woods plot with log2FC axis from ${formattedYMinimum} to +${formattedYMaximum}`}
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

                {plottedPeptides.map(({ key, peptide, x1, x2, y }) => (
                    <line
                        className="woods-plot-peptide"
                        data-comparison={peptide.dpx_comparison}
                        data-peptide={peptide.pep_grouping_key || ''}
                        key={key}
                        onMouseOut={(event) => dispatchPeptideHighlight('mouseout', peptide, event)}
                        onMouseOver={(event) => dispatchPeptideHighlight('mouseover', peptide, event)}
                        stroke={Number(peptide.diff) < 0 ? NEGATIVE_PEPTIDE_COLOR : POSITIVE_PEPTIDE_COLOR}
                        strokeLinecap="butt"
                        strokeWidth="5"
                        x1={`${x1}%`}
                        x2={`${x2}%`}
                        y1={y}
                        y2={y}
                    />
                ))}

                <line
                    className="woods-plot-y-axis"
                    x1="1"
                    x2="1"
                    y1={yScale(yDomain[1])}
                    y2={yScale(yDomain[0])}
                    stroke="#000"
                />
                {showComparisonExtrema && extrema.maximum && (
                    <text
                        aria-label={`Select highest comparison: ${maximumComparisonLabel}`}
                        className="woods-plot-maximum-comparison"
                        fill={POSITIVE_PEPTIDE_COLOR}
                        fontSize="11"
                        onClick={() => selectExtremaComparison(extrema.maximum)}
                        onKeyDown={(event) => handleExtremaKeyDown(event, extrema.maximum)}
                        role="button"
                        style={{ cursor: 'pointer' }}
                        tabIndex="0"
                        textAnchor="end"
                        x="99%"
                        y="12"
                    >
                        <tspan style={{ textDecoration: 'underline' }}>Highest</tspan>
                        : {maximumComparisonLabel} ({Number(extrema.maximum.diff).toFixed(2)})
                    </text>
                )}
                {showComparisonExtrema && extrema.minimum && (
                    <text
                        aria-label={`Select lowest comparison: ${minimumComparisonLabel}`}
                        className="woods-plot-minimum-comparison"
                        dominantBaseline="text-after-edge"
                        fill={NEGATIVE_PEPTIDE_COLOR}
                        fontSize="11"
                        onClick={() => selectExtremaComparison(extrema.minimum)}
                        onKeyDown={(event) => handleExtremaKeyDown(event, extrema.minimum)}
                        role="button"
                        style={{ cursor: 'pointer' }}
                        tabIndex="0"
                        textAnchor="end"
                        x="99%"
                        y={WOODS_PLOT_HEIGHT - 2}
                    >
                        <tspan style={{ textDecoration: 'underline' }}>Lowest</tspan>
                        : {minimumComparisonLabel} ({Number(extrema.minimum.diff).toFixed(2)})
                    </text>
                )}
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
