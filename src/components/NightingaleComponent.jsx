import React, { useEffect, useRef, useState } from 'react';
import "@nightingale-elements/nightingale-sequence";
import "@nightingale-elements/nightingale-navigation";
import "@nightingale-elements/nightingale-manager";
import "@nightingale-elements/nightingale-colored-sequence";
import "@nightingale-elements/nightingale-msa";


import "@nightingale-elements/nightingale-sequence-heatmap";
import "@dspa-nightingale/nightingale-structure";
import "@dspa-nightingale/nightingale-track";


// Shared color scale for LiP scores — used by the legend, heatmap, and 3D structure.
// Each entry defines a threshold (score > threshold → use this color) checked top-down.
// The last entry (threshold -Infinity) is the fallback for score ≤ 0 / no data.
const LIP_COLOR_SCALE = [
    { threshold: 7,          color: '#782162', rgb: [120, 33, 98],   label: '> 7' },
    { threshold: 5,          color: '#da49a9', rgb: [218, 73, 169],  label: '5 - 7' },
    { threshold: 4,          color: '#f2c0e1', rgb: [242, 192, 225], label: '4 - 5' },
    { threshold: 3,          color: '#fbeaf5', rgb: [251, 234, 245], label: '3 - 4' },
    { threshold: 0,          color: '#acc1db', rgb: [172, 193, 219], label: '0 - 3' },
    { threshold: -Infinity,  color: '#000000', rgb: [0, 0, 0],       label: 'no LiP Score reported' },
];

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

