import { PREFLOP_EQUITY } from '../data/equity';
import type { RangeConfig, TrainingHand, TrainingCard, DistractorMode, RangeAction } from '../types/trainer';

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;
export const POSITIONS = ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export const STACK_PRESETS = [15, 25, 40, 60, 100, 150, 200] as const;

// Fixed actions — always Raise / Fold / Call with stable IDs
export const FIXED_ACTIONS: RangeAction[] = [
  { id: 'raise', name: 'Raise', color: '#f97316' },
  { id: 'fold',  name: 'Fold',  color: '#388bfd' },
  { id: 'call',  name: 'Call',  color: '#4ade80' },
];

export const ACTION_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f97316',
  '#a855f7', '#eab308', '#06b6d4', '#ec4899',
];

export function cellLabel(rowIdx: number, colIdx: number): string {
  const r = RANKS[rowIdx];
  const c = RANKS[colIdx];
  if (rowIdx === colIdx) return `${r}${c}`;
  if (rowIdx < colIdx) return `${r}${c}s`;
  return `${c}${r}o`;
}

export function allHandLabels(): string[] {
  const out: string[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      out.push(cellLabel(r, c));
    }
  }
  return out;
}

// ── Shortcut hand sets ────────────────────────────────────────────────────────

export function suitedAxHands(): string[] {
  const out: string[] = [];
  for (let c = 1; c < 13; c++) out.push(cellLabel(0, c)); // row=0 (Ace), col>0, upper triangle
  return out;
}

export function pocketPairHands(): string[] {
  return RANKS.map((_, i) => cellLabel(i, i));
}

export function suitedBroadwayHands(): string[] {
  const out: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = r + 1; c < 5; c++) out.push(cellLabel(r, c));
  }
  return out;
}

export function offsuitBroadwayHands(): string[] {
  const out: string[] = [];
  for (let r = 1; r < 5; r++) {
    for (let c = 0; c < r; c++) out.push(cellLabel(r, c));
  }
  // Also include row-0 offsuit broadways (AKo, AQo, AJo, ATo)
  for (let c = 0; c < 5; c++) {
    if (c === 0) continue;
    out.push(cellLabel(c, 0)); // lower triangle from Ace column
  }
  return [...new Set(out)];
}

// ── Distractor generation ─────────────────────────────────────────────────────

// Returns the non-range hands that are directly adjacent (8-connected) to any
// range hand in the 13×13 grid — the natural "one step outside the range" set.
export function getBorderlineHands(rangeHands: string[]): string[] {
  const inRange = new Set(rangeHands);
  const borderline = new Set<string>();

  for (const hand of rangeHands) {
    // Determine grid position of this hand
    let r = -1, c = -1;
    outer:
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        if (cellLabel(row, col) === hand) { r = row; c = col; break outer; }
      }
    }
    if (r < 0) continue;

    // All 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 13 && nc >= 0 && nc < 13) {
          const neighbor = cellLabel(nr, nc);
          if (!inRange.has(neighbor)) borderline.add(neighbor);
        }
      }
    }
  }

  return [...borderline];
}

// Legacy equity-based distractor lookup (kept for buildDistractorPool)
export function getNearbyDistractors(
  rangeHands: string[],
  allDistractors: string[],
  threshold = 0.002,
): string[] {
  const rangeEquities = rangeHands.map(h => PREFLOP_EQUITY[h] ?? 0.5);
  return allDistractors.filter(h => {
    const eq = PREFLOP_EQUITY[h] ?? 0.5;
    return rangeEquities.some(re => Math.abs(eq - re) <= threshold);
  });
}

export function buildDistractorPool(
  range: RangeConfig,
  modeOverride?: DistractorMode,
): string[] {
  const inRange = new Set(Object.keys(range.handActions));
  const notInRange = allHandLabels().filter(h => !inRange.has(h));
  const mode = modeOverride ?? range.distractorMode;

  if (mode === 'all') return notInRange;
  if (mode === 'manual') return range.manualDistractors.filter(h => !inRange.has(h));
  // nearby
  return getNearbyDistractors(Object.keys(range.handActions), notInRange);
}

