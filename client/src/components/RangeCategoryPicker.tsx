// ── Category definitions ──────────────────────────────────────────────────────
// Fixed strength tiers used to tag villain's range after every action, on every street.

export interface CategoryDef {
  key: string;
  label: string;
  color: string;
  dimColor: string;
}

export const RANGE_CATEGORIES: CategoryDef[] = [
  { key: 'cpsf',  label: 'Can play for stacks (CPSF)', color: '#f59e0b', dimColor: '#78350f' },
  { key: 'thick', label: 'Thick value',                 color: '#3b82f6', dimColor: '#1e3a5f' },
  { key: 'thin',  label: 'Thin value',                  color: '#38bdf8', dimColor: '#164e63' },
  { key: 'sdv',   label: 'Showdown value (SDV)',         color: '#a78bfa', dimColor: '#3b1f6e' },
  { key: 'draws', label: 'Draws',                        color: '#34d399', dimColor: '#065f46' },
  { key: 'air',   label: 'Air',                          color: '#f87171', dimColor: '#7f1d1d' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  selected: Set<string>;
  previousSelected?: Set<string>;
  onChange: (cats: Set<string>) => void;
  locked?: boolean;
}

export default function RangeCategoryPicker({
  selected, previousSelected, onChange, locked = false,
}: Props) {
  const toggle = (label: string) => {
    if (locked) return;
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(next);
  };

  const prevLabels = previousSelected ? [...previousSelected] : [];

  return (
    <div className="rcp-wrapper">
      <div className="rcp-header">
        <span className="rcp-title">Villain's Range</span>
        <span className="rcp-count">
          {selected.size} categor{selected.size === 1 ? 'y' : 'ies'} selected
        </span>
      </div>

      {!locked && prevLabels.length > 0 && (
        <div className="rcp-prev-note">
          Last street: {prevLabels.join(', ')}
        </div>
      )}

      <div className="rcp-groups">
        <div className="rcp-group">
          <div className="rcp-chips">
            {RANGE_CATEGORIES.map(cat => {
              const isSelected = selected.has(cat.label);
              return (
                <button
                  key={cat.key}
                  className={`rcp-chip ${isSelected ? 'rcp-chip--selected' : ''}`}
                  style={isSelected
                    ? { borderColor: cat.color, color: cat.color, background: `${cat.dimColor}99` }
                    : {}}
                  onClick={() => toggle(cat.label)}
                  disabled={locked}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected.size === 0 && !locked && (
        <div className="rcp-empty-hint">
          Select the hand types you think villain holds on this street
        </div>
      )}
    </div>
  );
}
