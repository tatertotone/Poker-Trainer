import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import type { RangeConfig } from '../../types/trainer';
import { FIXED_ACTIONS, POSITIONS, STACK_PRESETS, getBorderlineHands } from '../../utils/trainerUtils';
import BuilderGrid from './BuilderGrid';
import SelectionGrid from './SelectionGrid';
import PreflopActionEditor from './PreflopActionEditor';

function makeId() { return Math.random().toString(36).slice(2); }

function defaultRange(): RangeConfig {
  return {
    id: makeId(),
    name: '',
    position: 'BTN',
    stackDepthBB: 100,
    opponents: 1,
    actions: FIXED_ACTIONS,
    handActions: {},
    defaultActionId: 'fold',
    distractorMode: 'nearby',
    manualDistractors: [],
    preflopSpot: [],
    testHands: [],
    testHandsEquity: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface Props {
  initial?: RangeConfig;
  onSave: (range: RangeConfig) => void;
  onBack: () => void;
}

export default function RangeBuilder({ initial, onSave, onBack }: Props) {
  const [range, setRange] = useState<RangeConfig>(() => ({
    ...(initial ?? defaultRange()),
    actions: FIXED_ACTIONS, // always normalize
  }));
  const [activeActionId, setActiveActionId] = useState<string>('raise');
  const [gridTab, setGridTab] = useState<'range' | 'test'>('range');
  const [error, setError] = useState('');

  const patch = (p: Partial<RangeConfig>) => setRange(r => ({ ...r, ...p }));

  const handleSave = () => {
    if (!range.name.trim()) { setError('Give this range a name.'); return; }
    if (Object.keys(range.handActions).length === 0) { setError('Assign at least one hand.'); return; }
    if (initial?.passed) {
      if (!confirm('Saving changes will remove the "Passed" label from this range. Continue?')) return;
    }
    setError('');
    onSave({ ...range, actions: FIXED_ACTIONS, name: range.name.trim(), passed: false, updatedAt: Date.now() });
  };

  return (
    <div className="t-builder">
      <div className="t-builder-topbar">
        <button className="t-btn t-btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <input
          className="t-range-name-input"
          placeholder="Range name (e.g. BTN Open)"
          value={range.name}
          onChange={e => patch({ name: e.target.value })}
        />
        <button className="t-btn t-btn--primary" onClick={handleSave}>
          <Save size={16} /> Save range
        </button>
      </div>
      {error && <p className="t-error t-error--banner">{error}</p>}

      <div className="t-builder-body">
        {/* Left: grid */}
        <div className="t-builder-left">
          <div className="t-grid-tabs">
            <button
              className={`t-grid-tab ${gridTab === 'range' ? 't-grid-tab--active' : ''}`}
              onClick={() => setGridTab('range')}
            >
              Range
            </button>
            <button
              className={`t-grid-tab ${gridTab === 'test' ? 't-grid-tab--active' : ''}`}
              onClick={() => setGridTab('test')}
            >
              Test hands
              {(range.testHands?.length ?? 0) > 0 && (
                <span className="t-grid-tab-badge">{range.testHands.length}</span>
              )}
            </button>
          </div>

          {gridTab === 'range' ? (
            <BuilderGrid
              handActions={range.handActions}
              actions={FIXED_ACTIONS}
              activeActionId={activeActionId}
              defaultActionId={range.defaultActionId}
              onChange={ha => patch({ handActions: ha, testHands: Object.keys(ha), testHandsEquity: false })}
            />
          ) : (
            <>
              <SelectionGrid
                selectedHands={range.testHands ?? []}
                rangeHands={range.handActions}
                onChange={hands => patch({ testHands: hands })}
              />
              <div className="t-equity-toggle">
                <label className="t-equity-label">
                  <input
                    type="checkbox"
                    checked={range.testHandsEquity ?? false}
                    onChange={e => {
                      const checked = e.target.checked;
                      const rangeHands = Object.keys(range.handActions);
                      if (checked) {
                        const borderline = getBorderlineHands(rangeHands);
                        patch({ testHandsEquity: true, testHands: [...new Set([...rangeHands, ...borderline])] });
                      } else {
                        patch({ testHandsEquity: false, testHands: rangeHands });
                      }
                    }}
                  />
                  <span>Borderline hands</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Right: controls */}
        <div className="t-builder-right">

          {/* 1. Active paint action */}
          <div className="t-builder-section">
            <div className="t-section-label">Paint with</div>
            <div className="t-paint-action-row">
              {FIXED_ACTIONS.map(a => (
                <button
                  key={a.id}
                  className={`t-paint-btn ${activeActionId === a.id ? 't-paint-btn--active' : ''}`}
                  style={activeActionId === a.id
                    ? { borderColor: a.color, background: a.color, color: '#fff' }
                    : { borderColor: a.color + '80', color: a.color }}
                  onClick={() => setActiveActionId(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <p className="t-hint">Drag to paint. Right-click to erase.</p>
          </div>

          {/* 2. Training defaults */}
          <div className="t-builder-section">
            <div className="t-section-label">Training defaults</div>

            <label className="t-field">
              <span>Position</span>
              <div className="t-position-grid">
                {POSITIONS.map(p => (
                  <button
                    key={p}
                    className={`t-pos-btn ${range.position === p ? 't-pos-btn--active' : ''}`}
                    onClick={() => patch({ position: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </label>

            <label className="t-field">
              <span>Stack depth (BB)</span>
              <div className="t-stack-presets">
                {STACK_PRESETS.map(s => (
                  <button
                    key={s}
                    className={`t-stack-btn ${range.stackDepthBB === s ? 't-stack-btn--active' : ''}`}
                    onClick={() => patch({ stackDepthBB: s })}
                  >
                    {s}
                  </button>
                ))}
                <input
                  type="number"
                  className="t-input t-input--sm t-stack-custom"
                  placeholder="Custom"
                  min={1}
                  max={500}
                  value={STACK_PRESETS.includes(range.stackDepthBB as typeof STACK_PRESETS[number]) ? '' : range.stackDepthBB}
                  onChange={e => patch({ stackDepthBB: parseInt(e.target.value) || 100 })}
                />
              </div>
            </label>

            <label className="t-field">
              <span>Opponents</span>
              <div className="t-opponents-row">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    className={`t-opp-btn ${range.opponents === n ? 't-opp-btn--active' : ''}`}
                    onClick={() => patch({ opponents: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
          </div>

          {/* 3. Opponent actions */}
          <PreflopActionEditor
            heroPosition={range.position}
            numOpponents={range.opponents}
            preflopSpot={range.preflopSpot ?? []}
            onChange={spot => patch({ preflopSpot: spot })}
          />

        </div>
      </div>
    </div>
  );
}