// ── Card dealing ──────────────────────────────────────────────────────────────

function randomSuit(exclude: string[] = []): TrainingCard['suit'] {
  const available = SUITS.filter(s => !exclude.includes(s));
  return available[Math.floor(Math.random() * available.length)];
}

export function dealHoleCards(label: string): [TrainingCard, TrainingCard] {
  const isPair = label.length === 2 && label[0] === label[1];
  const isSuited = label.endsWith('s');

  if (isPair) {
    const rank = label[0];
    const s1 = randomSuit();
    const s2 = randomSuit([s1]);
    return [{ rank, suit: s1 }, { rank, suit: s2 }];
  }

  const rank1 = label[0];
  const rank2 = label[1];

  if (isSuited) {
    const suit = randomSuit();
    return [{ rank: rank1, suit }, { rank: rank2, suit }];
  }

  // offsuit
  const s1 = randomSuit();
  const s2 = randomSuit([s1]);
  return [{ rank: rank1, suit: s1 }, { rank: rank2, suit: s2 }];
}

// ── Training hand picker ──────────────────────────────────────────────────────

export function pickTrainingHand(
  range: RangeConfig,
  distractorPool: string[],
): TrainingHand {
  const allRangeHands = Object.keys(range.handActions);

  // Use testHands if painted (equity expansion already applied at selection time in builder)
  const testHands = range.testHands ?? [];
  const drillPool = testHands.length > 0 ? testHands : allRangeHands;

  const useDistractor = distractorPool.length > 0 && Math.random() < 0.35;
  if (useDistractor) {
    const label = distractorPool[Math.floor(Math.random() * distractorPool.length)];
    return { label, actionId: null, cards: dealHoleCards(label) };
  }

  const label = drillPool[Math.floor(Math.random() * drillPool.length)];
  // Hands not explicitly painted default to fold — they're still part of the range
  const actionId = range.handActions[label] ?? 'fold';
  return { label, actionId, cards: dealHoleCards(label) };
}

// ── Shuffle ───────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Table seat utilities ──────────────────────────────────────────────────────

// Seats in clockwise order from BTN, for N-player tables
export const SEATS_CLOCKWISE: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

// Standard preflop action order (first to last)
export const PREFLOP_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

// Returns positions that voluntarily act before hero, in preflop order
export function positionsBeforeHero(heroPos: string, tableSeats: string[]): string[] {
  const ordered = PREFLOP_ORDER.filter(p => tableSeats.includes(p));
  const idx = ordered.indexOf(heroPos as typeof PREFLOP_ORDER[number]);
  return idx <= 0 ? [] : ordered.slice(0, idx);
}

// Seats ordered clockwise starting from hero (hero at index 0)
export function seatsFromHero(heroPos: string, numPlayers: number): string[] {
  const seats = SEATS_CLOCKWISE[Math.min(9, Math.max(2, numPlayers))] ?? SEATS_CLOCKWISE[6];
  const idx = seats.indexOf(heroPos);
  if (idx < 0) return seats;
  return [...seats.slice(idx), ...seats.slice(0, idx)];
}

// Compute pot size (always starts with 1.5BB for blinds)
export function computePot(preflopSpot: import('../types/trainer').PreflopAction[]): number {
  let pot = 1.5;
  for (const a of preflopSpot) {
    if (a.action === 'raise') pot += a.sizeBB;
    else if (a.action === 'limp') pot += 1;
  }
  return pot;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const RANGES_KEY = 'rp-ranges';
const STATS_KEY = 'rp-stats';

export function loadRanges(): RangeConfig[] {
  try { return JSON.parse(localStorage.getItem(RANGES_KEY) || '[]'); }
  catch { return []; }
}

export function saveRanges(ranges: RangeConfig[]): void {
  localStorage.setItem(RANGES_KEY, JSON.stringify(ranges));
}

export function loadStats(): Record<string, import('../types/trainer').RangeStats> {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); }
  catch { return {}; }
}

export function saveStats(stats: Record<string, import('../types/trainer').RangeStats>): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
