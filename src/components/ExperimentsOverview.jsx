import React, { useState, useEffect } from 'react';
import config from '../config.json';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';


const ExperimentOverview = () => {
  const [experiments, setExperiments] = useState([]);
  const [filteredExperiments, setFilteredExperiments] = useState([]);
  
  const [perturbationOptions, setPerturbationOptions] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [organismOptions, setOrganismOptions] = useState([]);
  
  const [selectedPerturbation, setSelectedPerturbation] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedOrganisms, setSelectedOrganisms] = useState([]);
 
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${config.apiEndpoint}experiments`)
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.experiments)) {
          setExperiments(data.experiments);
          setFilteredExperiments(data.experiments);

          const uniquePerturbations = [...new Set(data.experiments.map(exp => exp.perturbation).filter(perturbation => perturbation))];
          const uniqueCondition = [...new Set(data.experiments.map(exp => exp.condition).filter(condition => condition))];
          const uniqueOrganisms = [...new Set(data.experiments.map(exp => exp.organism).filter(organism => organism))];
          
          setPerturbationOptions(uniquePerturbations.map(perturbation => ({ value: perturbation, label: perturbation })));
          setConditionOptions(uniqueCondition.map(condition => ({ value: condition, label: condition })));
          setOrganismOptions(uniqueOrganisms.map(organism => ({ value: organism, label: organism })));

        } else {
          console.error('Expected an array of experiments but got:', data);
        }
      })
      .catch(error => console.error('Error fetching experiments:', error));
  }, []);


  const handleRowClick = (experiment) => {
    navigate(`/experiment/${experiment.dynaprot_experiment}`);
  };
  
  const handlePerturbationFilterChange = (selectedOptions) => {
    setSelectedPerturbation(selectedOptions || []);
    applyFilters(selectedOptions || [], selectedCondition, selectedOrganisms);
  };
  
  const handleConditionFilterChange = (selectedOptions) => {
    setSelectedCondition(selectedOptions || []);
    applyFilters(selectedPerturbation, selectedOptions || [], selectedOrganisms);
  };

  const handleOrganismFilterChange = (selectedOptions) => {
    setSelectedOrganisms(selectedOptions || []);
    applyFilters(selectedPerturbation, selectedCondition, selectedOptions || []);
  };
  
  const applyFilters = (selectedPerturbation, selectedCondition, selectedOrganisms) => {
    // Extract selected values or default to empty array
    const selectedPerturbationValues = (selectedPerturbation || []).map(option => option.value);
    const selectedConditionValues = (selectedCondition || []).map(option => option.value);
    const selectedOrganismValues = (selectedOrganisms || []).map(option => option.value);
  
    // Filter experiments based on selected values
    const filtered = experiments.filter(experiment =>
      (selectedPerturbationValues.length === 0 || selectedPerturbationValues.includes(experiment.perturbation)) &&
      (selectedConditionValues.length === 0 || selectedConditionValues.includes(experiment.condition)) &&
      (selectedOrganismValues.length === 0 || selectedOrganismValues.includes(experiment.organism))
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
            Organism
            <Select
                isMulti
                options={organismOptions}
                value={selectedOrganisms}
                onChange={handleOrganismFilterChange}
                placeholder="Filter by organism..."
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

          <th>DOI</th>
        </tr>
      </thead>
      <tbody>
      {filteredExperiments.map(experiment => (
        <tr key={experiment.dynaprot_experiment} onClick={() => handleRowClick(experiment)}>
          <td>{experiment.dynaprot_experiment}</td>
          <td>{experiment.organism || 'N/A'}</td>
          <td>{experiment.perturbation || 'N/A'}</td>
          <td>{experiment.condition || 'N/A'}</td>
          <td>
            {experiment.doi ? <a href={experiment.doi}>{experiment.doi}</a>: 'N/A'}
          </td>
        </tr>
      ))}
</tbody>
    </table>
  </div>
);
};


export default ExperimentOverview;
