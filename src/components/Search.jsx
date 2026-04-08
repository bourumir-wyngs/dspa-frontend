import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../config.json';
import ProteinSearchResults from './ProteinSearchResults.jsx';


const ProteinSearch = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || '');
  const [error, setError] = useState('');
  const { searchResults: initialSearchResults } = location.state || {};
  const [searchResults, setSearchResults] = useState(initialSearchResults || null);

  const handleProteinNameChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const performSearch = useCallback(async (searchTerm) => {
    try {
      const queryParams = `searchTerm=${encodeURIComponent(searchTerm)}`;
      const url = `${config.apiEndpoint}search?${queryParams}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        if (data.table.length === 1) {
          const result = data.table[0];
          navigate(`/visualize/${result.proteinName}`);
        } else {
          setSearchResults(data);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err.message);
    }
  }, [navigate]);

  useEffect(() => {
    if (location.state?.searchTerm) {
      performSearch(location.state.searchTerm);
    }
  }, [location.state?.searchTerm, performSearch]);

  useEffect(() => {
    if (initialSearchResults) {
      setSearchResults(initialSearchResults);
    }
  }, [initialSearchResults]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    performSearch(searchTerm);
  };

  return (
    <div className="search-section">
    <div className="search-container">
      <h2>Search Protein</h2>
      <div className="search-form-wrapper">
        <form className="search-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input 
              type="text" 
              className="search-input" 
              value={searchTerm} 
              onChange={handleProteinNameChange} 
            />
          </div>
          <button type="submit" className="search-button">Search</button>
        </form>
        {error && <p>Error: {error}</p>}
      </div>
      <div >
        {searchResults && <ProteinSearchResults searchResults={searchResults} />}
      </div>
    </div>
  </div>
  
  );
};

export default ProteinSearch;