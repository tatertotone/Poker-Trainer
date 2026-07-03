import type { PreflopAction } from '../../types/trainer';
import { SEATS_CLOCKWISE, positionsBeforeHero } from '../../utils/trainerUtils';

interface Props {
  heroPosition: string;
  numOpponents: number;
  preflopSpot: PreflopAction[];
  onChange: (spot: PreflopAction[]) => void;
}

const ACTION_LABELS = { fold: 'Fold', raise: 'Raise', limp: 'Limp' } as const;

export default function PreflopActionEditor({ heroPosition, numOpponents, preflopSpot, onChange }: Props) {
  const seats = SEATS_CLOCKWISE[Math.min(9, Math.max(2, numOpponents + 1))] ?? SEATS_CLOCKWISE[6];
  const positions = positionsBeforeHero(heroPosition, seats);

  const getSpot = (pos: string): PreflopAction =>
    preflopSpot.find(a => a.position === pos) ?? { position: pos, action: 'fold', sizeBB: 0 };

  const update = (pos: string, patch: Partial<PreflopAction>) => {
    const next = positions.map(p => {
      const cur = getSpot(p);
      return p === pos ? { ...cur, ...patch } : cur;
    });
    onChange(next);
  };

  if (positions.length === 0) {
    return (
      <div className="t-builder-section">
        <div className="t-section-label">Opponent actions</div>
        <p className="t-hint">Hero is first to act — no prior actions.</p>
      </div>
    );
  }

  return (
    <div className="t-builder-section">
      <div className="t-section-label">Opponent actions</div>
      <p className="t-hint">What each player did before hero acts.</p>
      <div className="t-preflop-editor">
        {positions.map(pos => {
          const spot = getSpot(pos);
          return (
            <div key={pos} className="t-preflop-row">
              <span className="t-preflop-pos">{pos}</span>
              <div className="t-preflop-action-btns">
                {(['fold', 'raise', 'limp'] as const).map(act => (
                  <button
                    key={act}
                    className={`t-preflop-btn${spot.action === act ? ' t-preflop-btn--active' : ''}`}
                    onClick={() => update(pos, {
                      action: act,
                      sizeBB: act === 'raise' ? (spot.sizeBB > 0 ? spot.sizeBB : 2.5) : 0,
                    })}
                  >
                    {ACTION_LABELS[act]}
                  </button>
                ))}
              </div>
              {spot.action === 'raise' && (
                <div className="t-preflop-size">
                  <input
                    type="number"
                    className="t-input t-input--sm"
                    value={spot.sizeBB || 2.5}
                    min={2} max={50} step={0.5}
                    style={{ width: 56 }}
                    onChange={e => update(pos, { sizeBB: parseFloat(e.target.value) || 2.5 })}
                  />
                  <span className="t-hint">BB</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
