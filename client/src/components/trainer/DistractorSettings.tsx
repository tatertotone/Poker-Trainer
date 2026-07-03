import { useState } from 'react';
import { X } from 'lucide-react';
import type { DistractorMode } from '../../types/trainer';
import { allHandLabels } from '../../utils/trainerUtils';

const ALL_HANDS = allHandLabels();

interface Props {
  mode: DistractorMode;
  manualDistractors: string[];
  onModeChange: (m: DistractorMode) => void;
  onManualChange: (hands: string[]) => void;
}

export default function DistractorSettings({ mode, manualDistractors, onModeChange, onManualChange }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addManual = () => {
    const hand = input.trim();
    if (!ALL_HANDS.includes(hand)) { setError(`"${hand}" is not a valid hand`); return; }
    if (manualDistractors.includes(hand)) { setError('Already added'); return; }
    onManualChange([...manualDistractors, hand]);
    setInput('');
    setError('');
  };

  return (
    <div className="t-distractor-settings">
      <div className="t-section-label">Distractor hands</div>
      <p className="t-hint">Controls which non-range hands appear as decoys during training.</p>

      <div className="t-radio-group">
        {([
          ['nearby', 'Similar equity (±5%)'],
          ['all', 'All non-range hands'],
          ['manual', 'Manual list'],
        ] as [DistractorMode, string][]).map(([val, label]) => (
          <label key={val} className="t-radio-label">
            <input
              type="radio"
              name="distractorMode"
              value={val}
              checked={mode === val}
              onChange={() => onModeChange(val)}
            />
            {label}
          </label>
        ))}
      </div>

      {mode === 'manual' && (
        <div className="t-manual-distractor">
          <div className="t-manual-input-row">
            <input
              className="t-input t-input--sm"
              placeholder="e.g. K9o"
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') addManual(); }}
            />
            <button className="t-btn t-btn--sm" onClick={addManual}>Add</button>
          </div>
          {error && <p className="t-error">{error}</p>}
          <div className="t-manual-tags">
            {manualDistractors.map(h => (
              <span key={h} className="t-tag">
                {h}
                <button onClick={() => onManualChange(manualDistractors.filter(x => x !== h))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
