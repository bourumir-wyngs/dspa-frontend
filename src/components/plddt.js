export const PLDDT_CONFIDENCE_SCALE = [
    { label: '>90', color: '#0053D6' },
    { label: '70–90', color: '#65CBF3' },
    { label: '50–<70', color: '#FFDB13' },
    { label: '<50', color: '#FF7D45' },
];

export function getPlddtScoreColor(score) {
    if (!Number.isFinite(score) || score < 0 || score > 100) return '#aaaaaa';
    if (score > 90) return PLDDT_CONFIDENCE_SCALE[0].color;
    if (score >= 70) return PLDDT_CONFIDENCE_SCALE[1].color;
    if (score >= 50) return PLDDT_CONFIDENCE_SCALE[2].color;
    return PLDDT_CONFIDENCE_SCALE[3].color;
}

export function createPlddtHeatmapDataset(scores, sequenceLength) {
    const scoresByPosition = new Map();
    for (const { position, score } of scores || []) {
        if (Number.isInteger(position) && position >= 1 && position <= sequenceLength
            && Number.isFinite(score) && score >= 0 && score <= 100) {
            scoresByPosition.set(position, score);
        }
    }
    const xDomain = Array.from({ length: sequenceLength }, (_, index) => index + 1);
    return {
        xDomain,
        yDomain: ['pLDDT'],
        dataHeatmap: xDomain.map(position => ({
            xValue: position,
            yValue: 'pLDDT',
            score: scoresByPosition.get(position) ?? null,
        })),
    };
}

export function getPlddtTooltip({ xValue, score }) {
    const value = Number.isFinite(score) && score >= 0 && score <= 100
        ? `${score.toFixed(2)} / 100`
        : 'Unavailable';
    return `<div class="tooltip-container">Residue: <strong>${Number(xValue)}</strong><br />pLDDT score: <strong>${value}</strong></div>`;
}
