import React, { useEffect, useRef, useState } from 'react';

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
 * @returns {React.ReactElement} The managed Woods plot custom element.
 */
const WoodsPlot = ({ length }) => {
    // The host reference lets this React component find the Nightingale manager
    // without coupling it to an id or to the page containing the plot.
    const elementRef = useRef(null);

    // Keep Nightingale's exact (potentially fractional) boundaries for future
    // coordinate scaling; rounding is applied only to the placeholder text.
    const [displayRange, setDisplayRange] = useState({
        start: 1,
        end: length || 1,
    });

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

    return (
        <nightingale-woods-plot
            ref={elementRef}
            style={{ display: 'block', lineHeight: 'normal', marginTop: '24px' }}
        >
            Woods plot — position: {displayedStart}–{displayedEnd}; range: {displayedLength} residues
        </nightingale-woods-plot>
    );
};

export default WoodsPlot;
