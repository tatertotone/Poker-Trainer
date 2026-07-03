export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type StreetName = 'preflop' | 'flop' | 'turn' | 'river';
export type Position = 'UTG' | 'UTG+1' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Action {
  position: Position;
  action: 'raises' | 'calls' | '3-bets' | 'checks' | 'bets' | 'check-raises';
  sizingBB?: number;
  sizingPct?: number;
}

export interface StreetData {
  street: StreetName;
  newCards: Card[];   // empty for preflop
  actions: Action[];
  potAfter: number;   // pot size in BB after this street's action
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export interface Tendency {
  id: string;
  description: string;
}

export interface HeroProfile {
  name: string;
  tendencies: Tendency[];
}

export interface VillainProfile {
  name: string;
  emoji: string;
  tagline: string;          // short label shown in picker
  description: string;      // one-sentence description for display
  coachContext: string;     // injected into Claude's system prompt
  isRandom?: boolean;       // if true, resolves to a random non-random profile each hand
  tendencies: Tendency[];
  // Betting frequencies (0–1)
  cbetFreqIP: number;
  donkFreqOOP: number;
  checkRaiseFreqFlop?: number;  // villain check-raises when OOP hero bets flop
  riverStabFreqOOP?: number;    // villain OOP stabs river after hero bets flop small + checks turn
  // Weighted size menus for each street [sizes, weights] — must be same length
  flopSizes: number[];
  flopWeights: number[];
  turnSizes: number[];
  turnWeights: number[];
  riverSizes: number[];
  riverWeights: number[];
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  date: string;             // ISO string
  villainName: string;
  villainEmoji: string;
  heroPosition: string;
  villainPosition: string;
  timeSeconds: number;
  rating: number;
}

// ── Full Scenario ──────────────────────────────────────────────────────────────

export interface FullScenario {
  heroPosition: Position;
  villainPosition: Position;
  heroIsIP: boolean;
  stackDepthBB: number;
  heroProfile: HeroProfile;
  villainProfile: VillainProfile;
  heroCards: [Card, Card];
  streets: StreetData[];  // always 4 entries: preflop, flop, turn, river
}

// ── App State ──────────────────────────────────────────────────────────────────

export interface StreetRangeEntry {
  street: StreetName;
  range: string[];   // sorted hand labels
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
