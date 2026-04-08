export async function getPdbIds(uniprotAccession) {
    const url = `https://rest.uniprot.org/uniprotkb/${uniprotAccession}.json`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to retrieve data for accession ${uniprotAccession}`);
        }
        
        const data = await response.json();
        const pdbIds = [];
        
        if (data.dbReferences) {
            for (const dbRef of data.dbReferences) {
                if (dbRef.type === 'PDB') {
                    pdbIds.push(dbRef.id);
                }
            }
        }
        
        return pdbIds;
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Example usage