const NightingaleComponent = ({
    proteinData, 
    pdbIds, 
    selectedPdbId, 
    setSelectedPdbId, 
    showHeatmap = true,
    passedExperimentIDs,
    containerRef
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
    
    const [selectedButton, setSelectedButton] = useState(null);
    const [selectedExperiment, setSelectedExperiment] = useState(null);
    const [isHeatmapReady, setHeatmapReady] = useState(false);
    const experimentIDsList = passedExperimentIDs?.length > 0 
    ? passedExperimentIDs 
    : proteinData.experimentIDsList.length > 0
        ? proteinData.experimentIDsList
        : proteinData.lipscoreList.map(entry => entry.experimentID);

    const [trackHeight, setTrackHeight] = useState(null);


    const sequenceLength = proteinData.proteinSequence.length;
    const defaultLipScoreString = JSON.stringify(Array(sequenceLength).fill(-1));
    const [lipscoreString, setLipscoreString] = useState(defaultLipScoreString);

    const proteinName = proteinData.proteinName;
 
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
        const updateHeight = () => {
            const managerContainer = document.getElementById("nightingale-manager-container");
            if (managerContainer) {
                const totalHeight = managerContainer.getBoundingClientRect().height;
                const structureHeight = totalHeight * 0.4;
 
                if (structureRef.current) {
                    structureRef.current.setAttribute('style', `--custom-structure-height: ${structureHeight}px;`);
                    structureRef.current.style.setProperty('--custom-structure-height', `${structureHeight}px`);
                }
          
                const tracks_len = visibleTracks.length + 2;
                const availableTrackHeight = structureHeight;
                const dynamicTrackHeight = Math.min(Math.max(
                    availableTrackHeight / ( tracks_len|| 1), 
                    20
                ), 30);
                setTrackHeight(dynamicTrackHeight);
            }
        };
    
        const handleTouchStart = () => {
            updateHeight();
        };
    
        window.addEventListener("resize", updateHeight);
        window.addEventListener("touchstart", handleTouchStart, { passive: true });
        updateHeight();
    
        return () => {
            window.removeEventListener("resize", updateHeight);
            window.removeEventListener("touchstart", handleTouchStart);
        };
    }, [visibleTracks.length]); 
     
    const checkDimensions = (element) => {
        if (element) {
            if ('offsetWidth' in element && 'offsetHeight' in element) {
                return element.offsetWidth > 0 && element.offsetHeight > 0;
            }
        }
        return false;
    };
    
    const getLipScoreDataByExperimentID = (experimentID) => {
        if (!proteinData || !proteinData.lipscoreList) return null;
        const lipScoreEntry = proteinData.lipscoreList.find(entry => entry.experimentID === experimentID);
        return lipScoreEntry ? lipScoreEntry.data : null;
    };

    const handleExperimentClick = (experimentID,index) => {
        let lipScoreString = JSON.stringify(Array(sequenceLength).fill(-1));

        if (experimentID === selectedExperiment) {
            setSelectedExperiment(null);
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
    }, [mappedFeatures]);


    const handleCustomEvent = (e) => {
        console.log('Event received:', e.detail);
      };

    useEffect(() => {
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
            if (scoreBarcodeContainer.current && checkDimensions(scoreBarcodeContainer.current)) {

                const experimentMetaDataMap = new Map();
                proteinData.experimentMetaData.forEach((meta) => {
                    experimentMetaDataMap.set(meta.dpx_comparison, meta);
                });

                const dataHeatmap = Object.entries(proteinData.differentialAbundanceData).flatMap(([key, values]) =>
                    values.map(value => {
                        const metaData = experimentMetaDataMap.get(key); 
                        return {
                            yValue: key,
                            xValue: value.index,
                            score: value.score === null ? 0 : value.score,
                            condition: metaData ? metaData.condition : "N/A", 
                        };
                    })
                );

                const xValues = dataHeatmap.map(item => item.xValue);
                const smallestXValue = Math.min(...xValues);
                const largestXValue = Math.max(...xValues);

                const xDomain = Array.from({ length: largestXValue - smallestXValue + 1 }, (_, i) => i + smallestXValue);
                const yDomain = Object.keys(proteinData.differentialAbundanceData);

                const heatmapElement = document.getElementById("id-for-nightingale-sequence-heatmap");
                if (heatmapElement && heatmapElement.setHeatmapData) {
                    heatmapElement.setHeatmapData(xDomain, yDomain, dataHeatmap);

                    // Wait for heatmapInstance to be created, then apply the shared color scale
                    const applyColor = () => {
                        if (heatmapElement.heatmapInstance) {
                            heatmapElement.heatmapInstance.setColor((d) => getLipScoreColor(d.score));
                        }
                    };
                    // heatmapInstance is created in updated() after requestUpdate, so defer
                    requestAnimationFrame(applyColor);

                    setHeatmapReady(true);
                }
            }
        });
    }, [proteinData.differentialAbundanceData, proteinData.experimentMetaData]);


    if (isHeatmapReady) {
        const heatmapElement = document.getElementById("id-for-nightingale-sequence-heatmap");
        heatmapElement.heatmapInstance.setTooltip((d, x, y, xIndex, yIndex) => {
            if (d.score === 0 || isNaN(d.score)) {
                return `
                    <div class="tooltip-container">
                       <strong>no coverage</strong>
                    </div>
                    `;
            } else
                return `
                <div class="tooltip-container">
                    Experiment: <a href="/experiment/${d.yValue}" target="_blank" class="tooltip-link"><strong>${d.yValue}</strong></a><br />
                    Condition: <strong class="tooltip-highlight">${d.condition || "N/A"}</strong><br />
                    LiP Score: <strong>${d.score.toFixed(2)}</strong>
                </div>`;
        });
    }

    // Legend derived from the shared LIP_COLOR_SCALE (reversed so lowest scores appear first)
    const legendData = [...LIP_COLOR_SCALE].reverse().map(({ color, label }) => ({ color, label }));

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
                            onChange={handleExperimentClick}
                        >
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
                <div>
                    <nightingale-structure key={refreshStructureKey} ref={structureRef} />
                </div>
                <table>
                    <tbody>
                        <tr >
                            <td ></td>
                            <td><nightingale-navigation ref={navigationRef}/></td>
                        </tr>

                        <tr>
                            <td >Sequence</td>
                            <td><nightingale-sequence ref={sequenceRef} /></td>
                        </tr>

                           {showHeatmap && (
                            <tr>
                                <td >Structural-Barcode</td>
                                <td>
                                    <nightingale-sequence-heatmap
                                        ref={scoreBarcodeContainer}
                                        id="id-for-nightingale-sequence-heatmap"
                                        heatmap-id="seq-heatmap"
                                        min-width="1200"
                                        length={sequenceLength}
                                        height="100"
                                        display-start="1"
                                        display-end={sequenceLength}
                                        highlight-event="onmouseover"
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
    