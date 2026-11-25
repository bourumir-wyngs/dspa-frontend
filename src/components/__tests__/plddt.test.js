import { createPlddtHeatmapDataset, getPlddtScoreColor, getPlddtTooltip } from '../plddt';

describe('pLDDT barcode data', () => {
    it('aligns confidence scores by sequence position in one row and preserves missing positions', () => {
        const dataset = createPlddtHeatmapDataset([
            { position: 4, score: 100 },
            { position: 2, score: 72.69 },
            { position: 1, score: 0 },
            { position: 3, score: 101 },
            { position: 0, score: 90 },
            { position: 5, score: 90 },
            { position: 1.5, score: 90 },
        ], 4);

        expect(dataset.xDomain).toEqual([1, 2, 3, 4]);
        expect(dataset.yDomain).toEqual(['pLDDT']);
        expect(dataset.dataHeatmap).toEqual([
            { xValue: 1, yValue: 'pLDDT', score: 0 },
            { xValue: 2, yValue: 'pLDDT', score: 72.69 },
            { xValue: 3, yValue: 'pLDDT', score: null },
            { xValue: 4, yValue: 'pLDDT', score: 100 },
        ]);
    });

    it('uses unavailable cells rather than LiP scores when confidence is absent or invalid', () => {
        expect(createPlddtHeatmapDataset([], 3).dataHeatmap.map(cell => cell.score))
            .toEqual([null, null, null]);
        expect(createPlddtHeatmapDataset([
            { position: 1, score: null },
            { position: 2, score: NaN },
            { position: 3, score: -1 },
        ], 3).dataHeatmap.map(cell => cell.score)).toEqual([null, null, null]);
    });

    it('uses the AlphaFold confidence colors at their boundaries', () => {
        const cases = [
            [0, '#FF7D45'], [49.99, '#FF7D45'],
            [50, '#FFDB13'], [69.99, '#FFDB13'],
            [70, '#65CBF3'], [90, '#65CBF3'],
            [90.01, '#0053D6'], [100, '#0053D6'],
            [null, '#aaaaaa'], [undefined, '#aaaaaa'],
            [NaN, '#aaaaaa'], [-1, '#aaaaaa'], [101, '#aaaaaa'],
        ];
        cases.forEach(([score, color]) => expect(getPlddtScoreColor(score)).toBe(color));
    });

    it('shows the residue and confidence in its tooltip', () => {
        const tooltip = getPlddtTooltip({ xValue: 2, score: 72.69 });
        expect(tooltip).toContain('2');
        expect(tooltip).toContain('72.69');
        expect(tooltip).toMatch(/pLDDT/);
        expect(tooltip).not.toContain('LiP Score');
        expect(getPlddtTooltip({ xValue: 2, score: null })).toMatch(/unavailable/i);
    });
});
