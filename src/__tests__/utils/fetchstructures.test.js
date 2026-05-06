import { getPdbIds } from '../../utils/fetchstructures';

describe('fetchstructures.js', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches UniProt data and returns only PDB reference IDs', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dbReferences: [
          { type: 'PDB', id: '1ABC' },
          { type: 'AlphaFoldDB', id: 'AF-P12345-F1' },
          { type: 'PDB', id: '2XYZ' },
        ],
      }),
    });

    await expect(getPdbIds('P12345')).resolves.toEqual(['1ABC', '2XYZ']);
    expect(global.fetch).toHaveBeenCalledWith('https://rest.uniprot.org/uniprotkb/P12345.json');
  });

  it('returns an empty array when UniProt data has no dbReferences', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(getPdbIds('P12345')).resolves.toEqual([]);
  });

  it('returns an empty array and logs when the response is not ok', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockResolvedValueOnce({ ok: false });

    await expect(getPdbIds('P12345')).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('returns an empty array and logs when fetch rejects', async () => {
    const networkError = new Error('network failed');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockRejectedValueOnce(networkError);

    await expect(getPdbIds('P12345')).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(networkError);
  });
});
