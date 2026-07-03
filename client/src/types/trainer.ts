export interface RangeAction {
  id: string;
  name: string;
  color: string;
}

export type DistractorMode = 'nearby' | 'all' | 'manual';

export interface PreflopAction {
  position: string;
  action: 'fold' | 'raise' | 'limp';
  sizeBB: number; // 0 for fold, BB amount for raise/limp
}

export interface RangeConfig {
  id: string;
  name: string;
  position: string;
  stackDepthBB: number;
  opponents: number;
  actions: RangeAction[];
  // hand label (e.g. "AKs") -> action id (only explicitly painted hands)
  handActions: Record<string, string>;
  // action id whose color tints unpainted cells; those hands are NOT drilled
  defaultActionId: string | null;
  distractorMode: DistractorMode;
  manualDistractors: string[];
  preflopSpot: PreflopAction[];
  testHands: string[];         // hands explicitly painted for drilling (empty = all range hands)
  testHandsEquity: boolean;    // also include ±5% equity hands from the range
  passed?: boolean;            // true after a successful test run; cleared on edit+save
  createdAt: number;
  updatedAt: number;
}

export interface HandStat {
  correct: number;
  total: number;
}

export interface RangeStats {
  rangeId: string;
  totalCorrect: number;
  totalAttempts: number;
  // hand label -> stat
  handStats: Record<string, HandStat>;
}

export type TrainerView = 'list' | 'builder' | 'train' | 'stats';
export type TrainerMode = 'practice' | 'test' | 'mistakes';

export interface TrainingHand {
  label: string;       // e.g. "AKs"
  actionId: string | null; // null = distractor (fold)
  cards: [TrainingCard, TrainingCard];
}

export interface TrainingCard {
  rank: string;
  suit: 's' | 'h' | 'd' | 'c';
}
