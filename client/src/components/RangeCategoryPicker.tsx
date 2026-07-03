import type { Card, StreetName } from '../types/poker';

// ── Board analysis ────────────────────────────────────────────────────────────

const RANK_VALS: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

function boardInfo(board: Card[]) {
  const suitCounts: Record<string, number> = {};
  const rankCounts: Record<string, number> = {};
  for (const c of board) {
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
    rankCounts[c.rank] = (rankCounts[c.rank] ?? 0) + 1;
  }
  const maxSuit = board.length ? Math.max(...Object.values(suitCounts)) : 0;
  const maxRank = board.length ? Math.max(...Object.values(rankCounts)) : 0;
  const rankVals = [...new Set(board.map(c => RANK_VALS[c.rank]))].sort((a, b) => a - b);

  let straightPossible = false;
  if (board.length >= 3) {
    for (let i = 0; i < rankVals.length - 1; i++) {
      if (rankVals[i + 1] - rankVals[i] <= 4) { straightPossible = true; break; }
    }
  }

  return {
    flushDraw: maxSuit >= 2,
    madeFlush: maxSuit >= 3,
    paired: maxRank >= 2,
    trips: maxRank >= 3,
    straightPossible,
  };
}

// ── Category definitions ──────────────────────────────────────────────────────

type Group = 'nuts' | 'pair' | 'draw' | 'air';

interface CategoryDef {
  label: string;
  group: Group;
}

function getCategories(street: StreetName, board: Card[]): CategoryDef[] {
  if (street === 'preflop') {
    return [
      { label: 'Premium pairs (TT+)', group: 'nuts' },
      { label: 'Strong aces (AK, AQ)', group: 'nuts' },
      { label: 'Mid pairs (66–99)', group: 'pair' },
      { label: 'Suited aces (A2s+)', group: 'pair' },
      { label: 'Suited broadways (KQs–JTs)', group: 'pair' },
      { label: 'Offsuit broadways (AJo+, KQo)', group: 'pair' },
      { label: 'Small pairs (22–55)', group: 'draw' },
      { label: 'Suited connectors (T9s–54s)', group: 'draw' },
      { label: 'Suited gappers (J9s, T8s…)', group: 'draw' },
      { label: 'Weak / speculative', group: 'air' },
    ];
  }

  const info = boardInfo(board);
  const isFlop = street === 'flop';
  const isRiver = street === 'river';
  const cats: CategoryDef[] = [];

  // Nuts tier
  if (info.madeFlush)       cats.push({ label: 'Flushes', group: 'nuts' });
  if (info.straightPossible) cats.push({ label: 'Straights', group: 'nuts' });
  if (info.trips)            cats.push({ label: 'Quads', group: 'nuts' });
  if (info.paired)           cats.push({ label: 'Full houses', group: 'nuts' });
  cats.push({ label: 'Sets / Two pair', group: 'nuts' });
  if (info.paired)           cats.push({ label: 'Trips', group: 'nuts' });

  // Pair tier
  cats.push({ label: 'Overpairs', group: 'pair' });
  cats.push({ label: 'Top pair (good kicker)', group: 'pair' });
  cats.push({ label: 'Weak one-pair (mid/bottom pair)', group: 'pair' });
  cats.push({ label: 'Underpairs', group: 'pair' });

  // Draw tier (not river)
  if (!isRiver) {
    cats.push({ label: 'Combo draws', group: 'draw' });
    cats.push({ label: 'Strong draws (OESD / nut flush draw)', group: 'draw' });
    if (info.flushDraw) cats.push({ label: 'Weak flush draws', group: 'draw' });
    cats.push({ label: 'Gutshots', group: 'draw' });
    if (isFlop) cats.push({ label: 'Backdoor draws', group: 'draw' });
  }

  cats.push({ label: 'Air / pure bluffs', group: 'air' });
  return cats;
}

// ── Group metadata ────────────────────────────────────────────────────────────

const GROUP_META: Record<Group, { preflop: string; postflop: string; color: string; dimColor: string }> = {
  nuts: { preflop: 'Premium hands',       postflop: 'Strong made hands', color: '#f59e0b', dimColor: '#78350f' },
  pair: { preflop: 'Strong / Playable',   postflop: 'One-pair hands',    color: '#3b82f6', dimColor: '#1e3a5f' },
  draw: { preflop: 'Speculative',         postflop: 'Drawing hands',     color: '#a78bfa', dimColor: '#3b1f6e' },
  air:  { preflop: 'Weak / Bluffs',       postflop: 'Air / Bluffs',      color: '#f87171', dimColor: '#7f1d1d' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  street: StreetName;
  board: Card[];
  selected: Set<string>;
  previousSelected?: Set<string>;
  onChange: (cats: Set<string>) => void;
  locked?: boolean;
}

export default function RangeCategoryPicker({
  street, board, selected, previousSelected, onChange, locked = false,
}: Props) {
  const categories = getCategories(street, board);
  const isPreflop = street === 'preflop';

  const groups = (['nuts', 'pair', 'draw', 'air'] as const)
    .map(g => ({
      key: g,
      label: isPreflop ? GROUP_META[g].preflop : GROUP_META[g].postflop,
      color: GROUP_META[g].color,
      dimColor: GROUP_META[g].dimColor,
      cats: categories.filter(c => c.group === g),
    }))
    .filter(g => g.cats.length > 0);

  const toggle = (label: string) => {
    if (locked) return;
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(next);
  };

  // Previous street's categories that are still valid this street
  const prevLabels = previousSelected
    ? categories.filter(c => previousSelected.has(c.label)).map(c => c.label)
    : [];

  return (
    <div className="rcp-wrapper">
      <div className="rcp-header">
        <span className="rcp-title">Villain's Range</span>
        <span className="rcp-count">
          {selected.size} categor{selected.size === 1 ? 'y' : 'ies'} selected
        </span>
      </div>

      {!locked && !isPreflop && prevLabels.length > 0 && (
        <div className="rcp-prev-note">
          Last street: {prevLabels.join(', ')}
        </div>
      )}

      <div className="rcp-groups">
        {groups.map(g => (
          <div key={g.key} className="rcp-group">
            <div className="rcp-group-label" style={{ color: g.color }}>{g.label}</div>
            <div className="rcp-chips">
              {g.cats.map(cat => {
                const isSelected = selected.has(cat.label);
                return (
                  <button
                    key={cat.label}
                    className={`rcp-chip ${isSelected ? 'rcp-chip--selected' : ''}`}
                    style={isSelected
                      ? { borderColor: g.color, color: g.color, background: `${g.dimColor}99` }
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
        ))}
      </div>

      {selected.size === 0 && !locked && (
        <div className="rcp-empty-hint">
          Select the hand types you think villain holds on this street
        </div>
      )}
    </div>
  );
}
