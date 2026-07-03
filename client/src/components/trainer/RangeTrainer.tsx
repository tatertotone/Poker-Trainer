import { useState } from 'react';
import { Plus, Play, BarChart2, Pencil, Trash2, Target, Settings2, FlaskConical, CheckCircle2, AlertCircle } from 'lucide-react';
import type { RangeConfig, TrainerMode } from '../../types/trainer';
import { loadRanges, saveRanges, loadStats, POSITIONS, STACK_PRESETS } from '../../utils/trainerUtils';
import RangeBuilder from './RangeBuilder';
import TrainingSession from './TrainingSession';
import StatsView from './StatsView';
import MiniGrid from './MiniGrid';

type SubView = 'list' | 'builder' | 'train' | 'stats';

interface TrainCfg {
  opponents: number;
  stackBB: number;
  position: string;
  mode: TrainerMode;
}

export default function RangeTrainer() {
  const [view, setView] = useState<SubView>('list');
  const [ranges, setRanges] = useState<RangeConfig[]>(loadRanges);
  const [editingRange, setEditingRange] = useState<RangeConfig | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(() => loadRanges()[0]?.id ?? null);
  const [trainCfg, setTrainCfg] = useState<TrainCfg | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const persist = (next: RangeConfig[]) => { setRanges(next); saveRanges(next); };

  const handleSaveRange = (range: RangeConfig) => {
    const exists = ranges.find(r => r.id === range.id);
    const next = exists ? ranges.map(r => r.id === range.id ? range : r) : [...ranges, range];
    persist(next);
    setSelectedId(range.id);
    setView('list');
    setEditingRange(undefined);
  };

  const deleteRange = (id: string) => {
    if (!confirm('Delete this range?')) return;
    const next = ranges.filter(r => r.id !== id);
    persist(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const handleTestComplete = (passed: boolean) => {
    if (!passed || !selectedId) return;
    const next = ranges.map(r =>
      r.id === selectedId ? { ...r, passed: true } : r
    );
    persist(next);
  };

  const selectedRange = ranges.find(r => r.id === selectedId) ?? null;

  // ── Sub-views ─────────────────────────────────────────────────────────────

  if (view === 'builder') {
    return (
      <RangeBuilder
        initial={editingRange}
        onSave={handleSaveRange}
        onBack={() => { setView('list'); setEditingRange(undefined); }}
      />
    );
  }

  if (view === 'train' && trainCfg && selectedRange) {
    return (
      <TrainingSession
        range={selectedRange}
        opponents={trainCfg.opponents}
        stackBB={trainCfg.stackBB}
        position={trainCfg.position}
        mode={trainCfg.mode}
        onBack={() => setView('list')}
        onTestComplete={handleTestComplete}
      />
    );
  }

  if (view === 'stats' && selectedRange) {
    return (
      <StatsView
        range={selectedRange}
        onBack={() => setView('list')}
        onStatsChange={() => setRanges(loadRanges())}
      />
    );
  }

  // ── List view (two-panel) ─────────────────────────────────────────────────

  const allStats = loadStats();

  const startTraining = (range: RangeConfig, cfg: Partial<TrainCfg> & { mode: TrainerMode }) => {
    setSelectedId(range.id);
    setTrainCfg({
      opponents: cfg.opponents ?? range.opponents,
      stackBB: cfg.stackBB ?? range.stackDepthBB,
      position: cfg.position ?? range.position,
      mode: cfg.mode,
    });
    setView('train');
  };

  return (
    <div className="t-two-panel">

      {/* ── Sidebar ── */}
      <div className="t-sidebar">
        <div className="t-sidebar-header">
          <div className="t-sidebar-title">
            <Target size={16} className="t-sidebar-icon" />
            Ranges
          </div>
          <button
            className="t-icon-btn"
            title="New range"
            onClick={() => { setEditingRange(undefined); setView('builder'); }}
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="t-sidebar-list">
          {ranges.length === 0 ? (
            <div className="t-sidebar-empty">
              <p>No ranges yet.</p>
              <button
                className="t-btn t-btn--primary t-btn--sm"
                onClick={() => { setEditingRange(undefined); setView('builder'); }}
              >
                <Plus size={13} /> Create one
              </button>
            </div>
          ) : (
            ranges.map(range => {
              const stats = allStats[range.id];
              const pct = stats?.totalAttempts > 0
                ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
                : null;
              const isSelected = range.id === selectedId;

              return (
                <button
                  key={range.id}
                  className={`t-sidebar-item ${isSelected ? 't-sidebar-item--active' : ''}`}
                  onClick={() => setSelectedId(range.id)}
                >
                  <div className="t-sidebar-item-name">
                    {range.name}
                    {range.passed && (
                      <CheckCircle2 size={12} className="t-sidebar-passed-icon" />
                    )}
                  </div>
                  <div className="t-sidebar-item-meta">{range.position} · {range.stackDepthBB}BB</div>
                  {pct !== null && (
                    <span className={`t-sidebar-pct ${pct >= 80 ? 't-sidebar-pct--green' : pct >= 60 ? 't-sidebar-pct--yellow' : 't-sidebar-pct--red'}`}>
                      {pct}%
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="t-detail">
        {!selectedRange ? (
          <div className="t-empty">
            <Target size={48} className="t-empty-icon" />
            <p>Select a range to view details, or create a new one.</p>
            <button
              className="t-btn t-btn--primary"
              onClick={() => { setEditingRange(undefined); setView('builder'); }}
            >
              <Plus size={16} /> New range
            </button>
          </div>
        ) : (
          <DetailPanel
            range={selectedRange}
            stats={allStats[selectedRange.id]}
            onTrain={cfg => startTraining(selectedRange, cfg)}
            onEdit={() => { setEditingRange(selectedRange); setView('builder'); }}
            onStats={() => setView('stats')}
            onDelete={() => deleteRange(selectedRange.id)}
            configOpen={configOpen}
            onToggleConfig={() => setConfigOpen(o => !o)}
          />
        )}
      </div>
    </div>
  );
}

// ── Detail panel component ────────────────────────────────────────────────────

interface DetailProps {
  range: RangeConfig;
  stats?: ReturnType<typeof loadStats>[string];
  onTrain: (cfg: Partial<TrainCfg> & { mode: TrainerMode }) => void;
  onEdit: () => void;
  onStats: () => void;
  onDelete: () => void;
  configOpen: boolean;
  onToggleConfig: () => void;
}

function DetailPanel({ range, stats, onTrain, onEdit, onStats, onDelete, configOpen, onToggleConfig }: DetailProps) {
  const [opponents, setOpponents] = useState(range.opponents);
  const [stackBB, setStackBB] = useState(range.stackDepthBB);
  const [position, setPosition] = useState(range.position);

  // Reset local config when range changes
  const [lastRangeId, setLastRangeId] = useState(range.id);
  if (range.id !== lastRangeId) {
    setLastRangeId(range.id);
    setOpponents(range.opponents);
    setStackBB(range.stackDepthBB);
    setPosition(range.position);
  }

  const pct = stats && stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : null;
  const handCount = Object.keys(range.handActions).length;
  const mistakeCount = stats
    ? Object.values(stats.handStats).filter(s => s.total > 0 && (s.total - s.correct) / s.total > 0.05).length
    : 0;

  return (
    <div className="t-detail-inner">
      {/* Header */}
      <div className="t-detail-header">
        <div>
          <div className="t-detail-title-row">
            <h2 className="t-detail-title">{range.name}</h2>
            {range.passed && (
              <span className="t-passed-badge">
                <CheckCircle2 size={12} /> Passed
              </span>
            )}
          </div>
          <div className="t-detail-meta">
            {range.position} · {range.stackDepthBB}BB · {range.opponents}v1 · {handCount} hands
          </div>
          <div className="t-detail-chips">
            {range.actions.map(a => (
              <span key={a.id} className="t-action-chip" style={{ background: a.color }}>{a.name}</span>
            ))}
          </div>
        </div>
        <div className="t-detail-header-actions">
          <button className="t-icon-btn" title="Edit range" onClick={onEdit}><Pencil size={15} /></button>
          <button className="t-icon-btn" title="View stats" onClick={onStats}><BarChart2 size={15} /></button>
          <button className="t-icon-btn t-icon-btn--danger" title="Delete range" onClick={onDelete}><Trash2 size={15} /></button>
        </div>
      </div>

      {/* Grid + stats row */}
      <div className="t-detail-body">
        <div className="t-detail-grid-card">
          <div className="t-section-label">Range preview</div>
          <MiniGrid
            handActions={range.handActions}
            actions={range.actions}
            defaultActionId={range.defaultActionId}
          />
          <div className="t-detail-legend">
            {range.actions.map(a => (
              <span key={a.id} className="t-mini-legend-item">
                <span className="t-mini-legend-dot" style={{ background: a.color }} />
                {a.name}
              </span>
            ))}
          </div>
        </div>

        <div className="t-detail-stats">
          <div className={`t-stat-card ${pct !== null ? (pct >= 80 ? 't-stat-card--green' : pct >= 60 ? 't-stat-card--yellow' : 't-stat-card--red') : ''}`}>
            <span className="t-stat-num">{pct !== null ? `${pct}%` : '—'}</span>
            <span className="t-stat-label">Accuracy</span>
          </div>
          <div className="t-stat-card">
            <span className="t-stat-num">{stats?.totalAttempts ?? 0}</span>
            <span className="t-stat-label">Hands drilled</span>
          </div>
          <div className="t-stat-card">
            <span className="t-stat-num">{handCount}</span>
            <span className="t-stat-label">In range</span>
          </div>
        </div>
      </div>

      {/* Session config + launch buttons */}
      <div className="t-detail-train">
        <div className="t-detail-train-bar">
          <button
            className="t-btn t-btn--ghost t-btn--train"
            onClick={() => onTrain({ opponents, stackBB, position, mode: 'practice' })}
          >
            <Play size={15} /> Practice
          </button>
          <button
            className="t-btn t-btn--test"
            onClick={() => onTrain({ opponents, stackBB, position, mode: 'test' })}
          >
            <FlaskConical size={15} /> Test
          </button>
          <button
            className="t-btn t-btn--mistakes"
            disabled={mistakeCount === 0}
            title={mistakeCount === 0 ? 'No hands with >5% error rate yet' : `Drill ${mistakeCount} mistake hand${mistakeCount !== 1 ? 's' : ''}`}
            onClick={() => onTrain({ opponents, stackBB, position, mode: 'mistakes' })}
          >
            <AlertCircle size={15} /> Mistakes{mistakeCount > 0 ? ` (${mistakeCount})` : ''}
          </button>
          <button
            className={`t-icon-btn ${configOpen ? 't-icon-btn--active' : ''}`}
            title="Configure session"
            onClick={onToggleConfig}
          >
            <Settings2 size={15} />
          </button>
        </div>

        {configOpen && (
          <div className="t-detail-config">
            <div className="t-config-row">
              <div className="t-section-label">Position</div>
              <div className="t-pos-row">
                {POSITIONS.map(p => (
                  <button
                    key={p}
                    className={`t-pos-btn ${position === p ? 't-pos-btn--active' : ''}`}
                    onClick={() => setPosition(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="t-config-row">
              <div className="t-section-label">Stack (BB)</div>
              <div className="t-stack-row">
                {STACK_PRESETS.map(s => (
                  <button
                    key={s}
                    className={`t-stack-btn ${stackBB === s ? 't-stack-btn--active' : ''}`}
                    onClick={() => setStackBB(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="t-config-row">
              <div className="t-section-label">Opponents</div>
              <div className="t-opp-row">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <button
                    key={n}
                    className={`t-opp-btn ${opponents === n ? 't-opp-btn--active' : ''}`}
                    onClick={() => setOpponents(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
