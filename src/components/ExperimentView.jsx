import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import config from '../config.json';
import VolcanoPlot from '../visualization/volcanoplot.js';
import GOEnrichmentVisualization from '../visualization/GOEnrichmentVisualization.js';

const SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS = {
    accession: 'Protein accession identifier from the UniProt proteome entries matched in DSPA.',
    description: 'Protein description annotation associated with the matched accession.',
    maxLog2FC: 'Largest absolute log2 fold change among significant differential_abundance rows for this protein across all comparisons in the experiment. The displayed value keeps the original sign of that strongest change.',
    significantPeptides: 'Count of significant differential_abundance peptide rows for this protein across all comparisons, using adj. p-value < 0.05 and |log2FC| > 1.',
    comparison: 'Comparison in which the displayed Max log2FC value was observed.'
};

const SIGNIFICANT_PROTEINS_INITIAL_LIMIT = 25;

const ExperimentInfo = () => {
    const { experimentID } = useParams(); 
    const [experimentData, setExperimentData] = useState([]);
    const [differentialAbundanceData, setDifferentialAbundanceData] = useState([]);
    const [goEnrichmentData, setGoEnrichmentData] = useState([]);
    const [qcPdfData, setQcPdfData] = useState(null);
    const [showAllSignificantProteins, setShowAllSignificantProteins] = useState(false);

    const fetchExperimentData = useCallback(async () => {
        const url = `${config.apiEndpoint}experiment?experimentID=${experimentID}`;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          setExperimentData(data.experimentData);
          setDifferentialAbundanceData(data.experimentData.differentialAbundanceDataList);
          setGoEnrichmentData(data.experimentData.goEnrichmentData || []);
        } catch (error) {
          console.error("Error fetching data: ", error);
        }
      }, [experimentID]);

    
    
    const handleDownloadPDF = () => {
        const downloadPdf = async () => {
            try {
                let pdfData = qcPdfData;

                if (!pdfData) {
                    const response = await fetch(`${config.apiEndpoint}experiment?experimentID=${experimentID}&includeQcPdf=true`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    const data = await response.json();
                    pdfData = data.experimentData?.metaData?.qc_pdf_file ?? null;
                    setQcPdfData(pdfData);
                }

                if (!pdfData?.data) {
                    console.error('No QC PDF file available');
                    return;
                }

                const blob = new Blob([new Uint8Array(pdfData.data)], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Experiment_${experimentData.experimentID}_QC.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Error downloading QC PDF:', error);
            }
        };

        downloadPdf();
    };

    useEffect(() => {
        fetchExperimentData();
    }, [fetchExperimentData]);

    const significantProteins = experimentData?.significantProteins || experimentData?.proteinScores || [];
    const visibleSignificantProteins = showAllSignificantProteins
        ? significantProteins
        : significantProteins.slice(0, SIGNIFICANT_PROTEINS_INITIAL_LIMIT);
    const hasMoreSignificantProteins = significantProteins.length > SIGNIFICANT_PROTEINS_INITIAL_LIMIT;

    return (
        <div>
            {experimentData && experimentData.experimentID && (
                    <div className="experiment-metadata-container">
                        {/* Experiment Header */}
                        <div className="experiment-header">
                            <h1>DynaProt Experiment Comparison ID: <span>{experimentData.experimentID}</span></h1>
                        </div>
                
                        {/* Metadata Sections */}
                        <div className="metadata-section">
                            <h2>General Information</h2>
                            <div className="metadata-field">
                                <strong>Perturbation:</strong> {experimentData.perturbation || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Condition:</strong> {experimentData.metaData.condition || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Taxonomy ID:</strong> {experimentData.metaData.taxonomy_id || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Strain:</strong> {experimentData.metaData.strain || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Publication:</strong> {experimentData.metaData.publication || 'N/A'}
                            </div>
                        </div>
                
                        <div className="metadata-section">
                            <h2>Methods</h2>
                            <div className="metadata-field">
                                <strong>Instrument:</strong> {experimentData.metaData.instrument || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Experiment:</strong> {experimentData.metaData.experiment || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Digestion Protocol:</strong> {experimentData.metaData.digestion_protocol || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Protease:</strong> {experimentData.metaData.protease || 'N/A'}
                            </div>
                            <div className="metadata-field">
                                <strong>Digestion Time (Sec):</strong> {experimentData.metaData.pk_digestion_time_in_sec || 'N/A'}
                            </div>
                        </div>
                
                        {/* Download Button */}
                        <div className="download-section">
                            <button onClick={handleDownloadPDF} className="download-button">Download QC Data as PDF</button>
                        </div>
                    </div>
                )}
                <div className="results-experiment-search-container">
                    <div id="chart"></div>
                </div>
                <div >
                <div className="protein-view-section">
                <h2  className="centered-heading" > Volcano Plots per comparison</h2><br />
                    <div className="experiment-volcano-plots-wrapper">
                        <VolcanoPlot
                            differentialAbundanceDataList={differentialAbundanceData}
                        />
                    </div>
                    </div>
                <div className="protein-view-section">
                <h2  className="centered-heading" > Gene Ontology Enrichment Analysis</h2><br />
                    <div>
                        <GOEnrichmentVisualization
                            goEnrichmentData={goEnrichmentData}
                        />
                    </div>
                    </div>
                <div className="protein-view-section">
                <h2 className="centered-heading">Significant Proteins across Comparisons</h2><br />
                <table className="condition-protein-table">
                    <thead>
                        <tr>
                            <th className="condition-protein-table significant-protein-cell-center" title={SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS.accession}>Accession</th>
                            <th className="condition-protein-table significant-protein-cell-left" title={SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS.description}>Description</th>
                            <th className="condition-protein-table significant-protein-cell-center" title={SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS.maxLog2FC}>Max log<sub>2</sub>FC</th>
                            <th className="condition-protein-table significant-protein-cell-center" title={SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS.significantPeptides}>Sig. peptides</th>
                            <th className="condition-protein-table significant-protein-cell-center" title={SIGNIFICANT_PROTEIN_HEADER_TOOLTIPS.comparison}>Comparison</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleSignificantProteins.map((protein, index) => (
                            <tr key={`${protein.proteinAccession || protein.pg_protein_accessions}-${index}`} className="protein-row">
                                <td className="significant-protein-cell-center">
                                    {protein.proteinAccession || protein.pg_protein_accessions ? (
                                        <a
                                            href={`/visualize/${protein.proteinAccession || protein.pg_protein_accessions}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {protein.proteinAccession || protein.pg_protein_accessions}
                                        </a>
                                    ) : 'N/A'}
                                </td>
                                <td className="significant-protein-cell-left">{protein.protein_description || 'N/A'}</td>
                                <td className="significant-protein-cell-center">{typeof protein.maxLog2FC === 'number' ? protein.maxLog2FC.toFixed(2) : 'N/A'}</td>
                                <td className="significant-protein-cell-center">{protein.n_peptides ?? 'N/A'}</td>
                                <td className="significant-protein-cell-center">{protein.comparison || protein.dpx_comparison || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {hasMoreSignificantProteins && !showAllSignificantProteins && (
                    <div className="significant-proteins-summary">
                        Showing {SIGNIFICANT_PROTEINS_INITIAL_LIMIT} of {significantProteins.length},{' '}
                        <button
                            type="button"
                            className="show-all-link-button"
                            onClick={() => setShowAllSignificantProteins(true)}
                        >
                            show all
                        </button>
                    </div>
                )}
                </div>
            </div>
            </div>
            
       
    );
};


export default ExperimentInfo;
