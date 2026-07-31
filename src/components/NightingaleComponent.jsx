import React, { useEffect, useMemo, useRef, useState } from 'react';
import "@nightingale-elements/nightingale-sequence";
import "@nightingale-elements/nightingale-navigation";
import "@nightingale-elements/nightingale-manager";
import "@nightingale-elements/nightingale-colored-sequence";
import "@nightingale-elements/nightingale-msa";


import "@nightingale-elements/nightingale-sequence-heatmap";
import "@dspa-nightingale/nightingale-structure";
import { LIP_SCALE as LIP_COLOR_SCALE } from "@dspa-nightingale/nightingale-structure";
import "@dspa-nightingale/nightingale-track";
import WoodsPlot from './WoodsPlot.jsx';


// Shared color scale for LiP scores — used by the legend, heatmap, and 3D structure.
// Each finite entry defines a threshold (score >= threshold → use this color) checked top-down.
// Null / non-finite scores represent no coverage and use the dedicated no-coverage color.

/**
 * Returns the color string for a given LiP score, using the shared LIP_COLOR_SCALE.
 */
function getLipScoreColor(score) {
    const noCoverageColor = LIP_COLOR_SCALE[LIP_COLOR_SCALE.length - 1].color;

    if (score == null || !Number.isFinite(score)) {
        return noCoverageColor;
    }

    for (const entry of LIP_COLOR_SCALE) {
        if (score >= entry.threshold) return entry.color;
    }
    return noCoverageColor;
}

const defaultAttributes = {
    "min-width": "10",
    length: 0, 
    height: 15, 
    "display-start": "1",
    "display-end": 0, 
    "margin-left": "0",
    "margin-right": "0",
    "margin-color": "white",
    "highlight-event": "onmouseover",
    "highlight-color": "rgb(255, 210, 128)"
};

const heatmapAttributes = {
    "min-width": "10",
    "margin-left": "0",
    "margin-right": "0",
    "margin-color": "white",
};

const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character]);

const getHeatmapTooltip = (d) => {
    if (d.missingCoverageDataset) {
        return `
            <div class="tooltip-container">
               <strong>This sequence position is not present in the coverage dataset</strong>
            </div>
            `;
    }

    if (d.score == null || !Number.isFinite(d.score)) {
        return `
            <div class="tooltip-container">
               <strong>no coverage</strong>
            </div>
            `;
    }

    const experimentValue = d.yValue == null || d.yValue === "" ? "N/A" : String(d.yValue);
    const conditionValue = d.condition == null || d.condition === "" ? "N/A" : String(d.condition);
    const experimentHref = encodeURIComponent(experimentValue);
    const experimentLabel = escapeHtml(experimentValue);
    const conditionLabel = escapeHtml(conditionValue);

    return `
        <div class="tooltip-container">
            Experiment: <a href="/experiment/${experimentHref}" target="_blank" rel="noopener noreferrer" class="tooltip-link"><strong>${experimentLabel}</strong></a><br />
            Condition: <strong class="tooltip-highlight">${conditionLabel}</strong><br />
            LiP Score: <strong>${d.score.toFixed(2)}</strong>
        </div>`;
};

const buildHeatmapRows = (differentialAbundanceData, experimentMetaData = []) => {
    const experimentMetaDataMap = new Map();
    experimentMetaData.forEach((meta) => {
        experimentMetaDataMap.set(meta.dpx_comparison, meta);
    });

    return Object.entries(differentialAbundanceData).map(([key, values]) => {
        const metaData = experimentMetaDataMap.get(key);

        return {
            yValue: key,
            condition: metaData ? metaData.condition : "N/A",
            cells: values.map(value => ({
                yValue: key,
                xValue: value.index + 1,
                score: value.score == null ? null : value.score,
                condition: metaData ? metaData.condition : "N/A",
            })),
        };
    });
};

const createHeatmapDataset = (rows, sequenceLength) => ({
    xDomain: Array.from({ length: sequenceLength }, (_, index) => index + 1),
    yDomain: rows.map(({ yValue }) => yValue),
    dataHeatmap: rows.flatMap((row) => {
        const cellsByPosition = new Map(row.cells.map((cell) => [cell.xValue, cell]));

        return Array.from({ length: sequenceLength }, (_, index) => {
            const xValue = index + 1;
            const cell = cellsByPosition.get(xValue);

            if (cell) {
                return cell;
            }

            return {
                xValue,
                yValue: row.yValue,
                score: null,
                condition: row.condition,
                missingCoverageDataset: true,
            };
        });
    }),
});

