import { RANKS, cellLabel } from '../../utils/trainerUtils';

interface HandStat { correct: number; total: number; }

interface Props {
  perHand: Record<string, HandStat>;
}

function cellColor(stat: HandStat | undefined): { bg: string; border: string; text: string } {
  if (!stat) return { bg: 'transparent', border: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.2)' };
  const rate = stat.correct / stat.total;
  if (rate === 1)   return { bg: 'rgba(74,222,128,0.20)',  border: 'rgba(74,222,128,0.50)',  text: '#4ade80' };
  if (rate >= 0.75) return { bg: 'rgba(234,179,8,0.18)',   border: 'rgba(234,179,8,0.45)',   text: '#eab308' };
  if (rate >= 0.5)  return { bg: 'rgba(249,115,22,0.18)',  border: 'rgba(249,115,22,0.45)',  text: '#f97316' };
  return               { bg: 'rgba(239,68,68,0.22)',   border: 'rgba(239,68,68,0.55)',   text: '#f87171' };
}

export default function ResultGrid({ perHand }: Props) {
  return (
    <div className="t-result-grid-wrap">
      <div className="t-result-grid">
        {RANKS.map((_, rowIdx) => (
          <div key={rowIdx} className="t-result-grid-row">
            {RANKS.map((_, colIdx) => {
              const label = cellLabel(rowIdx, colIdx);
              const stat = perHand[label];
              const { bg, border, text } = cellColor(stat);
              const isPair   = rowIdx === colIdx;
              const isSuited = rowIdx < colIdx;
              const typeClass = isPair ? 't-result-cell--pair' : isSuited ? 't-result-cell--suited' : 't-result-cell--offsuit';

              return (
                <div
                  key={colIdx}
                  className={`t-result-cell ${typeClass}`}
                  style={{ background: bg, borderColor: border, color: text }}
                  title={stat ? `${label}: ${stat.correct}/${stat.total} correct` : `${label}: not tested`}
                >
                  <span className="t-result-cell-label">{label}</span>
                  {stat && (
                    <span className="t-result-cell-score">{stat.correct}/{stat.total}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="t-result-grid-legend">
        <span className="t-rgl-item" style={{ color: '#4ade80' }}>■ Perfect</span>
        <span className="t-rgl-item" style={{ color: '#eab308' }}>■ ≥75%</span>
        <span className="t-rgl-item" style={{ color: '#f97316' }}>■ ≥50%</span>
        <span className="t-rgl-item" style={{ color: '#f87171' }}>■ &lt;50%</span>
        <span className="t-rgl-item" style={{ color: 'rgba(255,255,255,0.2)' }}>■ Not tested</span>
      </div>
    </div>
  );
}
