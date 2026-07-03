import { useState, useCallback } from 'react';
import type { Rank } from '../types/poker';

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function cellLabel(row: Rank, col: Rank): string {
  const ri = RANKS.indexOf(row);
  const ci = RANKS.indexOf(col);
  if (ri === ci) return `${row}${col}`;
  if (ri < ci) return `${row}${col}s`;
  return `${row}${col}o`;
}

function cellType(row: Rank, col: Rank): 'pair' | 'suited' | 'offsuit' {
  const ri = RANKS.indexOf(row);
  const ci = RANKS.indexOf(col);
  if (ri === ci) return 'pair';
  if (ri < ci) return 'suited';
  return 'offsuit';
}

interface Props {
  selectedHands: Set<string>;
  onChange: (hands: Set<string>) => void;
  // If provided, only hands in this set can be selected (range narrowing)
  maxHands?: Set<string>;
  // If true, no interaction allowed (submitted state)
  locked?: boolean;
}

export default function HandGrid({ selectedHands, onChange, maxHands, locked = false }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');

  const canInteract = useCallback((label: string) => {
    if (locked) return false;
    if (maxHands && !maxHands.has(label)) return false;
    return true;
  }, [locked, maxHands]);

  const toggleCell = useCallback((label: string, mode?: 'select' | 'deselect') => {
    if (!canInteract(label)) return;
    const next = new Set(selectedHands);
    const effectiveMode = mode ?? (next.has(label) ? 'deselect' : 'select');
    if (effectiveMode === 'select') next.add(label);
    else next.delete(label);
    onChange(next);
  }, [selectedHands, onChange, canInteract]);

  const handleMouseDown = (label: string) => {
    if (!canInteract(label)) return;
    const mode = selectedHands.has(label) ? 'deselect' : 'select';
    setDragMode(mode);
    setIsDragging(true);
    toggleCell(label, mode);
  };

  const handleMouseEnter = (label: string) => {
    if (!isDragging || !canInteract(label)) return;
    toggleCell(label, dragMode);
  };

  const handleMouseUp = () => setIsDragging(false);

  const isFirstStreet = !maxHands;
  const selectedCount = selectedHands.size;
  const removedCount = maxHands ? maxHands.size - selectedCount : 0;

  return (
    <div className="hand-grid-wrapper" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="hand-grid-header">
        <span className="grid-title">Villain's Range</span>
        <div className="grid-stats">
          <span className="grid-count">{selectedCount} combos</span>
          {!isFirstStreet && removedCount > 0 && (
            <span className="grid-removed">−{removedCount} removed</span>
          )}
        </div>
      </div>

      {!isFirstStreet && !locked && (
        <div className="grid-hint">Click to remove hands from villain's range. You can only narrow — not expand.</div>
      )}

      <div className="hand-grid" style={{ userSelect: 'none' }}>
        {RANKS.map(row => (
          <div key={row} className="grid-row">
            {RANKS.map(col => {
              const label = cellLabel(row, col);
              const type = cellType(row, col);
              const selected = selectedHands.has(label);
              const outOfMax = maxHands && !maxHands.has(label);
              const removed = maxHands && maxHands.has(label) && !selected;

              let stateClass = '';
              if (outOfMax) stateClass = 'out-of-range';
              else if (removed) stateClass = 'removed';
              else if (selected) stateClass = 'selected';

              return (
                <div
                  key={col}
                  className={`grid-cell ${type} ${stateClass}`}
                  onMouseDown={() => handleMouseDown(label)}
                  onMouseEnter={() => handleMouseEnter(label)}
                  title={label}
                >
                  {label}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid-legend">
        <span className="legend-item pair">Pairs</span>
        <span className="legend-item suited">Suited</span>
        <span className="legend-item offsuit">Offsuit</span>
      </div>
    </div>
  );
}
