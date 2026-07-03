import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { RangeAction } from '../../types/trainer';
import { ACTION_COLORS } from '../../utils/trainerUtils';

interface Props {
  actions: RangeAction[];
  activeActionId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<RangeAction>) => void;
  onDelete: (id: string) => void;
}

export default function ActionManager({ actions, activeActionId, onSelect, onAdd, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="t-action-manager">
      <div className="t-section-label">Actions</div>
      <div className="t-action-list">
        {actions.map(action => (
          <div
            key={action.id}
            className={`t-action-row ${activeActionId === action.id ? 't-action-row--active' : ''}`}
            onClick={() => onSelect(action.id)}
          >
            <div
              className="t-action-swatch"
              style={{ background: action.color }}
              title="Click to change color"
              onClick={e => e.stopPropagation()}
            >
              <select
                className="t-color-select"
                value={action.color}
                onChange={e => onUpdate(action.id, { color: e.target.value })}
                onClick={e => e.stopPropagation()}
              >
                {ACTION_COLORS.map(c => (
                  <option key={c} value={c} style={{ background: c }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {editingId === action.id ? (
              <input
                className="t-action-name-input"
                autoFocus
                value={action.name}
                onChange={e => onUpdate(action.id, { name: e.target.value })}
                onBlur={() => setEditingId(null)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="t-action-name"
                onDoubleClick={e => { e.stopPropagation(); setEditingId(action.id); }}
              >
                {action.name}
              </span>
            )}

            {activeActionId === action.id && (
              <Check size={14} className="t-action-check" />
            )}

            <button
              className="t-action-delete"
              onClick={e => { e.stopPropagation(); onDelete(action.id); }}
              title="Delete action"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <button className="t-btn t-btn--ghost t-btn--sm" onClick={onAdd}>
        <Plus size={14} /> Add action
      </button>
      <p className="t-hint">Click an action to select it, then paint cells on the grid. Double-click name to rename.</p>
    </div>
  );
}
