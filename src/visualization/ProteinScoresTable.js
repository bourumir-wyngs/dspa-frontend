import { useMemo } from 'react';
export const ProteinScoresTable = ({ experimentData, onProteinClick, displayedProtein, goTerms, onGoTermSelect }) => {
    const sortedExperimentData = useMemo(() => {
        return [...experimentData].sort((a, b) => b.averageScore - a.averageScore);
    }, [experimentData]);

    if (!sortedExperimentData || !Array.isArray(sortedExperimentData)) {
        console.error("experimentData is not an array or is undefined:", experimentData);
        return <div>No valid data to display</div>;
    }

    return (
        <div className="condition-table-container">
            <table className="condition-protein-table">
                <thead>
                    <tr>
                        <th className= "condition-protein-table">Protein Accession</th>
                        <th className= "condition-protein-table">Average LiP Score among Experiments</th>
                        <th className= "condition-protein-table">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedExperimentData.map((proteinData) => (
                        <tr 
                        key={proteinData.proteinAccession}
                        className={`protein-row ${displayedProtein === proteinData.proteinAccession ? 'selected' : ''}`}
                        onClick={() => onProteinClick(proteinData.proteinAccession)}
                        >
                            <td>{proteinData.proteinAccession}</td>
                            <td>{Math.round(proteinData.averageScore || 0)}</td>
                            <td>{proteinData.protein_description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