const getFiniteNumber = (value, fallback = 0) => {
    if (value == null || value === '') {
        return fallback;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getTrackNumericValue = (trackElement, name, fallback = 0) => {
    const propertyValue = trackElement?.[name];
    if (propertyValue != null && Number.isFinite(Number(propertyValue))) {
        return Number(propertyValue);
    }

    return getFiniteNumber(trackElement?.getAttribute?.(name), fallback);
};

const getTrackSvgRect = (trackElement) => {
    const svgElement = trackElement?.shadowRoot?.querySelector?.('svg')
        || trackElement?.querySelector?.('svg');
    const svgRect = svgElement?.getBoundingClientRect?.();

    if (svgRect?.width) {
        return svgRect;
    }

    return trackElement?.getBoundingClientRect?.();
};

const getSequencePositionForTrackEvent = (event, trackElement) => {
    if (!trackElement || !Number.isFinite(event?.clientX)) {
        return null;
    }

    const rect = getTrackSvgRect(trackElement);
    if (!rect?.width) {
        return null;
    }

    const marginLeft = getTrackNumericValue(trackElement, "margin-left", 0);
    const marginRight = getTrackNumericValue(trackElement, "margin-right", 0);
    const sequenceWidth = rect.width - marginLeft - marginRight;
    const sequenceX = event.clientX - rect.left - marginLeft;

    if (sequenceWidth <= 0 || sequenceX < 0 || sequenceX >= sequenceWidth) {
        return null;
    }

    if (typeof trackElement.xScale?.invert === "function") {
        const scaledPosition = Math.floor(trackElement.xScale.invert(sequenceX));
        return Number.isFinite(scaledPosition) ? scaledPosition : null;
    }

    const length = getTrackNumericValue(trackElement, "length", 0);
    const displayStart = getTrackNumericValue(trackElement, "display-start", 1);
    const rawDisplayEnd = getTrackNumericValue(trackElement, "display-end", length);
    const displayEnd = rawDisplayEnd > 0 ? rawDisplayEnd : length;

    if (displayEnd < displayStart) {
        return null;
    }

    return Math.floor(displayStart + (sequenceX / sequenceWidth) * (displayEnd + 1 - displayStart));
};

const getHeatmapCanvasRect = (heatmapElement) => {
    const canvasElement = heatmapElement?.shadowRoot?.querySelector?.('canvas')
        || heatmapElement?.querySelector?.('canvas');
    const canvasRect = canvasElement?.getBoundingClientRect?.();

    if (canvasRect?.width) {
        return canvasRect;
    }

    return heatmapElement?.getBoundingClientRect?.();
};

const getSequencePositionForHeatmapEvent = (event, heatmapElement) => {
    if (!heatmapElement || !Number.isFinite(event?.clientX)) {
        return null;
    }

    const rect = getHeatmapCanvasRect(heatmapElement);
    if (!rect?.width) {
        return null;
    }

    const marginLeft = getTrackNumericValue(heatmapElement, "margin-left", 0);
    const marginRight = getTrackNumericValue(heatmapElement, "margin-right", 0);
    const sequenceWidth = rect.width - marginLeft - marginRight;
    const sequenceX = event.clientX - rect.left - marginLeft;

    if (sequenceWidth <= 0 || sequenceX < 0 || sequenceX >= sequenceWidth) {
        return null;
    }

    const length = getTrackNumericValue(heatmapElement, "length", 0);
    const displayStart = getTrackNumericValue(heatmapElement, "display-start", 1);
    const rawDisplayEnd = getTrackNumericValue(heatmapElement, "display-end", length);
    const displayEnd = rawDisplayEnd > 0 ? rawDisplayEnd : length;

    if (displayEnd < displayStart) {
        return null;
    }

    return Math.floor(displayStart + (sequenceX / sequenceWidth) * (displayEnd + 1 - displayStart));
};

const applyExactTrackBaseWidth = (trackElement) => {
    if (!trackElement || trackElement.__dspaExactTrackBaseWidth) {
        return;
    }

    trackElement.getSingleBaseWidth = function getExactTrackBaseWidth() {
        if (!this.xScale) {
            return -1;
        }

        const baseWidth = this.xScale(2) - this.xScale(1);
        return Number.isFinite(baseWidth) ? baseWidth : -1;
    };

    trackElement.__dspaExactTrackBaseWidth = true;
};

const refreshNightingaleDimensions = (element) => {
    if (typeof element?.onDimensionsChange === "function") {
        element.onDimensionsChange();
    }
};


const TOOLTIP_VIEWPORT_MARGIN = 12;

const clampHeatmapTooltipsToViewport = (heatmapElement) => {
    const root = heatmapElement?.shadowRoot;
    if (!root || typeof window === 'undefined') {
        return;
    }

    root.querySelectorAll('.heatmap-tooltip-box, .heatmap-pinned-tooltip-box').forEach((tooltip) => {
        const rect = tooltip.getBoundingClientRect();
        if (!rect.width && !rect.height) {
            return;
        }

        let left = parseFloat(tooltip.style.left || '0');
        if (!Number.isFinite(left)) {
            left = 0;
        }

        const rightOverflow = rect.right - (window.innerWidth - TOOLTIP_VIEWPORT_MARGIN);
        const leftOverflow = TOOLTIP_VIEWPORT_MARGIN - rect.left;

        if (rightOverflow > 0) {
            tooltip.style.left = `${Math.max(0, left - rightOverflow)}px`;
        } else if (leftOverflow > 0) {
            tooltip.style.left = `${left + leftOverflow}px`;
        }
    });
};

const attachHeatmapTooltipViewportGuard = (heatmapElement) => {
    const root = heatmapElement?.shadowRoot;
    if (!root || heatmapElement.__dspaTooltipViewportGuardAttached) {
        return;
    }

    const clampAfterTooltipUpdate = () => {
        requestAnimationFrame(() => clampHeatmapTooltipsToViewport(heatmapElement));
    };

    root.addEventListener('mousemove', clampAfterTooltipUpdate);
    root.addEventListener('click', clampAfterTooltipUpdate);
    heatmapElement.__dspaTooltipViewportGuardAttached = true;
};
const isDisplayRangeChangeDetail = (detail) => (
    typeof detail === 'object' &&
    detail !== null &&
    (
        detail.type === 'display-start' ||
        detail.type === 'display-end' ||
        Object.prototype.hasOwnProperty.call(detail, 'display-start') ||
        Object.prototype.hasOwnProperty.call(detail, 'display-end')
    )
);

const syncHeatmapWidthToHost = (heatmapElement) => {
    if (!heatmapElement) {
        return;
    }

    const hostWidth = Math.round(heatmapElement.getBoundingClientRect?.().width || heatmapElement.offsetWidth || 0);
    if (hostWidth > 0 && Number(heatmapElement.width) !== hostWidth) {
        heatmapElement.width = hostWidth;
        if (typeof heatmapElement.requestUpdate === 'function') {
            heatmapElement.requestUpdate('width');
        }
    }
};

const allowHeatmapRangePropagation = (heatmapElement) => {
    if (!heatmapElement) {
        return;
    }

    heatmapElement.__dspaPropagateRangeEvents = true;
    if (heatmapElement.__dspaPropagateRangeEventsTimer) {
        clearTimeout(heatmapElement.__dspaPropagateRangeEventsTimer);
    }
    heatmapElement.__dspaPropagateRangeEventsTimer = setTimeout(() => {
        heatmapElement.__dspaPropagateRangeEvents = false;
        heatmapElement.__dspaPropagateRangeEventsTimer = null;
    }, 1000);
};

const applyHeatmapDataset = (heatmapElement, dataset) => {
    if (
        !heatmapElement ||
        dataset.yDomain.length === 0 ||
        !heatmapElement.setHeatmapData
    ) {
        return;
    }

    syncHeatmapWidthToHost(heatmapElement);
    heatmapElement.setHeatmapData(dataset.xDomain, dataset.yDomain, dataset.dataHeatmap);

    requestAnimationFrame(() => {
        if (!heatmapElement?.heatmapInstance) {
            return;
        }

        syncHeatmapWidthToHost(heatmapElement);
        heatmapElement.heatmapInstance.setColor((d) => getLipScoreColor(d.score));
        heatmapElement.heatmapInstance.setTooltip((d) => getHeatmapTooltip(d));
        attachHeatmapTooltipViewportGuard(heatmapElement);
        clampHeatmapTooltipsToViewport(heatmapElement);

        if (typeof heatmapElement.heatmapInstance.state?.emitResize === "function") {
            heatmapElement.heatmapInstance.state.emitResize();
        }

        if (typeof heatmapElement.applyZoomTranslation === "function") {
            heatmapElement.applyZoomTranslation();
        }
    });
};

const RELAY_EVENT_MARKER = '__dspaRelayedHeatmapEvent';

const dispatchHeatmapHoverHighlightEvent = (event, heatmapElement) => {
    const position = getSequencePositionForHeatmapEvent(event, heatmapElement);
    if (position == null) {
        return null;
    }

    const highlight = `${position}:${position}`;
    if (heatmapElement.__dspaLastHoverHighlight === highlight) {
        return highlight;
    }

    heatmapElement.__dspaLastHoverHighlight = highlight;
    const managerElement = heatmapElement.closest('nightingale-manager') || document.querySelector('nightingale-manager');
    if (!managerElement) {
        return highlight;
    }

    managerElement.dispatchEvent(new CustomEvent('change', {
        detail: {
            eventType: 'mouseover',
            feature: { position },
            highlight,
            parentEvent: event,
            [RELAY_EVENT_MARKER]: true,
        },
        bubbles: true,
        composed: true,
    }));

    return highlight;
};

const relayHeatmapHighlightEvent = (event, sourceElement) => {
    if (!sourceElement || event?.detail?.[RELAY_EVENT_MARKER]) {
        return;
    }

    const detail = event?.detail;
    if (detail == null) {
        return;
    }

    if (isDisplayRangeChangeDetail(detail)) {
        return;
    }

    const relayDetail = typeof detail === 'object' && detail !== null
        ? { ...detail, [RELAY_EVENT_MARKER]: true }
        : { value: detail, [RELAY_EVENT_MARKER]: true };

    const managerElement = sourceElement.closest('nightingale-manager') || document.querySelector('nightingale-manager');
    if (!managerElement) {
        return;
    }

    managerElement.dispatchEvent(new CustomEvent('change', {
        detail: relayDetail,
        bubbles: true,
        composed: true,
    }));
};

const NightingaleComponent = ({
    proteinData, 
    pdbIds, 
    selectedPdbId, 
    setSelectedPdbId, 
    showHeatmap = true,
    passedExperimentIDs,
    containerRef,
    masterCondition
}) => {

    const getDefaultTooltipContent = (feature) => (
        feature.description || feature.type.replace(/_/g, ' ').toLowerCase()
    );

    const sequenceRef = useRef(null);
    const navigationRef = useRef(null);
    const domainRef = useRef(null);
    const bindingRef = useRef(null);
    const activeSiteRef = useRef(null);
    const metalRef = useRef(null);
    const modifiedResidueRef = useRef(null);
    const disulfidRef = useRef(null);
    const betastrandRef = useRef(null);
    const alphaHelixRef = useRef(null);
    const turnRef = useRef(null);
    const coiledCoilRef = useRef(null);
    const siteRef = useRef(null);
    const structureRef = useRef(null);

    const [mappedFeatures, setMappedFeatures] = useState([]);

    const residuelevelContainer = useRef(null);
    const multipleExperimentsContainer = useRef(null);
    const scoreBarcodeContainer = useRef(null);
    const matchingScoreBarcodeContainer = useRef(null);
    const otherScoreBarcodeContainer = useRef(null);
    
    const [selectedExperiment, setSelectedExperiment] = useState('');
    const availableExperimentIds = useMemo(
        () => proteinData.lipscoreList?.map(entry => entry.experimentID) || [],
        [proteinData.lipscoreList]
    );
    const experimentIDsList = useMemo(() => {
        if (passedExperimentIDs?.length > 0) {
            const filteredExperimentIds = passedExperimentIDs.filter((experimentID) => (
                availableExperimentIds.includes(experimentID)
            ));

            if (filteredExperimentIds.length > 0) {
                return filteredExperimentIds;
            }
        }

        if (proteinData.experimentIDsList.length > 0) {
            return proteinData.experimentIDsList;
        }

        return availableExperimentIds;
    }, [availableExperimentIds, passedExperimentIDs, proteinData.experimentIDsList]);

    const experimentIDToMeta = useMemo(() => {
        const mapping = {};
        if (proteinData.experimentMetaData) {
            proteinData.experimentMetaData.forEach(meta => {
                mapping[meta.dpx_comparison] = {
                    condition: meta.condition,
                    dose: meta.dose
                };
            });
        }
        return mapping;
    }, [proteinData.experimentMetaData]);

    const [trackHeight, setTrackHeight] = useState(null);
    const lastLayoutHeightsRef = useRef({ structureHeight: null, trackHeight: null });


    const sequenceLength = proteinData.proteinSequence.length;
    const featureSequence = proteinData.featuresData?.sequence || proteinData.proteinSequence || '';
    const featureSequenceLength = featureSequence.length || sequenceLength;
    const trackAttributes = useMemo(() => ({
        ...defaultAttributes,
        length: featureSequenceLength,
        height: trackHeight || defaultAttributes.height,
        "display-end": featureSequenceLength,
    }), [featureSequenceLength, trackHeight]);
    const defaultLipScoreString = JSON.stringify(Array(sequenceLength).fill(null));
    const [lipscoreString, setLipscoreString] = useState(defaultLipScoreString);

    const proteinName = proteinData.proteinName;
    const shouldSplitHeatmap = Boolean(masterCondition);
    const heatmapRows = useMemo(() => buildHeatmapRows(
        proteinData.differentialAbundanceData,
        proteinData.experimentMetaData
    ), [proteinData.differentialAbundanceData, proteinData.experimentMetaData]);
    const matchingHeatmapRows = useMemo(() => (
        shouldSplitHeatmap
            ? heatmapRows.filter(({ condition }) => condition === masterCondition)
            : []
    ), [heatmapRows, masterCondition, shouldSplitHeatmap]);
    const otherHeatmapRows = useMemo(() => (
        shouldSplitHeatmap
            ? heatmapRows.filter(({ condition }) => condition !== masterCondition)
            : []
    ), [heatmapRows, masterCondition, shouldSplitHeatmap]);
    const defaultHeatmapDataset = useMemo(
        () => createHeatmapDataset(heatmapRows, sequenceLength),
        [heatmapRows, sequenceLength]
    );
    const matchingHeatmapDataset = useMemo(
        () => createHeatmapDataset(matchingHeatmapRows, sequenceLength),
        [matchingHeatmapRows, sequenceLength]
    );
    const otherHeatmapDataset = useMemo(
        () => createHeatmapDataset(otherHeatmapRows, sequenceLength),
        [otherHeatmapRows, sequenceLength]
    );
 
    const hasDomainData = proteinData.featuresData?.features?.some(({ type }) => type === "DOMAIN");
    const hasSiteData = proteinData.featuresData.features.some(({ type }) => type === "SITE");
    const hasBindingData = proteinData.featuresData.features.some(({ type }) => type === "BINDING");
    const hasActiveSiteData = proteinData.featuresData.features.some(({ type }) => type === "ACT_SITE");
    const hasMetalData = proteinData.featuresData.features.some(({ type }) => type === "METAL");
    const hasModifiedResidueData = proteinData.featuresData.features.some(({ type }) => type === "MOD_RES");
    const hasDisulfidData = proteinData.featuresData.features.some(({ type }) => type === "DISULFID");
    const hasBetaStrandData = proteinData.featuresData.features.some(({ type }) => type === "STRAND");
    const hasAlphaHelixData = proteinData.featuresData.features.some(({ type }) => type === "HELIX");
    const hasTurnData = proteinData.featuresData.features.some(({ type }) => type === "TURN");
    const hasCoiledCoilData = proteinData.featuresData.features.some(({ type }) => type === "COILED");

    const visibleTracks = [
        hasDomainData && "domain",
        hasBindingData && "binding",
        hasActiveSiteData && "act_site",
        hasMetalData && "metal",
        hasModifiedResidueData && "mod_res",
        hasSiteData && "site",
        hasDisulfidData && "disulfid",
        hasAlphaHelixData && "helix",
        hasTurnData && "turn",
        hasBetaStrandData && "strand",
        hasCoiledCoilData && "coiled",
        showHeatmap && "heatmap"
    ].filter(Boolean);



    useEffect(() => {
        let rafId = null;

        const updateHeight = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                const layoutContainer = containerRef?.current?.parentElement;
                const containerRect = layoutContainer?.getBoundingClientRect();
                const baseHeight = containerRect?.height || window.innerHeight;
                const structureHeight = baseHeight * 0.4;
                const lastHeights = lastLayoutHeightsRef.current;
                
                if (structureRef.current && lastHeights.structureHeight !== structureHeight) {
                    structureRef.current.style.setProperty('--custom-structure-height', `${structureHeight}px`);
                    lastHeights.structureHeight = structureHeight;
                }
                
                const tracks_len = visibleTracks.length + 2;
                const availableTrackHeight = structureHeight;
                const dynamicTrackHeight = Math.min(Math.max(
                    availableTrackHeight / (tracks_len || 1),
                    20
                ), 30);
                
                if (lastHeights.trackHeight !== dynamicTrackHeight) {
                    lastHeights.trackHeight = dynamicTrackHeight;
                    setTrackHeight(dynamicTrackHeight);
                }
            });
        };

        const handleTouchStart = () => {
            updateHeight();
        };

        window.addEventListener("resize", updateHeight);
        window.addEventListener("touchstart", handleTouchStart, { passive: true });
        updateHeight();

        return () => {
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", updateHeight);
            window.removeEventListener("touchstart", handleTouchStart);
        };
    }, [visibleTracks.length, containerRef]);
     
    const checkDimensions = (element) => {
        if (element) {
            if ('offsetWidth' in element && 'offsetHeight' in element) {
                return element.offsetWidth > 0 && element.offsetHeight > 0;
            }
        }
        return false;
    };
    
    const getLipScoreDataByExperimentID = React.useCallback((experimentID) => {
        if (!proteinData || !proteinData.lipscoreList) return null;
        const lipScoreEntry = proteinData.lipscoreList.find(entry => entry.experimentID === experimentID);
        return lipScoreEntry ? lipScoreEntry.data : null;
    }, [proteinData]);

    const handleExperimentClick = (experimentID,index) => {
        if (experimentID === selectedExperiment) {
            return;
        }

        const lipScoreArray = getLipScoreDataByExperimentID(experimentID);
        setSelectedExperiment(experimentID);
        setLipscoreString(JSON.stringify(lipScoreArray || Array(sequenceLength).fill(null)));
    };

    useEffect(() => {
        if (!experimentIDsList || experimentIDsList.length === 0) {
            setSelectedExperiment('');
            setLipscoreString(defaultLipScoreString);
            return;
        }

        const nextExperimentId = experimentIDsList.includes(selectedExperiment)
            ? selectedExperiment
            : experimentIDsList[0];
        const lipScoreArray = getLipScoreDataByExperimentID(nextExperimentId);

        setSelectedExperiment(nextExperimentId);
        setLipscoreString(JSON.stringify(lipScoreArray || Array(sequenceLength).fill(null)));
    }, [
        defaultLipScoreString,
        experimentIDsList,
        getLipScoreDataByExperimentID,
        selectedExperiment,
        sequenceLength,
    ]);

    useEffect(() => {
        if (proteinData?.featuresData?.features && trackHeight) {
            setMappedFeatures(proteinData.featuresData.features.map(ft => ({
                ...ft,
                start: ft.start || ft.begin
            })));
        }
    }, [proteinData, trackHeight]);

    useEffect(() => {
        if (!trackHeight || !featureSequence || !sequenceRef.current) {
            return;
        }

        const tooltip = document.getElementById("tooltip");
        if (!tooltip) {
              console.error("Tooltip element not found!");
              return;
          }
        
        const updateTooltip = (content, x, y) => {
            // Safely set text content to prevent XSS
            tooltip.textContent = content;
            tooltip.style.top = `${y + 10}px`;
            tooltip.style.left = `${x + 10}px`;
            tooltip.style.visibility = "visible";
        };

        const hideTooltip = () => {
            tooltip.style.visibility = "hidden";
        };

        const eventListeners = [];

        const updateElementAttributes = (ref, id, { refreshDimensions = false } = {}) => {
            if (ref.current) {
                ref.current.setAttribute("id", id);
                Object.keys(trackAttributes).forEach(key => {
                    ref.current.setAttribute(key, trackAttributes[key]);
                });

                if (refreshDimensions) {
                    refreshNightingaleDimensions(ref.current);
                }
                
                ref.current.addEventListener('customEvent', handleCustomEvent);
                eventListeners.push({ element: ref.current, type: 'customEvent', listener: handleCustomEvent });
            }
        };

        const updateTracks = () => {
            const tracks = [
                { id: "domain", ref: domainRef },
                { id: "site", ref: siteRef },
                { id: "binding", ref: bindingRef },
                { id: "act_site", ref: activeSiteRef },
                { id: "metal", ref: metalRef },
                { id: "mod_res", ref: modifiedResidueRef },
                { id: "disulfid", ref: disulfidRef },
                { id: "helix", ref: alphaHelixRef },
                { id: "turn", ref: turnRef },
                { id: "strand", ref: betastrandRef },
                { id: "coiled", ref: coiledCoilRef }
            ];

            tracks.forEach(({ id, ref }) => {
                const trackElement = ref.current;
                if (trackElement) {
                    applyExactTrackBaseWidth(trackElement);

                    let trackFeatures = mappedFeatures.filter(({ type }) => type.toUpperCase() === id.toUpperCase());
                
                    if (id.toUpperCase() === "BINDING") {
                        trackFeatures = trackFeatures.map(feature => {
                            if (feature.type.toUpperCase() === "BINDING" && feature.ligand && feature.ligand.name) {
                                return { ...feature, tooltipContent: feature.ligand.name };
                            }
                            if (!feature.tooltipContent) {
                                return { ...feature, tooltipContent: getDefaultTooltipContent(feature) };
                            }
                            return feature;
                        });
                    } else{
                        trackFeatures = trackFeatures.map(feature => {
                            return { ...feature, tooltipContent: getDefaultTooltipContent(feature) };
                        });

                    }
                    trackElement.data = trackFeatures;

                    const mouseMoveHandler = (event) => {
                        const position = getSequencePositionForTrackEvent(event, trackElement);
                        if (position == null) {
                            hideTooltip();
                            return;
                        }
    
                        // Find the closest feature to this position
                        const feature = trackFeatures.find(f => f.start <= position && f.end >= position);
                        if (feature) {
                            updateTooltip(feature.tooltipContent, event.pageX, event.pageY);
                        } else {
                            hideTooltip();
                        }
                    };

                    trackElement.addEventListener("mousemove", mouseMoveHandler);
                    eventListeners.push({ element: trackElement, type: 'mousemove', listener: mouseMoveHandler });

                    trackElement.addEventListener("mouseleave", hideTooltip);
                    eventListeners.push({ element: trackElement, type: 'mouseleave', listener: hideTooltip });
                }
            });
        };
        
        updateElementAttributes(navigationRef, "navigation", { refreshDimensions: true });
        updateElementAttributes(domainRef, "domain");
        updateElementAttributes(bindingRef, "binding");
        updateElementAttributes(activeSiteRef, "act_site");
        updateElementAttributes(metalRef, "metal");
        updateElementAttributes(modifiedResidueRef, "mod_res");
        updateElementAttributes(disulfidRef, "disulfid");
        updateElementAttributes(alphaHelixRef, "helix");
        updateElementAttributes(turnRef, "turn");
        updateElementAttributes(betastrandRef, "strand");
        updateElementAttributes(coiledCoilRef, "coiled");
        updateElementAttributes(siteRef, "site");

        const attributes = {
            ...trackAttributes,
            sequence: featureSequence,
            id: "sequence",
        };
    
        Object.keys(attributes).forEach(key => {
            sequenceRef.current.setAttribute(key, attributes[key]);
        });
    
        updateTracks();

        return () => {
            eventListeners.forEach(({ element, type, listener }) => {
                element.removeEventListener(type, listener);
            });
        };
    }, [mappedFeatures, trackHeight, featureSequence, trackAttributes]);


    const handleCustomEvent = (e) => {
        return e;
      };

    useEffect(() => {
        if (!proteinName || !selectedPdbId) {
            return;
        }

        if (structureRef.current) {
            structureRef.current.setAttribute('protein-accession', proteinName);
            structureRef.current.setAttribute('structure-id', selectedPdbId);
            structureRef.current.setAttribute('highlight-color', '#FF6699');
            structureRef.current.setAttribute('lipscore-array',  lipscoreString);
            }
    }, [ proteinName, selectedPdbId, lipscoreString]);

    useEffect(() => {
        customElements.whenDefined("nightingale-colored-sequence").then(() => {
            if (residuelevelContainer.current && checkDimensions(residuelevelContainer.current)) {
                residuelevelContainer.current.data = proteinData.barcodeSequence;
            }
        });
    }, [proteinData.barcodeSequence]);

    useEffect(() => {
        customElements.whenDefined("nightingale-msa").then(() => {
            if (multipleExperimentsContainer.current && checkDimensions(multipleExperimentsContainer.current)) {
                const data = Object.keys(proteinData.barcodeSequence).map((key, index) => ({
                    name: key,
                    sequence: proteinData.barcodeSequence[key]
                }));
                multipleExperimentsContainer.current.data = data;
            }
        });
    }, [proteinData.barcodeSequence]);

    useEffect(() => {
        customElements.whenDefined("nightingale-sequence-heatmap").then(() => {
            const heatmapConfigurations = shouldSplitHeatmap
                ? [
                    {
                        ref: matchingScoreBarcodeContainer,
                        dataset: matchingHeatmapDataset,
                    },
                    {
                        ref: otherScoreBarcodeContainer,
                        dataset: otherHeatmapDataset,
                    },
                ]
                : [
                    {
                        ref: scoreBarcodeContainer,
                        dataset: defaultHeatmapDataset,
                    },
                ];

            heatmapConfigurations.forEach(({ ref, dataset }) => {
                if (ref.current && checkDimensions(ref.current)) {
                    applyHeatmapDataset(ref.current, dataset);
                }
            });
        });
    }, [
        shouldSplitHeatmap,
        defaultHeatmapDataset,
        matchingHeatmapDataset,
        otherHeatmapDataset,
    ]);

    useEffect(() => {
        if (!showHeatmap) {
            return undefined;
        }

        let isCancelled = false;
        let resizeObserver = null;
        let resizeHandler = null;
        const cleanupCallbacks = [];

        customElements.whenDefined("nightingale-sequence-heatmap").then(() => {
            if (isCancelled) {
                return;
            }

            const heatmapConfigurations = shouldSplitHeatmap
                ? [
                    {
                        ref: matchingScoreBarcodeContainer,
                        dataset: matchingHeatmapDataset,
                    },
                    {
                        ref: otherScoreBarcodeContainer,
                        dataset: otherHeatmapDataset,
                    },
                ]
                : [
                    {
                        ref: scoreBarcodeContainer,
                        dataset: defaultHeatmapDataset,
                    },
                ];

            heatmapConfigurations.forEach(({ ref }) => {
                const heatmapElement = ref.current;
                if (!heatmapElement) {
                    return;
                }

                const handleHeatmapWheel = () => {
                    allowHeatmapRangePropagation(heatmapElement);
                };

                const handleHeatmapHighlightChange = (event) => {
                    if (isDisplayRangeChangeDetail(event.detail)) {
                        if (!heatmapElement.__dspaPropagateRangeEvents) {
                            event.stopPropagation();
                        }
                        return;
                    }

                    relayHeatmapHighlightEvent(event, heatmapElement);
                };
                const handleHeatmapMouseMove = (event) => {
                    dispatchHeatmapHoverHighlightEvent(event, heatmapElement);
                };
                const handleHeatmapMouseLeave = () => {
                    heatmapElement.__dspaLastHoverHighlight = null;
                };

                heatmapElement.addEventListener('wheel', handleHeatmapWheel, true);
                heatmapElement.addEventListener('change', handleHeatmapHighlightChange);
                heatmapElement.addEventListener('mousemove', handleHeatmapMouseMove);
                heatmapElement.addEventListener('mouseleave', handleHeatmapMouseLeave);
                cleanupCallbacks.push(() => {
                    heatmapElement.removeEventListener('wheel', handleHeatmapWheel, true);
                    heatmapElement.removeEventListener('change', handleHeatmapHighlightChange);
                    heatmapElement.removeEventListener('mousemove', handleHeatmapMouseMove);
                    heatmapElement.removeEventListener('mouseleave', handleHeatmapMouseLeave);
                    if (heatmapElement.__dspaPropagateRangeEventsTimer) {
                        clearTimeout(heatmapElement.__dspaPropagateRangeEventsTimer);
                        heatmapElement.__dspaPropagateRangeEventsTimer = null;
                    }
                });
            });

            const handleResize = () => {
                heatmapConfigurations.forEach(({ ref, dataset }) => {
                    if (ref.current && checkDimensions(ref.current)) {
                        applyHeatmapDataset(ref.current, dataset);
                    }
                });
            };
            resizeHandler = handleResize;

            resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(handleResize);
            });

            heatmapConfigurations.forEach(({ ref }) => {
                if (ref.current) {
                    resizeObserver.observe(ref.current);
                }
            });

            window.addEventListener("resize", handleResize);
        });

        return () => {
            isCancelled = true;
            cleanupCallbacks.forEach((cleanup) => cleanup());
            if (resizeHandler) {
                window.removeEventListener("resize", resizeHandler);
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [
        showHeatmap,
        shouldSplitHeatmap,
        defaultHeatmapDataset,
        matchingHeatmapDataset,
        otherHeatmapDataset,
    ]);

    // Toggle tick visibility: hide ticks when sequence letters are visible, show when hidden
    useEffect(() => {
        const seqEl = sequenceRef.current;
        if (!seqEl) return;

        const updateTickVisibility = () => {
            const svg = seqEl.shadowRoot
                ? seqEl.shadowRoot.querySelector('svg')
                : seqEl.querySelector('svg');
            if (!svg) return;
            const hasLetters = svg.querySelectorAll('text.base').length > 0;
            svg.querySelectorAll('.tick text').forEach(tick => {
                tick.style.visibility = hasLetters ? 'hidden' : 'visible';
            });
        };

        const observer = new MutationObserver(updateTickVisibility);
        const startObserving = () => {
            const svg = seqEl.shadowRoot
                ? seqEl.shadowRoot.querySelector('svg')
                : seqEl.querySelector('svg');
            if (svg) {
                observer.observe(svg, { childList: true, subtree: true });
                updateTickVisibility();
            } else {
                requestAnimationFrame(startObserving);
            }
        };
        startObserving();

        return () => observer.disconnect();
    }, [mappedFeatures]);

    // Legend derived from the shared LIP_COLOR_SCALE (reversed so lowest scores appear first)
    const legendData = [...LIP_COLOR_SCALE].reverse().map(({ color, label }) => ({ color, label }));
    const wrappedHeatmapLabelStyle = {
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
    };

    return (
        <div  id="nightingale-manager-container">
            <p style={{ textAlign: 'center' }}>{proteinData?.proteinDescription}</p>
            <div>

                <div className="volcano-plot-legend">
                    {legendData.map((item, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                            <div
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: item.color === 'default' ? 'transparent' : item.color,
                                    border: item.color === 'default' ? '1px solid #000' : 'none',
                                    marginRight: '5px',
                                }}
                            ></div>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
                {experimentIDsList.length > 5 ? (
                    <div className="experiment-dropdown">
                        <label htmlFor="experiment-dropdown">Color structure according to experiment:</label>
                        <select
                            id="experiment-dropdown"
                            value={selectedExperiment}
                            onChange={(event) => handleExperimentClick(event.target.value)}
                        >
                            <option value="">None</option>
                            {experimentIDsList.map((experimentID) => {
                                const meta = experimentIDToMeta[experimentID];
                                const label = meta
                                    ? (meta.dose || `Experiment ${experimentID}`)
                                    : `Experiment ${experimentID}`;
                                return (
                                    <option key={experimentID} value={experimentID} title={`Experiment ${experimentID}`}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                ) : (
                    <div className="experiment-buttons">
                        {experimentIDsList.map((experimentID, index) => {
                            const meta = experimentIDToMeta[experimentID];
                            const label = meta
                                ? (meta.dose || `Experiment ${experimentID}`)
                                : `Experiment ${experimentID}`;
                            return (
                                <button
                                    key={experimentID}
                                    className={`experiment-button ${selectedExperiment === experimentID ? "selected" : ""}`}
                                    onClick={() => handleExperimentClick(experimentID, index)}
                                    title={`Experiment ${experimentID}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Nightingale Manager with Table of Tracks */}
            <nightingale-manager>
                <div id="tooltip" className="tooltip"></div>
                <div style={{ width: '100%', overflow: 'hidden' }}>
                    <nightingale-structure ref={structureRef} style={{ display: 'block', width: '100%' }} />
                </div>
                <table style={{ width: '100%', tableLayout: 'fixed' }}>
                    <tbody>
                    <tr >
                        <td style={{ width: '150px' }}></td>
                        <td style={{ width: '100%', overflow: 'visible' }}>
                            <style>{`nightingale-navigation .start-label, .end-label { visibility: hidden; }`}</style>
                            <nightingale-navigation ref={navigationRef} id="navigation" {...trackAttributes}/>
                        </td>
                    </tr>

                    <tr>
                        <td >Sequence</td>
                        <td style={{ width: '100%', overflow: 'visible' }}>
                            <nightingale-sequence
                                ref={sequenceRef}
                                id="sequence"
                                sequence={featureSequence}
                                {...trackAttributes}
                                style={{ display: 'block', width: '100%' }}
                            />
                        </td>
                    </tr>

                    {showHeatmap && shouldSplitHeatmap && (
                        <>
                            <tr>
                                <td style={wrappedHeatmapLabelStyle}>
                                    Structural-Barcode
                                    <br />
                                    ({masterCondition})
                                </td>
                                <td style={{ width: '100%', overflow: 'visible' }}>
                                    {matchingHeatmapRows.length > 0 ? (
                                        <nightingale-sequence-heatmap
                                            ref={matchingScoreBarcodeContainer}
                                            heatmap-id="seq-heatmap-matching"
                                            min-width={heatmapAttributes["min-width"]}
                                            length={sequenceLength}
                                            height="100"
                                            display-start="1"
                                            display-end={sequenceLength}
                                            highlight-event="onmouseover"
                                            margin-left={heatmapAttributes["margin-left"]}
                                            margin-right={heatmapAttributes["margin-right"]}
                                            margin-color={heatmapAttributes["margin-color"]}
                                            style={{ display: 'block', width: '100%' }}
                                        />
                                    ) : (
                                        <div>No experiment rows match this condition.</div>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td style={wrappedHeatmapLabelStyle}>
                                    Structural-Barcode
                                    <br />
                                    (other conditions)
                                </td>
                                <td style={{ width: '100%', overflow: 'visible' }}>
                                    {otherHeatmapRows.length > 0 ? (
                                        <nightingale-sequence-heatmap
                                            ref={otherScoreBarcodeContainer}
                                            heatmap-id="seq-heatmap-other"
                                            min-width={heatmapAttributes["min-width"]}
                                            length={sequenceLength}
                                            height="100"
                                            display-start="1"
                                            display-end={sequenceLength}
                                            highlight-event="onmouseover"
                                            margin-left={heatmapAttributes["margin-left"]}
                                            margin-right={heatmapAttributes["margin-right"]}
                                            margin-color={heatmapAttributes["margin-color"]}
                                            style={{ display: 'block', width: '100%' }}
                                        />
                                    ) : (
                                        <div>No experiment rows from other conditions.</div>
                                    )}
                                </td>
                            </tr>
                        </>
                    )}

                    {showHeatmap && !shouldSplitHeatmap && (
                        <tr>
                            <td >Structural-Barcode</td>
                            <td style={{ width: '100%', overflow: 'visible' }}>
                                <nightingale-sequence-heatmap
                                    ref={scoreBarcodeContainer}
                                    heatmap-id="seq-heatmap"
                                    min-width={heatmapAttributes["min-width"]}
                                    length={sequenceLength}
                                    height="100"
                                    display-start="1"
                                    display-end={sequenceLength}
                                    highlight-event="onmouseover"
                                    margin-left={heatmapAttributes["margin-left"]}
                                    margin-right={heatmapAttributes["margin-right"]}
                                    margin-color={heatmapAttributes["margin-color"]}
                                    style={{ display: 'block', width: '100%' }}
                                />
                            </td>
                        </tr>
                    )}

                        {hasDomainData && (
                            <tr >
                                <td>Domain</td>
                                <td><nightingale-track ref={domainRef} id="domain" {...trackAttributes} /></td>
                            </tr>
                        )}

                        {hasBindingData && (
                            <tr >
                                <td>Binding site</td>
                                <td><nightingale-track ref={bindingRef} id="binding" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasActiveSiteData && (
                            <tr>
                                <td>Active site</td>
                                <td><nightingale-track ref={activeSiteRef} id="act_site" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasMetalData && (
                            <tr>
                                <td>Metal binding</td>
                                <td><nightingale-track ref={metalRef} id="metal" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasModifiedResidueData && (
                            <tr>
                                <td>Modified residue</td>
                                <td><nightingale-track ref={modifiedResidueRef} id="mod_res" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasDisulfidData && (
                            <tr>
                                <td>Disulfide bond</td>
                                <td><nightingale-track ref={disulfidRef} id="disulfid" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasAlphaHelixData && (
                            <tr>
                                <td>Alpha helix</td>
                                <td><nightingale-track ref={alphaHelixRef} id="helix" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasTurnData && (
                            <tr>
                                <td>Turn</td>
                                <td><nightingale-track ref={turnRef} id="turn" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasBetaStrandData && (
                            <tr>
                                <td>Beta strand</td>
                                <td ><nightingale-track ref={betastrandRef} id="strand" {...trackAttributes} /></td>
                            </tr>
                        )}
                        {hasCoiledCoilData && (
                            <tr>
                                <td>Coiled-coil</td>
                                <td><nightingale-track ref={coiledCoilRef} id="coiled" {...trackAttributes} /></td>
                            </tr>
                        )}

                        {hasSiteData && (
                            <tr>
                                <td>Site</td>
                                <td><nightingale-track ref={siteRef} id="site" {...trackAttributes} /></td>
                            </tr>
                        )}

                        <tr>
                            <td></td>
                            <td><WoodsPlot length={featureSequenceLength} /></td>
                        </tr>

                    </tbody>
                </table>
            </nightingale-manager>
            <p>Selected PDB ID: {selectedPdbId}</p>
        </div>
    );
};
export default NightingaleComponent;
export { getLipScoreColor, buildHeatmapRows, createHeatmapDataset, getHeatmapTooltip, getSequencePositionForTrackEvent, getSequencePositionForHeatmapEvent, applyExactTrackBaseWidth, refreshNightingaleDimensions, relayHeatmapHighlightEvent, dispatchHeatmapHoverHighlightEvent };
    
