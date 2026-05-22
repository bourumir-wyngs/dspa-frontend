import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const getProteinAccession = (proteinData) => proteinData.proteinAccession || proteinData.pg_protein_accessions || '';

const getMaxLog2FC = (proteinData) => {
    const value = proteinData.maxLog2FC ?? proteinData.diff;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

const formatMaxLog2FC = (proteinData) => {
    const value = getMaxLog2FC(proteinData);
    return value === null ? 'N/A' : value.toFixed(2);
};

const getSignificantPeptideCount = (proteinData) => proteinData.n_peptides ?? proteinData.count ?? 'N/A';

export const ProteinScoresTable = ({ experimentData, onProteinClick, displayedProtein }) => {
    const sortedExperimentData = useMemo(() => {
        if (!Array.isArray(experimentData)) {
            return [];
        }

        return [...experimentData].sort((a, b) => {
            const left = getMaxLog2FC(a);
            const right = getMaxLog2FC(b);
            return Math.abs(right ?? 0) - Math.abs(left ?? 0);
        });
    }, [experimentData]);

    return (
        <div className="condition-table-container">
            <table className="condition-protein-table">
                <thead>
                    <tr>
                        <th className="condition-protein-table">Protein Accession</th>
                        <th className="condition-protein-table">Max log2FC among Experiments</th>
                        <th className="condition-protein-table">Number of Significant Peptides among Experiments</th>
                        <th className="condition-protein-table">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedExperimentData.length === 0 ? (
                        <tr>
                            <td colSpan="4">No significant proteins found for this condition.</td>
                        </tr>
                    ) : sortedExperimentData.map((proteinData, index) => {
                        const proteinAccession = getProteinAccession(proteinData);

                        return (
                            <tr
                                key={`${proteinAccession}-${index}`}
                                className={`protein-row ${displayedProtein === proteinAccession ? 'selected' : ''}`}
                                onClick={() => onProteinClick(proteinAccession)}
                            >
                                <td><Link to={`/visualize/${encodeURIComponent(proteinAccession)}`} onClick={(event) => event.stopPropagation()}>{proteinAccession}</Link></td>
                                <td>{formatMaxLog2FC(proteinData)}</td>
                                <td>{getSignificantPeptideCount(proteinData)}</td>
                                <td>{proteinData.protein_description || 'N/A'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
