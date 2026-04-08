import { getPdbIds } from '../../utils/fetchExtraData';

describe('fetchExtraData.js', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('getPdbIds', () => {
    it('returns AlphaFold and PDB IDs on successful fetch', async () => {
      const mockData = {
        uniProtKBCrossReferences: [
          { database: 'PDB', id: '1A2B', properties: [{ key: 'Method', value: 'X-ray' }] },
          { database: 'OtherDB', id: 'ignore-me', properties: [] },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await getPdbIds('P12345');

      expect(result).toHaveLength(2); // 1 AlphaFold + 1 PDB
      expect(result[0].id).toBe('AF-P12345-F1');
      expect(result[1].id).toBe('1A2B');
      expect(result[1].properties[0].key).toBe('Method');
    });

    it('returns only AlphaFold structure when fetch fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getPdbIds('P12345');
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('AF-P12345-F1');
      console.error.mockRestore();
    });

    it('handles missing uniProtKBCrossReferences gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Missing uniProtKBCrossReferences
      });

      const result = await getPdbIds('P12345');
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('AF-P12345-F1');
    });
  });
});
