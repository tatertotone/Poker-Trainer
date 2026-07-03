import { RANKS, cellLabel } from '../../utils/trainerUtils';
import type { RangeAction } from '../../types/trainer';

interface Props {
  handActions: Record<string, string>;
  actions: RangeAction[];
  defaultActionId?: string | null;
}

export default function MiniGrid({ handActions, actions, defaultActionId }: Props) {
  const colorFor = (label: string): { bg: string; border: string } | null => {
    const actionId = handActions[label];
    if (actionId) {
      const c = actions.find(a => a.id === actionId)?.color;
      if (c) return { bg: c, border: c };
    }
    if (defaultActionId) {
      const c = actions.find(a => a.id === defaultActionId)?.color;
      if (c) return { bg: c + '28', border: c + '55' };
    }
    return null;
  };

  return (
    <div className="t-mini-grid">
      {RANKS.map((_, rowIdx) => (
        <div key={rowIdx} className="t-mini-grid-row">
          {RANKS.map((_, colIdx) => {
            const label = cellLabel(rowIdx, colIdx);
            const colors = colorFor(label);
            return (
              <div
                key={colIdx}
                className="t-mini-cell"
                style={colors
                  ? { background: colors.bg, borderColor: colors.border }
                  : {}}
                title={label}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
