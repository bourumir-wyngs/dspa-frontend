
import { useState, useCallback } from 'react';
import config from '../config.json';
import { getPdbIds } from './fetchExtraData';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.example.com';

// Function to make a generic HTTP GET request
export const fetchData = async (endpoint) => {
  try {
    const response = await fetch(`${BASE_URL}/${endpoint}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

// Example function to get table names from your server
export const getTableNames = async () => {
  try {
    const data = await fetchData('api/tables'); // Replace with your actual API endpoint
    return data.tables; // Assuming the API response has a 'tables' property
  } catch (error) {
    // Handle or log the error
    throw error;
  }
};


export const useProteinData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proteinData, setProteinData] = useState(null);
  const [pdbIds, setPdbIds] = useState([]);

  const fetchProteinData = useCallback(async (proteinName) => {
      setLoading(true);
      setError('');
      // const taxonomyID = 9606;  // Hardcoded for now, you can parameterize this if needed

      const queryParams = `proteinName=${encodeURIComponent(proteinName)}`;
      const url = `${config.apiEndpoint}proteins?${queryParams}`;

      try {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json(); 
          setProteinData(data.proteinData);
          console.log("proteindata", data.proteinData);

          const pdbIds = await getPdbIds(proteinName);  // Assuming getPdbIds is imported from utils
          setPdbIds(pdbIds);
      } catch (error) {
          console.error("Error fetching data: ", error);
          setError('Failed to load protein data');
          setProteinData({});
      } finally {
          setLoading(false);
      }
  }, []);

  return { loading, error, proteinData, pdbIds, fetchProteinData };
};