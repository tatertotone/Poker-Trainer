import { useState, useMemo, useCallback } from 'react';
import { Plus, BookOpen, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const CARD_SUITS = ['s','h','d','c'] as const;
type CardSuit = typeof CARD_SUITS[number];
const SUIT_SYMBOL: Record<CardSuit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR: Record<CardSuit, string> = {
  s: 'var(--text-primary)',
  h: '#dc2626',
  d: '#2563eb',
  c: '#16a34a',
};

const STACK_PRESETS = [15, 25, 40, 60, 100, 150, 200];

function positionsForCount(n: number): string[] {
  const map: Record<number, string[]> = {
    2: ['BTN','BB'],
    3: ['BTN','SB','BB'],
    4: ['CO','BTN','SB','BB'],
    5: ['HJ','CO','BTN','SB','BB'],
    6: ['UTG','HJ','CO','BTN','SB','BB'],
    7: ['UTG','UTG+1','HJ','CO','BTN','SB','BB'],
    8: ['UTG','UTG+1','LJ','HJ','CO','BTN','SB','BB'],
    9: ['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'],
  };
  return map[n] ?? map[6];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StreetActionType =
  | '' | 'fold' | 'limp' | 'call' | 'raise' | 'check' | 'bet' | 'allin';

interface PlayerActionEntry {
  position: string;
  action: StreetActionType;
  amountBB: string;
}

interface StreetEntry {
  board: (string | null)[];
  actions: PlayerActionEntry[];
}

interface ReviewForm {
  numPlayers: number;
  stackBB: number;
  heroPosition: string;
  heroCard1: string | null;
  heroCard2: string | null;
  preflopActions: PlayerActionEntry[];
  flop: StreetEntry;
  turn: StreetEntry;
  river: StreetEntry;
  notes: string;
}

interface SavedReview {
  id: string;
  savedAt: number;
  form: ReviewForm;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hr-reviews-v1';

function loadSaved(): SavedReview[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function persistSaved(reviews: SavedReview[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActions(positions: string[]): PlayerActionEntry[] {
  return positions.map(pos => ({ position: pos, action: '' as StreetActionType, amountBB: '' }));
}

function makeStreet(positions: string[], boardSlots: number): StreetEntry {
  return { board: Array(boardSlots).fill(null), actions: makeActions(positions) };
}

function defaultForm(): ReviewForm {
  const n = 6;
  const pos = positionsForCount(n);
  return {
    numPlayers: n,
    stackBB: 100,
    heroPosition: 'BTN',
    heroCard1: null,
    heroCard2: null,
    preflopActions: makeActions(pos),
    flop: makeStreet(pos, 3),
    turn: makeStreet(pos, 1),
    river: makeStreet(pos, 1),
    notes: '',
  };
}

function reviewTitle(form: ReviewForm): string {
  return `${form.heroPosition} · ${form.stackBB}BB · ${form.numPlayers}-handed`;
}

// ── Slot key helpers ──────────────────────────────────────────────────────────

type SlotKey = 'hero1' | 'hero2' | `flop-${number}` | 'turn-0' | 'river-0';

function slotLabel(key: SlotKey): string {
  if (key === 'hero1') return 'Hero card 1';
  if (key === 'hero2') return 'Hero card 2';
  if (key === 'turn-0') return 'Turn card';
  if (key === 'river-0') return 'River card';
  const idx = parseInt(key.split('-')[1]) + 1;
  return `Flop card ${idx}`;
}

// ── Card slot (simple button, no internal popup) ──────────────────────────────

function CardSlot({ slotKey, value, isActive, onFocus, onClear }: {
  slotKey: SlotKey;
  value: string | null;
  isActive: boolean;
  onFocus: (key: SlotKey) => void;
  onClear: () => void;
}) {
  if (value) {
    const rank = value.slice(0, -1);
    const suit = value.slice(-1) as CardSuit;
    return (
      <button
        className={`hr-card-slot hr-card-slot--filled ${isActive ? 'hr-card-slot--active' : ''}`}
        style={{ color: SUIT_COLOR[suit] }}
        onClick={() => onFocus(slotKey)}
      >
        {rank}<span className="hr-card-suit">{SUIT_SYMBOL[suit]}</span>
        <span className="hr-card-x" onClick={e => { e.stopPropagation(); onClear(); }}>×</span>
      </button>
    );
  }
  return (
    <button
      className={`hr-card-slot hr-card-slot--empty ${isActive ? 'hr-card-slot--active' : ''}`}
      onClick={() => onFocus(slotKey)}
    >
      +
    </button>
  );
}

// ── Card picker panel (right side) ────────────────────────────────────────────

function CardPickerPanel({ activeKey, value, usedCards, onChange, onClose, isHeroSlot }: {
  activeKey: SlotKey;
  value: string | null;
  usedCards: string[];
  onChange: (card: string | null) => void;
  onClose: () => void;
  isHeroSlot?: boolean;
}) {
  const [pickRank, setPickRank] = useState<string | null>(null);

  const header = (
    <div className="hr-picker-header">
      <span className="hr-picker-label">{slotLabel(activeKey)}</span>
      <div className="hr-picker-header-actions">
        {value && (
          <button className="hr-picker-clear" onClick={() => { onChange(null); setPickRank(null); }}>
            Clear
          </button>
        )}
        <button className="hr-picker-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );

  const currentCard = value && (
    <div className="hr-picker-current">
      <span style={{ color: SUIT_COLOR[value.slice(-1) as CardSuit], fontSize: '1.5rem', fontWeight: 800 }}>
        {value.slice(0, -1)}{SUIT_SYMBOL[value.slice(-1) as CardSuit]}
      </span>
      <span className="hr-picker-current-label">selected — pick another or close</span>
    </div>
  );

  if (isHeroSlot) {
    return (
      <div className="hr-picker-panel">
        {header}
        {currentCard}
        <div className="hr-full-deck">
          <div className="hr-deck-suit-headers">
            {CARD_SUITS.map(s => (
              <span key={s} className="hr-deck-suit-hdr" style={{ color: SUIT_COLOR[s] }}>
                {SUIT_SYMBOL[s]}
              </span>
            ))}
          </div>
          {CARD_RANKS.map(r => (
            <div key={r} className="hr-deck-rank-row">
              {CARD_SUITS.map(s => {
                const card = r + s;
                const disabled = usedCards.includes(card);
                const selected = value === card;
                return (
                  <button
                    key={s}
                    className={`hr-deck-card ${disabled ? 'hr-deck-card--used' : ''} ${selected ? 'hr-deck-card--selected' : ''}`}
                    style={{ color: disabled ? undefined : SUIT_COLOR[s] }}
                    disabled={disabled}
                    onClick={() => onChange(card)}
                  >
                    {r}<span className="hr-deck-card-suit">{SUIT_SYMBOL[s]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSuit = (s: CardSuit) => {
    onChange(pickRank + s);
    setPickRank(null);
  };

  return (
    <div className="hr-picker-panel">
      {header}
      {currentCard}

      <div className="hr-picker-section-label">Select rank</div>
      <div className="hr-rank-grid">
        {CARD_RANKS.map(r => (
          <button
            key={r}
            className={`hr-rank-btn ${pickRank === r ? 'hr-rank-btn--sel' : ''}`}
            onClick={() => setPickRank(r === pickRank ? null : r)}
          >
            {r}
          </button>
        ))}
      </div>

      {pickRank ? (
        <>
          <div className="hr-picker-section-label">Select suit</div>
          <div className="hr-suit-row">
            {CARD_SUITS.map(s => {
              const card = pickRank + s;
              const disabled = usedCards.includes(card);
              return (
                <button
                  key={s}
                  className={`hr-suit-btn ${disabled ? 'hr-suit-btn--used' : ''}`}
                  style={{ color: SUIT_COLOR[s] }}
                  disabled={disabled}
                  onClick={() => handleSuit(s)}
                >
                  {SUIT_SYMBOL[s]}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="hr-picker-hint">
          {!value && 'Pick a rank, then a suit'}
        </div>
      )}
    </div>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

const PREFLOP_BTNS: { label: string; value: StreetActionType }[] = [
  { label: 'Fold', value: 'fold' },
  { label: 'Limp', value: 'limp' },
  { label: 'Call', value: 'call' },
  { label: 'Raise', value: 'raise' },
  { label: 'All-in', value: 'allin' },
];

const POSTFLOP_BTNS: { label: string; value: StreetActionType }[] = [
  { label: 'Fold', value: 'fold' },
  { label: 'Check', value: 'check' },
  { label: 'Call', value: 'call' },
  { label: 'Bet', value: 'bet' },
  { label: 'Raise', value: 'raise' },
  { label: 'All-in', value: 'allin' },
];

function ActionRow({ entry, isPreflop, isHero, onChange }: {
  entry: PlayerActionEntry;
  isPreflop: boolean;
  isHero: boolean;
  onChange: (u: PlayerActionEntry) => void;
}) {
  const btns = isPreflop ? PREFLOP_BTNS : POSTFLOP_BTNS;
  const needsAmount = entry.action === 'raise' || entry.action === 'bet';

  return (
    <div className={`hr-action-row ${isHero ? 'hr-action-row--hero' : ''}`}>
      <div className="hr-action-pos">
        {entry.position}
        {isHero && <span className="hr-hero-tag">YOU</span>}
      </div>
      <div className="hr-action-btns">
        {btns.map(b => (
          <button key={b.value}
            className={`hr-action-btn hr-action-btn--${b.value} ${entry.action === b.value ? 'hr-action-btn--active' : ''}`}
            onClick={() => onChange({ ...entry, action: entry.action === b.value ? '' : b.value, amountBB: '' })}>
            {b.label}
          </button>
        ))}
        {needsAmount && (
          <input className="hr-amount-input" type="number" placeholder="BB" min={0} step={0.5}
            value={entry.amountBB}
            onChange={e => onChange({ ...entry, amountBB: e.target.value })} />
        )}
      </div>
    </div>
  );
}

// ── Street section ─────────────────────────────────────────────────────────────

function StreetSection({ label, open, onToggle, boardSlots, streetData, isPreflop, heroPosition,
  streetKey, activeSlotKey, onSlotFocus, onBoardChange, onActionChange }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  boardSlots: number;
  streetData: StreetEntry;
  isPreflop: boolean;
  heroPosition: string;
  streetKey?: 'flop' | 'turn' | 'river';
  activeSlotKey?: SlotKey | null;
  onSlotFocus?: (key: SlotKey) => void;
  onBoardChange?: (idx: number, card: string | null) => void;
  onActionChange: (idx: number, updated: PlayerActionEntry) => void;
}) {
  return (
    <section className="hr-section hr-section--street">
      <button className="hr-street-toggle" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="hr-street-label">{label}</span>
        {!isPreflop && boardSlots > 0 && (
          <span className="hr-street-board-preview">
            {streetData.board.map((c, i) =>
              c ? <span key={i} style={{ color: SUIT_COLOR[c.slice(-1) as CardSuit] }}>{c.slice(0,-1)}{SUIT_SYMBOL[c.slice(-1) as CardSuit]}</span>
                : <span key={i} className="hr-board-empty-dot">?</span>
            )}
          </span>
        )}
      </button>

      {open && (
        <div className="hr-street-body">
          {!isPreflop && boardSlots > 0 && onBoardChange && onSlotFocus && streetKey && (
            <div className="hr-board-row">
              <span className="hr-board-label">Board:</span>
              {streetData.board.map((card, idx) => {
                const key = `${streetKey}-${idx}` as SlotKey;
                return (
                  <CardSlot
                    key={idx}
                    slotKey={key}
                    value={card}
                    isActive={activeSlotKey === key}
                    onFocus={onSlotFocus}
                    onClear={() => onBoardChange(idx, null)}
                  />
                );
              })}
            </div>
          )}
          <div className="hr-action-list">
            {streetData.actions.map((entry, i) => (
              <ActionRow
                key={entry.position}
                entry={entry}
                isPreflop={isPreflop}
                isHero={entry.position === heroPosition}
                onChange={updated => onActionChange(i, updated)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HandReview() {
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>(loadSaved);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm>(defaultForm);
  const [activeSlotKey, setActiveSlotKey] = useState<SlotKey | null>(null);

  const [openPreflop, setOpenPreflop] = useState(true);
  const [openFlop, setOpenFlop] = useState(false);
  const [openTurn, setOpenTurn] = useState(false);
  const [openRiver, setOpenRiver] = useState(false);

  const positions = useMemo(() => positionsForCount(form.numPlayers), [form.numPlayers]);

  const usedCards = useMemo(() => {
    const cards: string[] = [];
    if (form.heroCard1) cards.push(form.heroCard1);
    if (form.heroCard2) cards.push(form.heroCard2);
    form.flop.board.forEach(c => { if (c) cards.push(c); });
    if (form.turn.board[0]) cards.push(form.turn.board[0]!);
    if (form.river.board[0]) cards.push(form.river.board[0]!);
    return cards;
  }, [form]);

  const patch = useCallback((updates: Partial<ReviewForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  // Resolve slot key → current value
  const getSlotValue = (key: SlotKey): string | null => {
    if (key === 'hero1') return form.heroCard1;
    if (key === 'hero2') return form.heroCard2;
    if (key === 'turn-0') return form.turn.board[0];
    if (key === 'river-0') return form.river.board[0];
    const idx = parseInt(key.split('-')[1]);
    return form.flop.board[idx];
  };

  // Resolve slot key → setter
  const setSlotValue = (key: SlotKey, card: string | null) => {
    if (key === 'hero1') { patch({ heroCard1: card }); return; }
    if (key === 'hero2') { patch({ heroCard2: card }); return; }
    if (key === 'turn-0') { updateBoard('turn', 0, card); return; }
    if (key === 'river-0') { updateBoard('river', 0, card); return; }
    const idx = parseInt(key.split('-')[1]);
    updateBoard('flop', idx, card);
  };

  // Used cards for the picker (excludes the currently active slot's own card)
  const pickerUsedCards = useMemo(() => {
    if (!activeSlotKey) return usedCards;
    const ownCard = getSlotValue(activeSlotKey);
    return usedCards.filter(c => c !== ownCard);
  }, [usedCards, activeSlotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotFocus = (key: SlotKey) => {
    setActiveSlotKey(prev => prev === key ? null : key);
  };

  const setNumPlayers = (n: number) => {
    const pos = positionsForCount(n);
    const heroPos = pos.includes(form.heroPosition) ? form.heroPosition : pos[Math.max(0, pos.length - 3)];
    patch({
      numPlayers: n,
      heroPosition: heroPos,
      preflopActions: makeActions(pos),
      flop: makeStreet(pos, 3),
      turn: makeStreet(pos, 1),
      river: makeStreet(pos, 1),
    });
  };

  const updatePreflopAction = (i: number, updated: PlayerActionEntry) => {
    const next = [...form.preflopActions];
    next[i] = updated;
    patch({ preflopActions: next });
  };

  const updateStreetAction = (street: 'flop' | 'turn' | 'river', i: number, updated: PlayerActionEntry) => {
    const prev = form[street];
    const actions = [...prev.actions];
    actions[i] = updated;
    patch({ [street]: { ...prev, actions } });
  };

  const updateBoard = (street: 'flop' | 'turn' | 'river', slotIdx: number, card: string | null) => {
    const prev = form[street];
    const board = [...prev.board];
    board[slotIdx] = card;
    patch({ [street]: { ...prev, board } });
  };

  const saveReview = () => {
    const isUpdate = selectedId !== null;
    const review: SavedReview = {
      id: selectedId ?? Date.now().toString(),
      savedAt: Date.now(),
      form: { ...form },
    };
    const next = isUpdate
      ? savedReviews.map(r => r.id === selectedId ? review : r)
      : [review, ...savedReviews];
    setSavedReviews(next);
    persistSaved(next);
    setSelectedId(review.id);
  };

  const loadReview = (id: string) => {
    const r = savedReviews.find(rv => rv.id === id);
    if (r) { setForm({ ...r.form }); setSelectedId(id); setActiveSlotKey(null); }
  };

  const deleteReview = (id: string) => {
    if (!confirm('Delete this hand review?')) return;
    const next = savedReviews.filter(r => r.id !== id);
    setSavedReviews(next);
    persistSaved(next);
    if (selectedId === id) { setSelectedId(null); setForm(defaultForm()); }
  };

  const newReview = () => {
    setSelectedId(null);
    setForm(defaultForm());
    setActiveSlotKey(null);
    setOpenPreflop(true);
    setOpenFlop(false);
    setOpenTurn(false);
    setOpenRiver(false);
  };

  return (
    <div className="t-two-panel">

      {/* ── Sidebar ── */}
      <div className="t-sidebar">
        <div className="t-sidebar-header">
          <div className="t-sidebar-title">
            <BookOpen size={16} className="t-sidebar-icon" />
            Hand Reviews
          </div>
          <button className="t-icon-btn" title="New hand" onClick={newReview}>
            <Plus size={15} />
          </button>
        </div>

        <div className="t-sidebar-list">
          {savedReviews.length === 0 ? (
            <div className="t-sidebar-empty">
              <p>No saved hands yet.</p>
              <p style={{ fontSize: '0.72rem' }}>Fill in a hand and click Save.</p>
            </div>
          ) : (
            savedReviews.map(r => (
              <button
                key={r.id}
                className={`t-sidebar-item ${selectedId === r.id ? 't-sidebar-item--active' : ''}`}
                onClick={() => loadReview(r.id)}
              >
                <div className="t-sidebar-item-name">{reviewTitle(r.form)}</div>
                <div className="t-sidebar-item-meta">
                  {new Date(r.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {r.form.notes ? ` · ${r.form.notes.slice(0, 28)}${r.form.notes.length > 28 ? '…' : ''}` : ''}
                </div>
                <span className="hr-sidebar-delete"
                  role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); deleteReview(r.id); }}
                  title="Delete">
                  <Trash2 size={11} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Detail + picker panel ── */}
      <div className="t-detail hr-detail-split">

        {/* Form column */}
        <div className="hr-form-col">
          <div className="t-detail-inner hr-form">

            <div className="t-detail-header">
              <div>
                <h2 className="t-detail-title">
                  {selectedId ? reviewTitle(form) : 'New Hand Review'}
                </h2>
                <div className="t-detail-meta">Log a hand you played for future reference</div>
              </div>
              <div className="t-detail-header-actions">
                <button className="t-btn t-btn--primary" onClick={saveReview}>
                  {selectedId ? 'Update' : 'Save Hand'}
                </button>
              </div>
            </div>

            {/* Table Settings */}
            <section className="hr-section">
              <div className="t-section-label">Table Settings</div>
              <div className="hr-settings-grid">

                <div className="hr-field">
                  <div className="hr-field-label">Players at table</div>
                  <div className="hr-btn-row">
                    {[2,3,4,5,6,7,8,9].map(n => (
                      <button key={n}
                        className={`t-opp-btn ${form.numPlayers === n ? 't-opp-btn--active' : ''}`}
                        onClick={() => setNumPlayers(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hr-field">
                  <div className="hr-field-label">Effective stack (BB)</div>
                  <div className="hr-btn-row">
                    {STACK_PRESETS.map(s => (
                      <button key={s}
                        className={`t-stack-btn ${form.stackBB === s ? 't-stack-btn--active' : ''}`}
                        onClick={() => patch({ stackBB: s })}>
                        {s}
                      </button>
                    ))}
                    <input
                      className="hr-custom-stack"
                      type="number"
                      placeholder="Custom"
                      min={1}
                      step={1}
                      value={STACK_PRESETS.includes(form.stackBB) ? '' : form.stackBB}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) patch({ stackBB: v }); }}
                    />
                  </div>
                </div>

                <div className="hr-field">
                  <div className="hr-field-label">My position (Hero)</div>
                  <div className="hr-btn-row">
                    {positions.map(p => (
                      <button key={p}
                        className={`t-pos-btn ${form.heroPosition === p ? 't-pos-btn--active' : ''}`}
                        onClick={() => patch({ heroPosition: p })}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </section>

            {/* Hero's Cards */}
            <section className="hr-section">
              <div className="t-section-label">My Hole Cards</div>
              <div className="hr-hole-cards">
                <CardSlot
                  slotKey="hero1"
                  value={form.heroCard1}
                  isActive={activeSlotKey === 'hero1'}
                  onFocus={handleSlotFocus}
                  onClear={() => patch({ heroCard1: null })}
                />
                <CardSlot
                  slotKey="hero2"
                  value={form.heroCard2}
                  isActive={activeSlotKey === 'hero2'}
                  onFocus={handleSlotFocus}
                  onClear={() => patch({ heroCard2: null })}
                />
                {form.heroCard1 && form.heroCard2 && (
                  <span className="hr-hand-label">
                    {form.heroCard1.slice(0,-1)}{form.heroCard2.slice(0,-1)}
                    {form.heroCard1.slice(-1) === form.heroCard2.slice(-1) ? 's' : 'o'}
                  </span>
                )}
              </div>
            </section>

            {/* Street sections */}
            <StreetSection
              label="Preflop"
              open={openPreflop}
              onToggle={() => setOpenPreflop(o => !o)}
              boardSlots={0}
              streetData={{ board: [], actions: form.preflopActions }}
              isPreflop={true}
              heroPosition={form.heroPosition}
              onActionChange={updatePreflopAction}
            />

            <StreetSection
              label="Flop"
              open={openFlop}
              onToggle={() => setOpenFlop(o => !o)}
              boardSlots={3}
              streetData={form.flop}
              isPreflop={false}
              heroPosition={form.heroPosition}
              streetKey="flop"
              activeSlotKey={activeSlotKey}
              onSlotFocus={handleSlotFocus}
              onBoardChange={(idx, c) => updateBoard('flop', idx, c)}
              onActionChange={(i, u) => updateStreetAction('flop', i, u)}
            />

            <StreetSection
              label="Turn"
              open={openTurn}
              onToggle={() => setOpenTurn(o => !o)}
              boardSlots={1}
              streetData={form.turn}
              isPreflop={false}
              heroPosition={form.heroPosition}
              streetKey="turn"
              activeSlotKey={activeSlotKey}
              onSlotFocus={handleSlotFocus}
              onBoardChange={(idx, c) => updateBoard('turn', idx, c)}
              onActionChange={(i, u) => updateStreetAction('turn', i, u)}
            />

            <StreetSection
              label="River"
              open={openRiver}
              onToggle={() => setOpenRiver(o => !o)}
              boardSlots={1}
              streetData={form.river}
              isPreflop={false}
              heroPosition={form.heroPosition}
              streetKey="river"
              activeSlotKey={activeSlotKey}
              onSlotFocus={handleSlotFocus}
              onBoardChange={(idx, c) => updateBoard('river', idx, c)}
              onActionChange={(i, u) => updateStreetAction('river', i, u)}
            />

            {/* Notes */}
            <section className="hr-section">
              <div className="t-section-label">Notes</div>
              <textarea
                className="hr-notes"
                placeholder="What happened? What were you thinking? What are you unsure about?"
                value={form.notes}
                rows={4}
                onChange={e => patch({ notes: e.target.value })}
              />
            </section>

            <div className="hr-form-footer">
              <button className="t-btn t-btn--primary" onClick={saveReview}>
                {selectedId ? 'Update Hand' : 'Save Hand'}
              </button>
              {selectedId && (
                <button className="t-btn t-btn--ghost" onClick={newReview}>
                  + New Hand
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Card picker panel */}
        <div className={`hr-picker-col ${activeSlotKey ? 'hr-picker-col--active' : ''}`}>
          {activeSlotKey ? (
            <CardPickerPanel
              activeKey={activeSlotKey}
              value={getSlotValue(activeSlotKey)}
              usedCards={pickerUsedCards}
              onChange={card => setSlotValue(activeSlotKey, card)}
              onClose={() => setActiveSlotKey(null)}
              isHeroSlot={activeSlotKey === 'hero1' || activeSlotKey === 'hero2'}
            />
          ) : (
            <div className="hr-picker-idle">
              <div className="hr-picker-idle-icon">🃏</div>
              <p>Click any card slot to pick a card</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
