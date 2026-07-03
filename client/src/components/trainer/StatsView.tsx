import { ArrowLeft, Trash2 } from 'lucide-react';
import type { RangeConfig, RangeStats } from '../../types/trainer';
import { RANKS, cellLabel, loadStats, saveStats } from '../../utils/trainerUtils';

interface Props {
  range: RangeConfig;
  onBack: () => void;
  onStatsChange: () => void;
}

export default function StatsView({ range, onBack, onStatsChange }: Props) {
  const allStats = loadStats();
  const stats: RangeStats = allStats[range.id] ?? {
    rangeId: range.id, totalCorrect: 0, totalAttempts: 0, handStats: {},
  };

  const pct = stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : null;

  const clearStats = () => {
    const all = loadStats();
    delete all[range.id];
    saveStats(all);
    onStatsChange();
  };

  function cellColor(label: string): string {
    const hs = stats.handStats[label];
    if (!hs || hs.total === 0) return '';
    const rate = hs.correct / hs.total;
    if (rate >= 0.9) return '#16a34a';
    if (rate >= 0.7) return '#65a30d';
    if (rate >= 0.5) return '#ca8a04';
    return '#dc2626';
  }

  function cellTitle(label: string): string {
    const hs = stats.handStats[label];
    if (!hs || hs.total === 0) return `${label}: no data`;
    const rate = Math.round((hs.correct / hs.total) * 100);
    return `${label}: ${hs.correct}/${hs.total} (${rate}%)`;
  }

  // Worst hands (most errors, at least 3 attempts)
  const worstHands = Object.entries(stats.handStats)
    .filter(([, hs]) => hs.total >= 3)
    .map(([hand, hs]) => ({ hand, rate: hs.correct / hs.total, ...hs }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 8);

  return (
    <div className="t-stats">
      <div className="t-stats-topbar">
        <button className="t-btn t-btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="t-stats-title">{range.name} — Stats</h2>
        <button className="t-btn t-btn--danger t-btn--sm" onClick={clearStats}>
          <Trash2 size={14} /> Reset
        </button>
      </div>

      {/* Summary */}
      <div className="t-stats-summary">
        <div className="t-stat-card">
          <span className="t-stat-num">{stats.totalAttempts}</span>
          <span className="t-stat-label">Total hands</span>
        </div>
        <div className="t-stat-card">
          <span className="t-stat-num">{stats.totalCorrect}</span>
          <span className="t-stat-label">Correct</span>
        </div>
        <div className={`t-stat-card ${pct !== null ? (pct >= 80 ? 't-stat-card--green' : pct >= 60 ? 't-stat-card--yellow' : 't-stat-card--red') : ''}`}>
          <span className="t-stat-num">{pct !== null ? `${pct}%` : '—'}</span>
          <span className="t-stat-label">Accuracy</span>
        </div>
      </div>

      {/* Accuracy grid */}
      <div className="t-stats-grid-section">
        <div className="t-section-label">Accuracy by hand</div>
        <p className="t-hint">Green = high accuracy · Red = needs work · Gray = untested</p>
        <div className="t-stats-grid">
          {RANKS.map((_, rowIdx) => (
            <div key={rowIdx} className="t-grid-row">
              {RANKS.map((_, colIdx) => {
                const label = cellLabel(rowIdx, colIdx);
                const inRange = !!range.handActions[label];
                const color = cellColor(label);
                const isPair = rowIdx === colIdx;
                const isSuited = rowIdx < colIdx;
                const typeClass = isPair ? 't-cell--pair' : isSuited ? 't-cell--suited' : 't-cell--offsuit';
                const hs = stats.handStats[label];

                return (
                  <div
                    key={colIdx}
                    className={`t-cell t-cell--stats ${typeClass} ${!inRange ? 't-cell--inactive' : ''}`}
                    style={inRange && color ? { background: color, borderColor: color, color: '#fff', opacity: 1 } : {}}
                    title={inRange ? cellTitle(label) : `${label} (not in range)`}
                  >
                    {inRange && hs && hs.total > 0
                      ? `${Math.round((hs.correct / hs.total) * 100)}%`
                      : label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Worst hands */}
      {worstHands.length > 0 && (
        <div className="t-worst-hands">
          <div className="t-section-label">Focus areas (≥3 attempts)</div>
          <div className="t-worst-list">
            {worstHands.map(({ hand, correct, total, rate }) => {
              const action = range.actions.find(a => a.id === range.handActions[hand]);
              return (
                <div key={hand} className="t-worst-item">
                  <span className="t-worst-hand">{hand}</span>
                  <span className="t-worst-action" style={{ color: action?.color }}>
                    {action?.name ?? 'Not in range'}
                  </span>
                  <span className="t-worst-pct" style={{ color: rate < 0.5 ? '#dc2626' : '#ca8a04' }}>
                    {correct}/{total} ({Math.round(rate * 100)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
