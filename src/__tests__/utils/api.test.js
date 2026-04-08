import { fetchData, getTableNames, useProteinData } from '../../utils/api';
import { getPdbIds } from '../../utils/fetchExtraData';
import { renderHook, act } from '@testing-library/react';

jest.mock('../../utils/fetchExtraData', () => ({
  getPdbIds: jest.fn(),
}));

describe('api.js', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('fetchData', () => {
    it('returns data on successful fetch', async () => {
      const mockData = { some: 'data' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchData('test-endpoint');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('test-endpoint'));
    });

    it('throws error when response is not ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });
      // Mute console.error for expected error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(fetchData('test-endpoint')).rejects.toThrow('Network response was not ok');
      console.error.mockRestore();
    });
  });

  describe('getTableNames', () => {
    it('returns tables on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: ['table1', 'table2'] }),
      });

      const tables = await getTableNames();
      expect(tables).toEqual(['table1', 'table2']);
    });

    it('throws error on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getTableNames()).rejects.toThrow('Network response was not ok');
      console.error.mockRestore();
    });
  });

  describe('useProteinData', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useProteinData());
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.proteinData).toBe(null);
      expect(result.current.pdbIds).toEqual([]);
    });

    it('fetches protein data successfully', async () => {
      const { result } = renderHook(() => useProteinData());
      const mockProteinData = { name: 'proteinA' };
      const mockPdbIds = ['1XYZ', '2ABC'];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proteinData: mockProteinData }),
      });

      getPdbIds.mockResolvedValueOnce(mockPdbIds);

      await act(async () => {
        await result.current.fetchProteinData('proteinA');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.proteinData).toEqual(mockProteinData);
      expect(result.current.pdbIds).toEqual(mockPdbIds);
    });

    it('handles fetch error', async () => {
      const { result } = renderHook(() => useProteinData());
      
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await result.current.fetchProteinData('proteinA');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to load protein data');
      expect(result.current.proteinData).toEqual({});
      expect(result.current.pdbIds).toEqual([]);
      console.error.mockRestore();
    });
  });
});
