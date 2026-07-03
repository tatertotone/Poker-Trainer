import type { LeaderboardEntry } from '../types/poker';

interface Props {
  entries: LeaderboardEntry[];
  onClose: () => void;
  onClear: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ratingClass(rating: number): string {
  if (rating >= 80) return 'high';
  if (rating >= 60) return 'mid';
  return 'low';
}

export default function Leaderboard({ entries, onClose, onClear }: Props) {
  const sorted = [...entries].sort(
    (a, b) => b.rating - a.rating || a.timeSeconds - b.timeSeconds,
  );

  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb-panel" onClick={e => e.stopPropagation()}>
        <div className="lb-header">
          <div className="lb-title">
            <span className="lb-title-icon">🏆</span>
            <h3>Personal Leaderboard</h3>
            <span className="lb-count">{entries.length} hand{entries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="lb-controls">
            {entries.length > 0 && (
              <button className="lb-clear-btn" onClick={onClear}>Clear all</button>
            )}
            <button className="lb-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="lb-empty">
            <div className="lb-empty-icon">📋</div>
            <p>No hands completed yet.</p>
            <p className="lb-empty-sub">Finish a hand to earn your first rating.</p>
          </div>
        ) : (
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-col-rank">#</th>
                  <th className="lb-col-villain">Villain</th>
                  <th className="lb-col-pos">Matchup</th>
                  <th className="lb-col-date">Date</th>
                  <th className="lb-col-time">Time</th>
                  <th className="lb-col-rating">Rating</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr key={entry.id} className={i === 0 ? 'lb-row-top' : ''}>
                    <td className="lb-col-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="lb-col-villain">
                      <span className="lb-villain-emoji">{entry.villainEmoji}</span>
                      <span className="lb-villain-name">{entry.villainName}</span>
                    </td>
                    <td className="lb-col-pos">
                      <span className="lb-pos">{entry.heroPosition}</span>
                      <span className="lb-vs">vs</span>
                      <span className="lb-pos">{entry.villainPosition}</span>
                    </td>
                    <td className="lb-col-date">{formatDate(entry.date)}</td>
                    <td className="lb-col-time">{formatTime(entry.timeSeconds)}</td>
                    <td className="lb-col-rating">
                      <span className={`lb-rating-pill ${ratingClass(entry.rating)}`}>
                        {entry.rating}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
