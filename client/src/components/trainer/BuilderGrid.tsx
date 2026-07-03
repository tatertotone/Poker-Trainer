import { useState, useCallback } from 'react';
import { RANKS, cellLabel, suitedAxHands, pocketPairHands, suitedBroadwayHands, offsuitBroadwayHands } from '../../utils/trainerUtils';
import type { RangeAction } from '../../types/trainer';

interface Props {
  handActions: Record<string, string>;
  actions: RangeAction[];
  activeActionId: string | null;
  defaultActionId: string | null;
  onChange: (handActions: Record<string, string>) => void;
}

export default function BuilderGrid({ handActions, actions, activeActionId, defaultActionId, onChange }: Props) {
  const defaultAction = actions.find(a => a.id === defaultActionId);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'paint' | 'erase'>('paint');

  const colorForHand = (label: string): string | undefined => {
    const actionId = handActions[label];
    if (!actionId) return undefined;
    return actions.find(a => a.id === actionId)?.color;
  };

  const applyCell = useCallback((label: string, mode: 'paint' | 'erase') => {
    const next = { ...handActions };
    if (mode === 'erase') {
      delete next[label];
    } else if (activeActionId) {
      next[label] = activeActionId;
    }
    onChange(next);
  }, [handActions, activeActionId, onChange]);

  const handleMouseDown = (label: string) => {
    const mode = handActions[label] && activeActionId && handActions[label] === activeActionId ? 'erase' : 'paint';
    setDragMode(mode);
    setIsDragging(true);
    applyCell(label, mode);
  };

  const handleMouseEnter = (label: string) => {
    if (!isDragging) return;
    applyCell(label, dragMode);
  };

  const handleContextMenu = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    const next = { ...handActions };
    delete next[label];
    onChange(next);
  };

  const applyShortcut = (hands: string[]) => {
    if (!activeActionId) return;
    const next = { ...handActions };
    hands.forEach(h => { next[h] = activeActionId; });
    onChange(next);
  };


  const totalHands = Object.keys(handActions).length;

  return (
    <div className="t-builder-grid-wrapper">
      <div className="t-shortcut-bar">
        <span className="t-section-label">Quick select</span>
        <div className="t-shortcut-buttons">
          <button className="t-shortcut-btn" onClick={() => applyShortcut(pocketPairHands())}>Pocket Pairs</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(suitedAxHands())}>Suited Ax</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(suitedBroadwayHands())}>Suited Broadways</button>
          <button className="t-shortcut-btn" onClick={() => applyShortcut(offsuitBroadwayHands())}>Offsuit Broadways</button>
        </div>
        <button className="t-shortcut-btn t-shortcut-btn--clear" onClick={() => onChange({})}>Clear all</button>
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
              const color = colorForHand(label);
              const isPair = rowIdx === colIdx;
              const isSuited = rowIdx < colIdx;
              const typeClass = isPair ? 't-cell--pair' : isSuited ? 't-cell--suited' : 't-cell--offsuit';
              const isPainted = !!color;
              const defColor = !isPainted && defaultAction ? defaultAction.color : null;

              const cellStyle = isPainted
                ? { background: color, borderColor: color, color: '#fff' }
                : defColor
                  ? { background: defColor + '28', borderColor: defColor + '55', color: defColor + 'bb' }
                  : {};

              return (
                <div
                  key={colIdx}
                  className={`t-cell ${typeClass}`}
                  style={cellStyle}
                  onMouseDown={() => handleMouseDown(label)}
                  onMouseEnter={() => handleMouseEnter(label)}
                  onContextMenu={e => handleContextMenu(e, label)}
                  title={`${label}${isPainted ? '' : defColor ? ` → ${defaultAction!.name} (default)` : ' (unassigned)'}`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="t-grid-footer">
        <span className="t-grid-count">{totalHands} hands assigned</span>
        <div className="t-grid-legend">
          <span className="t-legend-item t-legend-pair">Pairs</span>
          <span className="t-legend-item t-legend-suited">Suited</span>
          <span className="t-legend-item t-legend-offsuit">Offsuit</span>
        </div>
        <span className="t-hint-sm">Right-click to erase</span>
      </div>
    </div>
  );
}
