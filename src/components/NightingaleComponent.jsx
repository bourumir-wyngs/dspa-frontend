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


// Shared color scale for LiP scores — used by the legend, heatmap, and 3D structure.
// Each entry defines a threshold (score > threshold → use this color) checked top-down.
// The last entry (threshold -Infinity) is the fallback for score ≤ 0 / no data.

/**
 * Returns the color string for a given LiP score, using the shared LIP_COLOR_SCALE.
 */
function getLipScoreColor(score) {
    for (const entry of LIP_COLOR_SCALE) {
        if (score > entry.threshold) return entry.color;
    }
    return LIP_COLOR_SCALE[LIP_COLOR_SCALE.length - 1].color;
}

const defaultAttributes = {
    "min-width": "1200",
    length: 0, 
    height: 15, 
    "display-start": "1",
    "display-end": 0, 
    "margin-left": "0",
    "margin-color": "white",
    "highlight-event": "onmouseover",
    "highlight-color": "rgb(255, 210, 128)"
};

const getHeatmapTooltip = (d) => {
    if (d.score === 0 || isNaN(d.score)) {
        return `
            <div class="tooltip-container">
               <strong>no coverage</strong>
            </div>
            `;
    }

    return `
        <div class="tooltip-container">
            Experiment: <a href="/experiment/${d.yValue}" target="_blank" class="tooltip-link"><strong>${d.yValue}</strong></a><br />
            Condition: <strong class="tooltip-highlight">${d.condition || "N/A"}</strong><br />
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
                score: value.score === null ? 0 : value.score,
                condition: metaData ? metaData.condition : "N/A",
            })),
        };
    });
};

const createHeatmapDataset = (rows, sequenceLength) => ({
    xDomain: Array.from({ length: sequenceLength }, (_, index) => index + 1),
    yDomain: rows.map(({ yValue }) => yValue),
    dataHeatmap: rows.flatMap(({ cells }) => cells),
});

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
    
    const sequenceRef = useRef(null);
    const navigationRef = useRef(null);
    const domainRef = useRef(null);
    const bindingRef = useRef(null);
    const chainRef = useRef(null);
    const disulfidRef = useRef(null);
    const betastrandRef = useRef(null);
    const siteRef = useRef(null);
    const regionRef = useRef(null);
    const structureRef = useRef(null);

    const [refreshStructureKey, setRefreshStructureKey] = useState(0);

    const [mappedFeatures, setMappedFeatures] = useState([]);

    const residuelevelContainer = useRef(null);
    const multipleExperimentsContainer = useRef(null);
    const scoreBarcodeContainer = useRef(null);
    const matchingScoreBarcodeContainer = useRef(null);
    const otherScoreBarcodeContainer = useRef(null);
    
    const [selectedExperiment, setSelectedExperiment] = useState('');
    const experimentIDsList = passedExperimentIDs?.length > 0 
    ? passedExperimentIDs 
    : proteinData.experimentIDsList.length > 0
        ? proteinData.experimentIDsList
        : proteinData.lipscoreList.map(entry => entry.experimentID);

    const [trackHeight, setTrackHeight] = useState(null);
    const lastLayoutHeightsRef = useRef({ structureHeight: null, trackHeight: null });


    const sequenceLength = proteinData.proteinSequence.length;
    const defaultLipScoreString = JSON.stringify(Array(sequenceLength).fill(-1));
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
    const hasRegionData = proteinData.featuresData.features.some(({ type }) => type === "REGION");
    const hasSiteData = proteinData.featuresData.features.some(({ type }) => type === "SITE");
    const hasBindingData = proteinData.featuresData.features.some(({ type }) => type === "BINDING");
    const hasChainData = proteinData.featuresData.features.some(({ type }) => type === "CHAIN");
    const hasDisulfidData = proteinData.featuresData.features.some(({ type }) => type === "DISULFID");
    const hasBetaStrandData = proteinData.featuresData.features.some(({ type }) => type === "STRAND");

    const visibleTracks = [
        hasDomainData && "domain",
        hasBindingData && "binding",
        hasSiteData && "site",
        hasChainData && "chain",
        hasDisulfidData && "disulfid",
        hasBetaStrandData && "strand",
        hasRegionData && "region",
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
        let lipScoreString = JSON.stringify(Array(sequenceLength).fill(-1));

        if (experimentID === selectedExperiment) {
            setSelectedExperiment('');
        } else {
            setSelectedExperiment(experimentID);
            const lipScoreArray = getLipScoreDataByExperimentID(experimentID);
            lipScoreString = JSON.stringify(lipScoreArray);  
        }

        setLipscoreString(lipScoreString);

        if(structureRef.current){
            setRefreshStructureKey(refreshStructureKey => refreshStructureKey + 1);
        } 
    };

    useEffect(() => {
        if (!experimentIDsList || experimentIDsList.length === 0) return;
        if (selectedExperiment !== '') return;

        const defaultExperimentId = experimentIDsList[0];
        setSelectedExperiment(defaultExperimentId);

        const lipScoreArray = getLipScoreDataByExperimentID(defaultExperimentId);
        if (lipScoreArray) {
            setLipscoreString(JSON.stringify(lipScoreArray));
        }
    }, [experimentIDsList, selectedExperiment, getLipScoreDataByExperimentID]);

    useEffect(() => {
        if (proteinData?.featuresData?.features && trackHeight) {
            defaultAttributes.length = proteinData.featuresData.sequence.length;
            defaultAttributes.height = trackHeight;
            defaultAttributes['display-end'] = proteinData.featuresData.sequence.length;

            setMappedFeatures(proteinData.featuresData.features.map(ft => ({
                ...ft,
                start: ft.start || ft.begin
            })));
        }
    }, [proteinData, trackHeight]);

    useEffect(() => {
        if (!trackHeight || !proteinData?.featuresData?.sequence || !sequenceRef.current) {
            return;
        }

        const tooltip = document.getElementById("tooltip");
        if (!tooltip) {
              console.error("Tooltip element not found!");
              return;
          }
        
        const updateTooltip = (content, x, y) => {
            tooltip.innerHTML = content;
            tooltip.style.top = `${y + 10}px`;
            tooltip.style.left = `${x + 10}px`;
            tooltip.style.visibility = "visible";
        };

        const hideTooltip = () => {
            tooltip.style.visibility = "hidden";
        };

        const updateElementAttributes = (ref, id) => {
            if (ref.current) {
                ref.current.setAttribute("id", id);
                Object.keys(defaultAttributes).forEach(key => {
                    ref.current.setAttribute(key, defaultAttributes[key]);
                });
                ref.current.addEventListener('customEvent', handleCustomEvent);
            }
        };

        const updateTracks = () => {
            const trackIds = ["domain", "region", "site", "binding", "chain", "disulfid", "strand"];
            trackIds.forEach(id => {
                const trackElement = document.querySelector(`#${id}`);
                if (trackElement) {
                    let trackFeatures = mappedFeatures.filter(({ type }) => type.toUpperCase() === id.toUpperCase());
                
                    if (id.toUpperCase() === "BINDING") {
                        trackFeatures = trackFeatures.map(feature => {
                            if (feature.type.toUpperCase() === "BINDING" && feature.ligand && feature.ligand.name) {
                                return { ...feature, tooltipContent: feature.ligand.name };
                            }
                            return feature;
                        });
                    } else{
                        trackFeatures = trackFeatures.map(feature => {
                            if (feature.description) {
                                return { ...feature, tooltipContent: feature.description };
                            }
                            return feature;
                        });

                    }
                    trackElement.data = trackFeatures;
                    trackElement.addEventListener("mousemove", (event) => {
                        const trackLength = trackElement.getAttribute("length");
                        const relativeX = event.offsetX / trackElement.clientWidth;
                        const position = Math.floor(relativeX * trackLength);
    
                        // Find the closest feature to this position
                        const feature = trackFeatures.find(f => f.start <= position && f.end >= position);
                        if (feature) {
                            updateTooltip(feature.tooltipContent, event.pageX, event.pageY);
                      }
                    });
                    trackElement.addEventListener("mouseleave", hideTooltip);

                }
            });
        };
        
        updateElementAttributes(navigationRef, "navigation");
        updateElementAttributes(domainRef, "domain");
        updateElementAttributes(bindingRef, "binding");
        updateElementAttributes(chainRef, "chain");
        updateElementAttributes(disulfidRef, "disulfid");
        updateElementAttributes(betastrandRef, "strand");
        updateElementAttributes(siteRef, "site");
        updateElementAttributes(regionRef, "region");

        const attributes = {
            ...defaultAttributes,
            sequence: proteinData.featuresData.sequence,
            id: "sequence",
        };
    
        Object.keys(attributes).forEach(key => {
            sequenceRef.current.setAttribute(key, attributes[key]);
        });
    
        updateTracks();
    }, [mappedFeatures, trackHeight, proteinData?.featuresData?.sequence]);


    const handleCustomEvent = (e) => {
        console.log('Event received:', e.detail);
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
                if (
                    ref.current &&
                    dataset.yDomain.length > 0 &&
                    checkDimensions(ref.current) &&
                    ref.current.setHeatmapData
                ) {
                    ref.current.setHeatmapData(dataset.xDomain, dataset.yDomain, dataset.dataHeatmap);

                    requestAnimationFrame(() => {
                        if (ref.current?.heatmapInstance) {
                            ref.current.heatmapInstance.setColor((d) => getLipScoreColor(d.score));
                            ref.current.heatmapInstance.setTooltip((d) => getHeatmapTooltip(d));
                        }
                    });
                }
            });
        });
    }, [
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
                            {experimentIDsList.map((experimentID) => (
                                <option key={experimentID} value={experimentID}>
                                    {`Experiment ${experimentID}`}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="experiment-buttons">
                        {experimentIDsList.map((experimentID, index) => (
                            <button
                                key={experimentID}
                                className={`experiment-button ${selectedExperiment === experimentID ? "selected" : ""}`}
                                onClick={() => handleExperimentClick(experimentID, index)}
                            >
                                {`Experiment ${experimentID}`}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Nightingale Manager with Table of Tracks */}
            <nightingale-manager>
                <div id="tooltip" className="tooltip"></div>
                <div style={{ width: '100%', overflow: 'hidden' }}>
                    <nightingale-structure key={refreshStructureKey} ref={structureRef} style={{ display: 'block', width: '100%' }} />
                </div>
                <table style={{ width: '100%', tableLayout: 'fixed' }}>
                    <tbody>
                    <tr >
                        <td style={{ width: '150px' }}></td>
                        <td style={{ width: '100%', overflow: 'visible' }}>
                            <style>{`nightingale-navigation .start-label, .end-label { visibility: hidden; }`}</style>
                            <nightingale-navigation ref={navigationRef}/>
                        </td>
                    </tr>

                    <tr>
                        <td >Sequence</td>
                        <td style={{ width: '100%', overflow: 'visible' }}><nightingale-sequence ref={sequenceRef} style={{ display: 'block', width: '100%' }} /></td>
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
                                            min-width="1200"
                                            length={sequenceLength}
                                            height="100"
                                            display-start="1"
                                            display-end={sequenceLength}
                                            highlight-event="onmouseover"
                                            margin-left="0"
                                            margin-color="white"
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
                                            min-width="1200"
                                            length={sequenceLength}
                                            height="100"
                                            display-start="1"
                                            display-end={sequenceLength}
                                            highlight-event="onmouseover"
                                            margin-left="0"
                                            margin-color="white"
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
                                    min-width="1200"
                                    length={sequenceLength}
                                    height="100"
                                    display-start="1"
                                    display-end={sequenceLength}
                                    highlight-event="onmouseover"
                                    margin-left="0"
                                    margin-color="white"
                                    style={{ display: 'block', width: '100%' }}
                                />
                            </td>
                        </tr>
                    )}

                        {hasDomainData && (
                            <tr >
                                <td>Domain</td>
                                <td><nightingale-track ref={domainRef} /></td>
                            </tr>
                        )}

                        {hasBindingData && (
                            <tr >
                                <td>Binding site</td>
                                <td><nightingale-track ref={bindingRef} /></td>
                            </tr>
                        )}

                        {hasChainData && (
                            <tr >
                                <td>Chain</td>
                                <td><nightingale-track ref={chainRef} /></td>
                            </tr>
                        )}
                        {hasDisulfidData && (
                            <tr>
                                <td>Disulfide bond</td>
                                <td><nightingale-track ref={disulfidRef} /></td>
                            </tr>
                        )}
                        {hasBetaStrandData && (
                            <tr>
                                <td>Beta strand</td>
                                <td ><nightingale-track ref={betastrandRef} /></td>
                            </tr>
                        )}

                        {hasSiteData && (
                            <tr>
                                <td>Site</td>
                                <td><nightingale-track ref={siteRef} /></td>
                            </tr>
                        )}

                        {hasRegionData && (
                            <tr>
                                <td>Region</td>
                                <td><nightingale-track ref={regionRef} /></td>
                            </tr>
                        )}


                    </tbody>
                </table>
            </nightingale-manager>
            <p>Selected PDB ID: {selectedPdbId}</p>
        </div>
    );
};
export default NightingaleComponent;
    