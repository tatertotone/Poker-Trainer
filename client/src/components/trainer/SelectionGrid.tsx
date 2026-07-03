import { useState, useCallback } from 'react';
import { RANKS, cellLabel, allHandLabels, suitedAxHands, pocketPairHands, suitedBroadwayHands, offsuitBroadwayHands } from '../../utils/trainerUtils';

interface Props {
  selectedHands: string[];
  rangeHands: Record<string, string>; // handActions — to show which hands are in the range
  onChange: (hands: string[]) => void;
}

const SEL_COLOR = '#f59e0b'; // amber

export default function SelectionGrid({ selectedHands, rangeHands, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'paint' | 'erase'>('paint');
  const selected = new Set(selectedHands);

  const applyCell = useCallback((label: string, mode: 'paint' | 'erase') => {
    const next = new Set(selectedHands);
    if (mode === 'erase') next.delete(label);
    else next.add(label);
    onChange([...next]);
  }, [selectedHands, onChange]);

  const handleMouseDown = (label: string) => {
    const mode = selected.has(label) ? 'erase' : 'paint';
    setDragMode(mode);
    setIsDragging(true);
    applyCell(label, mode);
  };

  const handleMouseEnter = (label: string) => {
    if (!isDragging) return;
    applyCell(label, dragMode);
  };

  const applyShortcut = (hands: string[]) => {
    const next = new Set(selectedHands);
    hands.forEach(h => next.add(h));
    onChange([...next]);
  };

  return (
    <div className="t-builder-grid-wrapper">
      <div className="t-shortcut-bar">
        <span className="t-section-label">Quick select</span>
        <div className="t-shortcut-buttons">
          <button className="t-shortcut-btn" onClick={() => onChange(allHandLabels())}>All hands</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(pocketPairHands())}>Pocket Pairs</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(suitedAxHands())}>Suited Ax</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(suitedBroadwayHands())}>Suited Broadways</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(offsuitBroadwayHands())}>Offsuit Broadways</button>
        </div>
        <button className="t-shortcut-btn t-shortcut-btn--clear" onClick={() => onChange([])}>Clear all</button>
      </div>

      <div
        className="t-grid"
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{ userSelect: 'none' }}
      >
        {RANKS.map((_, rowIdx) => (
          <div key={rowIdx} className="t-grid-row">
            {RANKS.map((_, colIdx) => {
              const label = cellLabel(rowIdx, colIdx);
              const isSelected = selected.has(label);
              const inRange = !!rangeHands[label];
              const isPair = rowIdx === colIdx;
              const isSuited = rowIdx < colIdx;
              const typeClass = isPair ? 't-cell--pair' : isSuited ? 't-cell--suited' : 't-cell--offsuit';

              // In-range hands: amber tint. Out-of-range hands: fold-blue tint (defaults to fold).
              // All hands are selectable — unselected non-range hands still default to fold when drilled.
              const cellStyle = isSelected
                ? { background: SEL_COLOR, borderColor: SEL_COLOR, color: '#000', fontWeight: '700' }
                : inRange
                  ? { background: SEL_COLOR + '1a', borderColor: SEL_COLOR + '50', color: SEL_COLOR + 'aa' }
                  : { background: '#388bfd18', borderColor: '#388bfd40', color: '#388bfd70' };

              return (
                <div
                  key={colIdx}
                  className={`t-cell ${typeClass}`}
                  style={cellStyle}
                  onMouseDown={() => handleMouseDown(label)}
                  onMouseEnter={() => handleMouseEnter(label)}
                  onContextMenu={e => { e.preventDefault(); applyCell(label, 'erase'); }}
                  title={label + (isSelected ? ' ✓ selected' : inRange ? ' (in range)' : ' (defaults to fold)')}
                >
                  {label}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="t-grid-footer">
        <span className="t-grid-count">{selectedHands.length} hands selected for drilling</span>
        <span className="t-hint-sm">Blue = defaults to fold · Right-click to deselect</span>
      </div>
    </div>
  );
}
