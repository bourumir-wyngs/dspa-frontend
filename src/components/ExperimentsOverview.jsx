import React, { useState, useEffect } from 'react';
import config from '../config.json';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';


const ExperimentOverview = () => {
  const [experiments, setExperiments] = useState([]);
  const [filteredExperiments, setFilteredExperiments] = useState([]);
  
  const [taxonomyOptions, setTaxonomyOptions] = useState([]);
  const [perturbationOptions, setPerturbationOptions] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [proteaseOptions, setProteaseOptions] = useState([]);
  
  const [selectedTaxonomies, setSelectedTaxonomies] = useState([]);
  const [selectedPerturbation, setSelectedPerturbation] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedProtease, setSelectedProtease] = useState([]);
 
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${config.apiEndpoint}experiments`)
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.experiments)) {
          setExperiments(data.experiments);
          setFilteredExperiments(data.experiments);

          const uniquePerturbations = [...new Set(data.experiments.map(exp => exp.perturbation).filter(perturbation => perturbation))];
          const uniqueTaxonomies = [...new Set(data.experiments.map(exp => exp.taxonomy_id).filter(taxonomy => taxonomy))];
          const uniqueCondition = [...new Set(data.experiments.map(exp => exp.condition).filter(condition => condition))];
          const uniqueProtease= [...new Set(data.experiments.map(exp => exp.protease).filter(protease => protease))];
          
          setPerturbationOptions(uniquePerturbations.map(perturbation => ({ value: perturbation, label: perturbation })));
          setTaxonomyOptions(uniqueTaxonomies.map(taxonomy => ({ value: taxonomy, label: taxonomy })));
          setConditionOptions(uniqueCondition.map(condition => ({ value: condition, label: condition })));
          setProteaseOptions(uniqueProtease.map(protease => ({ value: protease, label: protease })));

        } else {
          console.error('Expected an array of experiments but got:', data);
        }
      })
      .catch(error => console.error('Error fetching experiments:', error));
  }, []);


  const handleRowClick = (experiment) => {
    navigate(`/experiment/${experiment.dynaprot_experiment}`);
  };

  const handleTaxonomyFilterChange = (selectedOptions) => {
    setSelectedTaxonomies(selectedOptions || []);
    applyFilters(selectedPerturbation, selectedCondition, selectedProtease, selectedOptions || []);
  };
  
  const handlePerturbationFilterChange = (selectedOptions) => {
    setSelectedPerturbation(selectedOptions || []);
    applyFilters(selectedOptions || [], selectedCondition, selectedProtease, selectedTaxonomies);
  };
  
  const handleConditionFilterChange = (selectedOptions) => {
    setSelectedCondition(selectedOptions || []);
    applyFilters(selectedPerturbation, selectedOptions || [], selectedProtease, selectedTaxonomies);
  };
  
  const handleProteaseFilterChange = (selectedOptions) => {
    setSelectedProtease(selectedOptions || []);
    applyFilters(selectedPerturbation, selectedCondition, selectedOptions || [], selectedTaxonomies);
  };
  
  const applyFilters = (selectedPerturbation, selectedCondition, selectedProtease, selectedTaxonomies) => {
    // Extract selected values or default to empty array
    const selectedPerturbationValues = (selectedPerturbation || []).map(option => option.value);
    const selectedTaxonomyValues = (selectedTaxonomies || []).map(option => option.value);
    const selectedConditionValues = (selectedCondition || []).map(option => option.value);
    const selectedProteaseValues = (selectedProtease || []).map(option => option.value);
  
    // Filter experiments based on selected values
    const filtered = experiments.filter(experiment =>
      (selectedPerturbationValues.length === 0 || selectedPerturbationValues.includes(experiment.perturbation)) &&
      (selectedTaxonomyValues.length === 0 || selectedTaxonomyValues.includes(experiment.taxonomy_id)) &&
      (selectedConditionValues.length === 0 || selectedConditionValues.includes(experiment.condition)) &&
      (selectedProteaseValues.length === 0 || selectedProteaseValues.includes(experiment.protease))
    );
  
    setFilteredExperiments(filtered);
  };

  return (
    <div className="experiment-overview-container">
    <h1 className= "experiment-header">Experiments</h1>
    <table className="experiment-table">
      <thead>
        <tr>
          <th>DynaProt Experiment ID </th>
          <th>
            Taxonomy ID
            <Select
              isMulti
              options={taxonomyOptions}
              value={selectedTaxonomies}
              onChange={handleTaxonomyFilterChange}
              placeholder="Filter by taxonomy ID..."
              className="filter-select"
            />
          </th>

          <th>
            Perturbation
            <Select
              isMulti
              options={perturbationOptions}
              value={selectedPerturbation}
              onChange={handlePerturbationFilterChange}
              placeholder="Filter by perturbation..."
              className="filter-select"
            />
          </th>

          <th>
            Condition
            <Select
              isMulti
              options={conditionOptions}
              value={selectedCondition}
              onChange={handleConditionFilterChange}
              placeholder="Filter by condition..."
              className="filter-select"
            />
          </th>

          <th>
            Protease
            <Select
              isMulti
              options={proteaseOptions}
              value={selectedProtease}
              onChange={handleProteaseFilterChange}
              placeholder="Filter by protease..."
              className="filter-select"
            />
          </th>
          <th>Organism</th>
          <th>DOI</th>
        </tr>
      </thead>
      <tbody>
      {filteredExperiments.map(experiment => (
        <tr key={experiment.dynaprot_experiment} onClick={() => handleRowClick(experiment)}>
          <td>{experiment.dynaprot_experiment}</td>
          <td>{experiment.taxonomy_id}</td>
          <td>{experiment.perturbation || 'N/A'}</td>
          <td>{experiment.condition || 'N/A'}</td>
          <td>{experiment.protease || 'N/A'}</td>
          <td>TODO</td>
          <td><a href={experiment.doi}>{experiment.doi}</a></td>
        </tr>
      ))}
</tbody>
    </table>
  </div>
);
};


export default ExperimentOverview;
