import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import config from '../config.json';
import NightingaleComponent from './NightingaleComponent.jsx';
import "@nightingale-elements/nightingale-sequence";
import VolcanoPlot from '../visualization/volcanoplot.js';
import DoseResponseCurves from '../visualization/DoseResponse.js';
import { ProteinScoresTable } from '../visualization/ProteinScoresTable.js';

const getConditionOptionLabel = (conditionOption) => {
    if (!conditionOption) {
        return '';
    }

    if (typeof conditionOption === 'string') {
        return conditionOption;
    }

    return conditionOption.label || conditionOption.condition || conditionOption.value || '';
};

const getConditionOptionValue = (conditionOption) => {
    if (!conditionOption) {
        return '';
    }

    return typeof conditionOption === 'string' ? conditionOption : conditionOption.value;
};

export async function getPdbIds(uniprotAccession) {
    const url = `https://rest.uniprot.org/uniprotkb/${uniprotAccession}.json`;

    const alphafoldStructure = [
        { 
            id: `AF-${uniprotAccession}-F1`, 
            properties: [
                { key: 'Method', value: 'AlphaFold' }, 
                { key: 'Resolution', value: 'N/A' }, 
                { key: 'Chains', value: 'N/A' }
            ] 
        },
    ];

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to retrieve data for accession ${uniprotAccession}`);
        }

        const data = await response.json();
        const pdbIds = data.uniProtKBCrossReferences
            ?.filter(ref => ref.database === 'PDB')
            .map(ref => ({
                id: ref.id,
                properties: ref.properties || [],
            })) || [];

        return [...alphafoldStructure, ...pdbIds];
    } catch (error) {
        console.error(`Error fetching PDB IDs for ${uniprotAccession}:`, error);
        return alphafoldStructure;
    }
}

const TABS = {
    VOLCANO_PLOT: 'Volcano Plot'
};

const Condition = () => {
    const chartRefVolcano = useRef(null);
    const isMounted = useRef(true);
    const containerRef = useRef(null);

    const { selectedCondition: conditionParam } = useParams();
    const [selectedCondition, setSelectedCondition] = useState(conditionParam || "");
    const [conditions, setConditions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [differentialAbundanceData, setDifferentialAbundanceData] = useState([]);
    const[ doseResponseExperiments, setDoseResponseExperiments] = useState([]);
    const [experimentIDs, setExperimentIDs] = useState([]);
    const [error, setError] = useState('');
    const [displayedProtein, setDisplayedProtein] = useState("");
    const [pdbIds, setPdbIds] = useState([]);
    const [selectedPdbId, setSelectedPdbId] = useState("");
    const [doseResponseDataPlotCurve, setDoseResponseDataPlotCurve] = useState([]);
    const [doseResponseDataPlotPoints, setDoseResponseDataPlotPoints] = useState([]);
    const [selectedExperiment, setSelectedExperiment] = useState("");
    const [allGoTerms, setAllGoTerms] = useState([]);
    const [filteredExperimentData, setFilteredExperimentData] = useState([]);
    const [displayedProteinData, setDisplayedProteinData] = useState(null);
    const [activeTab, setActiveTab] = useState(TABS.VOLCANO_PLOT);

    const navigate = useNavigate();

    const selectedConditionLabel = useMemo(() => {
        const matchingCondition = conditions.find(conditionOption => getConditionOptionValue(conditionOption) === selectedCondition);
        return getConditionOptionLabel(matchingCondition) || selectedCondition;
    }, [conditions, selectedCondition]);

    const handleConditionChange = (event) => {
        const selected = event.target.value;
        setSelectedCondition(selected);
        navigate(`/condition/${selected}`);
    };

    const handleProteinClick = (proteinAccession) => {
        setDisplayedProtein(proteinAccession);
        setSelectedExperiment("");
    };
    const fetchData = async (url, signal) => {
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    };

    const fetchDoseResponseData = useCallback(async (dynaprotExperiments, proteinName, signal) => {
        if (!proteinName || !Array.isArray(dynaprotExperiments) || dynaprotExperiments.length === 0) return;

        try {
            const fetchPromises = dynaprotExperiments.map(expID => {
                const queryParams = `dynaprotExperiment=${encodeURIComponent(expID)}&proteinName=${encodeURIComponent(proteinName)}`;
                const url = `${config.apiEndpoint}doseresponse?${queryParams}`;
                return fetch(url, { signal }).then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed for ${expID}: ${res.statusText}`);
                    }
                    return res.json();
                });
            });

            const results = await Promise.all(fetchPromises);

            const allCurves = results.flatMap(data => data.doseResponseDataPlotCurve || []);
            const allPoints = results.flatMap(data => data.doseResponseDataPlotPoints || []);

            setDoseResponseDataPlotCurve(allCurves);
            setDoseResponseDataPlotPoints(allPoints);
        } catch (error) {
            if (isMounted.current) {
                setError(`Error fetching protein data: ${error.message}`);
                setDisplayedProteinData({});
            }
        }
    }, []);


    const fetchProteinData = useCallback(async (proteinName, signal) => {
        if (!proteinName) return;
        try {
            const queryParams = `proteinName=${encodeURIComponent(proteinName)}`;
            const url = `${config.apiEndpoint}proteins?${queryParams}`;
            const response = await fetch(url, { signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch protein data: ${response.statusText}`);
            }
            const data = await response.json();
            const pdbResponse = await getPdbIds(proteinName);
            setPdbIds(pdbResponse);
            setDisplayedProteinData(data.proteinData || {});
        } catch (error) {
            if (isMounted.current) {
                setError(`Error fetching protein data: ${error.message}`);
                setDisplayedProteinData({});
            }
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
      
        const fetchconditionData = async (signal) =>{
            setLoading(true);
            const url = `${config.apiEndpoint}condition/data?condition=${selectedCondition}`;
            try {
                const rawData = await fetchData(url, signal);
                if (!abortController.signal.aborted) {
                    const conditionData = rawData.conditionData;
                    setSelectedCondition(rawData.conditionData.condition);
                    setDifferentialAbundanceData(rawData.conditionData.differentialAbundanceDataList);
                    setExperimentIDs(rawData.conditionData.experimentIDsList);
                    setFilteredExperimentData(rawData.conditionData.proteinScoresTable);
                    setAllGoTerms(rawData.conditionData.goTerms);
                    setDisplayedProtein(rawData.conditionData.proteinScoresTable?.[0]?.proteinAccession);   
                    setDoseResponseExperiments(conditionData.doseResponseExperiments);
                    if (conditionData.doseResponseExperiments.length > 0 && conditionData.proteinScoresTable?.[0]?.proteinAccession) {
                        await fetchDoseResponseData(
                            conditionData.doseResponseExperiments,
                            conditionData.proteinScoresTable[0].proteinAccession,
                            signal
                        ); }
            }
            } catch (error) {
                if (!signal.aborted && isMounted.current) {
                    console.log(error);
                    setError(error.toString());
                }
            } finally {
                setLoading(false);    
            }
        }
        fetchconditionData(abortController.signal);
    
        return () => {
            abortController.abort(); 
        };
    }, [selectedCondition, fetchDoseResponseData])

    useEffect(() => {
        const abortController = new AbortController();
        const fetchConditions = async () => {
            try {
                const response = await fetch(`${config.apiEndpoint}condition/allconditions`, { signal: abortController.signal });
                const data = await response.json();
                if (data.success && Array.isArray(data.conditions)) {
                    setConditions(data.conditions);
                } else {
                    throw new Error(data.message || "Failed to fetch conditions");
                }
            } catch (error) {
                if (isMounted.current) {
                    setError(error.message);
                }
            }
        };
        fetchConditions();
        return () => abortController.abort();
    }, []);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        if (displayedProtein && doseResponseExperiments.length > 0) {
            fetchDoseResponseData(doseResponseExperiments, displayedProtein, abortController.signal);
        }
        return () => abortController.abort();
    }, [displayedProtein, doseResponseExperiments, fetchDoseResponseData]);

    useEffect(() => {
        const abortController = new AbortController();
        fetchProteinData(displayedProtein, abortController.signal);
        return () => abortController.abort();
    }, [displayedProtein, fetchProteinData]);

    useEffect(() => {
        if (pdbIds.length > 0) {
            setSelectedPdbId(pdbIds[0].id);
        }
    }, [pdbIds]);

    return (
        <div>
            <div className="condition-section condition-dropdown">
                <label htmlFor="conditionSelect">Select condition: </label>
                <select id="conditionSelect" value={selectedCondition} onChange={handleConditionChange}>
                    {conditions.map((conditionOption, index) => (
                        <option
                            key={getConditionOptionValue(conditionOption) || index}
                            value={getConditionOptionValue(conditionOption)}
                        >
                            {getConditionOptionLabel(conditionOption)}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? <p>Loading...</p> : error ? <p>Error: {error}</p> : <h1>Condition - {selectedConditionLabel}</h1>}

            <div className="tab-navigation">
                {Object.values(TABS).map(tab => (
                    <button
                        key={tab}
                        className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

           <div
            className={`condition-section-wrapper ${ activeTab === TABS.VOLCANO_PLOT ? 'condition-volcano-plot-wrapper' : ''}`}
            >
            {activeTab === TABS.VOLCANO_PLOT && (
                <VolcanoPlot
                differentialAbundanceDataList={differentialAbundanceData}
                highlightedProtein={displayedProtein}
                chartRef={chartRefVolcano}
                />
            )}
            </div>


            <div className="condition-section condition-protein-experiment-wrapper">
                <div className="condition-table-container">
                    <h2>Significant Proteins across Condition Comparisons</h2>
                    <ProteinScoresTable
                        experimentData={filteredExperimentData}
                        onProteinClick={handleProteinClick}
                        displayedProtein={displayedProtein}
                        goTerms={allGoTerms}
                    />
                </div>

                <div ref={containerRef} className="condition-protein-container">
                    <h2>{displayedProtein}</h2>
                    {displayedProteinData && pdbIds && experimentIDs.length > 0 && (
                        <NightingaleComponent
                            key={displayedProtein}
                            proteinData={displayedProteinData}
                            pdbIds={pdbIds}
                            selectedPdbId={selectedPdbId}
                            setSelectedPdbId={setSelectedPdbId}
                            selectedExperiment={selectedExperiment}
                            showHeatmap={true}
                            passedExperimentIDs={experimentIDs}
                            containerRef={containerRef}
                            masterCondition={selectedConditionLabel}
                        />
                    )}
                </div>
            </div>

            {doseResponseDataPlotCurve && Object.keys(doseResponseDataPlotCurve).length > 0 && (
                <div className="condition-section condition-dose-response-wrapper">
                    <div className="condition-dose-response-container">
                        <h2>Dose-Response-Data for Peptides in {displayedProtein}</h2>
                        <DoseResponseCurves points={doseResponseDataPlotPoints} curves={doseResponseDataPlotCurve} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Condition;
