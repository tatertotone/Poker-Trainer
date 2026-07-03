import type {
  Card, Rank, Suit, Position, Action, StreetData,
  FullScenario, HeroProfile, VillainProfile,
} from '../types/poker';

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

// Lower index = acts first postflop (OOP) — higher index = acts last (IP)
const POSITION_INDEX: Record<Position, number> = {
  SB: 0, BB: 1, UTG: 2, 'UTG+1': 3, HJ: 4, CO: 5, BTN: 6,
};

// ── Profiles ──────────────────────────────────────────────────────────────────

export const DEFAULT_HERO_PROFILE: HeroProfile = {
  name: 'TAG',
  tendencies: [
    { id: 'flop_bet_ip_33', description: 'Bets 1/3 pot on flop when IP and villain checks' },
    { id: 'flop_check_oop', description: 'Always checks flop when OOP' },
  ],
};

// Profiles that can be randomly selected (all non-random, non-random-placeholder ones)
const _SELECTABLE_PROFILE_NAMES = ['Nit', 'Balanced Regular', 'LAG', 'Calling Station', 'Maniac', 'Recreational', 'GTO Bot']; void _SELECTABLE_PROFILE_NAMES;

export const VILLAIN_PROFILES: VillainProfile[] = [
  {
    name: 'Nit',
    emoji: '🧊',
    tagline: 'Nit',
    description: 'Tight-passive. Rarely bluffs — bets almost always mean value.',
    coachContext:
      'The villain is a NIT — a very tight, passive player. Their preflop range is narrow. ' +
      'Postflop they have a low c-bet frequency and almost never bluff. When a Nit bets, ' +
      'their range is heavily weighted towards value hands. The student should remove bluff ' +
      'combos aggressively and keep only strong value hands and a few strong draws after ' +
      'any aggression. Nits rarely donk or check-raise as a bluff.',
    tendencies: [
      { id: 'tight_range', description: 'Very tight preflop range' },
      { id: 'value_heavy', description: 'Bets are almost exclusively value' },
    ],
    cbetFreqIP:  0.42,
    donkFreqOOP: 0.08,
    flopSizes:   [33,  50],
    flopWeights: [55,  45],
    turnSizes:   [50,  66],
    turnWeights: [55,  45],
    riverSizes:  [66,  75,  100],
    riverWeights:[25,  50,  25],
  },
  {
    name: 'Balanced Regular',
    emoji: '📊',
    tagline: 'TAG',
    description: 'Balanced TAG. Mixes value and bluffs at roughly GTO frequencies.',
    coachContext:
      'The villain is a BALANCED REGULAR (TAG) — they play close to GTO frequencies with ' +
      'a balanced mix of value bets and bluffs. The student should think carefully about ' +
      'the full range of hands that can take each action, including semi-bluffs and air. ' +
      'Neither over-fold nor over-call — their range contains both strong hands and bluffs ' +
      'in reasonable proportion on every street.',
    tendencies: [
      { id: 'realistic_sizes', description: 'Uses realistic bet sizes weighted by street' },
      { id: 'cbet_ip', description: 'C-bets ~65% of the time when IP' },
    ],
    cbetFreqIP:  0.65,
    donkFreqOOP: 0.20,
    flopSizes:   [33,  50,  66,  75],
    flopWeights: [35,  35,  20,  10],
    turnSizes:   [50,  66,  75],
    turnWeights: [30,  45,  25],
    riverSizes:  [50,  66,  75, 100],
    riverWeights:[20,  35,  30,  15],
  },
  {
    name: 'LAG',
    emoji: '🔥',
    tagline: 'LAG',
    description: 'Loose-aggressive. High frequency bettor — lots of bluffs in every range.',
    coachContext:
      'The villain is a LAG — a loose, aggressive player who bets and raises at high ' +
      'frequency with a wide range including many bluffs and semi-bluffs. The student ' +
      'should keep many more bluff combos in the villain\'s range even after multiple ' +
      'streets of aggression. A LAG c-bets most flops, fires multiple barrels, and donks ' +
      'frequently. Their betting range includes weak flush draws, gutshots, and pure bluffs ' +
      'in addition to strong hands. Do not narrow the range too aggressively.',
    tendencies: [
      { id: 'high_freq_bettor', description: 'Bets and raises at very high frequency' },
      { id: 'multi_barrel', description: 'Fires multiple streets as bluffs frequently' },
    ],
    cbetFreqIP:  0.82,
    donkFreqOOP: 0.38,
    flopSizes:   [33,  50,  66],
    flopWeights: [45,  35,  20],
    turnSizes:   [50,  66,  75],
    turnWeights: [30,  38,  32],
    riverSizes:  [66,  75,  100, 133],
    riverWeights:[20,  30,  32,  18],
  },
  {
    name: 'Calling Station',
    emoji: '📞',
    tagline: 'Station',
    description: 'Passive caller. Rarely bets — when they do, it\'s almost always strong.',
    coachContext:
      'The villain is a CALLING STATION — a passive player who calls far too wide but ' +
      'rarely takes aggressive action themselves. They have a very low c-bet frequency ' +
      'and almost never donk or check-raise. When a calling station does bet, it is a ' +
      'very strong signal — their betting range is extremely value-heavy with almost no ' +
      'bluffs. The student should treat any aggression from this villain as representing ' +
      'near-nut hands. On the other hand, their checking range stays very wide with many ' +
      'medium-strength hands they would call with but not bet.',
    tendencies: [
      { id: 'passive', description: 'Rarely bets or raises' },
      { id: 'call_wide', description: 'Calls with a very wide range' },
    ],
    cbetFreqIP:  0.30,
    donkFreqOOP: 0.08,
    flopSizes:   [33,  50],
    flopWeights: [65,  35],
    turnSizes:   [50,  66],
    turnWeights: [65,  35],
    riverSizes:  [66,  75,  100],
    riverWeights:[30,  45,  25],
  },
  {
    name: 'Maniac',
    emoji: '💥',
    tagline: 'Maniac',
    description: 'Hyper-aggressive. Bets and overbets almost every street — range stays very wide.',
    coachContext:
      'The villain is a MANIAC — an extremely aggressive player who bets at near-maximum ' +
      'frequency with a very wide range including lots of junk. They overbet frequently ' +
      'and fire multiple streets with weak hands. The student must keep the villain\'s ' +
      'range extremely wide even after multiple streets of large aggression — a maniac ' +
      'can show up with almost any two cards. Do not narrow the range heavily just because ' +
      'they bet large or bet multiple streets. Focus on board texture over action frequency ' +
      'when evaluating what to remove.',
    tendencies: [
      { id: 'overbet', description: 'Frequently overbets pot' },
      { id: 'max_aggression', description: 'Bets nearly every street with any holding' },
    ],
    cbetFreqIP:  0.92,
    donkFreqOOP: 0.52,
    checkRaiseFreqFlop: 0.18,
    flopSizes:   [66,  75, 100, 133],
    flopWeights: [20,  30,  30,  20],
    turnSizes:   [75, 100, 133],
    turnWeights: [25,  40,  35],
    riverSizes:  [100, 133, 150],
    riverWeights:[30,   40,  30],
  },
  {
    name: 'Recreational',
    emoji: '🎰',
    tagline: 'Rec',
    description: 'Calls too wide pre and post-flop. Rarely 3-bets or check-raises. Stabs rivers OOP with air.',
    coachContext:
      'The villain is a RECREATIONAL PLAYER with these specific tendencies: ' +
      '(1) They call too wide preflop and rarely 3-bet, so their range entering the flop is very wide and capped — expect many weak holdings and almost no premium hands when they flat. ' +
      '(2) They call too wide on the flop even with weak draws and no-pair hands, so their range stays bloated through the flop. ' +
      '(3) They almost never check-raise the flop, so a check from them on the flop is not a strong signal — it does not remove strong made hands from their range the way it would against a GTO player. ' +
      '(4) A key exploitable pattern: after the IP player bets small on the flop and then checks back the turn, this villain will frequently stab the river out of position with weak hands and air. ' +
      '(5) They do not adjust their opening range for position — they open the same hands from UTG as from CO, meaning their preflop range is wider than expected from early position and not as tight as it should be. ' +
      'When coaching the student, highlight when they should account for these tendencies — especially the wide flop-call range and the OOP river stab pattern.',
    tendencies: [
      { id: 'wide_preflop_call', description: 'Calls too wide preflop, rarely 3-bets' },
      { id: 'wide_flop_call', description: 'Calls too wide on flop' },
      { id: 'no_checkraise', description: 'Almost never check-raises the flop' },
      { id: 'river_stab_oop', description: 'Stabs rivers OOP after IP bets small flop + checks turn' },
      { id: 'no_position_adjust', description: 'Opens same range from all positions' },
    ],
    cbetFreqIP:  0.48,
    donkFreqOOP: 0.14,
    checkRaiseFreqFlop: 0.03,
    riverStabFreqOOP:   0.58,
    flopSizes:   [33,  50,  66],
    flopWeights: [50,  35,  15],
    turnSizes:   [33,  50,  66],
    turnWeights: [40,  40,  20],
    riverSizes:  [50,  66,  75],
    riverWeights:[35,  40,  25],
  },
  {
    name: 'GTO Bot',
    emoji: '🤖',
    tagline: 'GTO Bot',
    description: 'Solver-derived play. Balanced ranges, mixed strategies, multiple bet sizings — hardest to read.',
    coachContext:
      'The villain is a GTO BOT — a solver-influenced player using near-optimal balanced frequencies. ' +
      'Every action contains a near-correct mix of value hands and bluffs: their c-bets include sets, ' +
      'two-pair, top pair, strong draws, and pure bluffs. Their checks contain strong made hands mixed ' +
      'in for deception (slowplays), medium hands, and weak bluff-catchers. ' +
      'They check-raise the flop at a reasonable frequency with nut draws and sets as well as some air. ' +
      'They use multiple bet sizings — small bets (33%) on dry boards and larger bets on wet boards. ' +
      'The student should NOT make exploitative reads based on bet sizing alone. Emphasise that even ' +
      'after aggressive action, strong hands and bluffs remain in proportion. Teach the student to ' +
      'think about which hands unblock villain\'s bluffs and which hands block their value, and how ' +
      'board texture affects range construction at GTO frequencies.',
    tendencies: [
      { id: 'balanced_ranges', description: 'Balanced value/bluff ratio on every street' },
      { id: 'mixed_sizings', description: 'Uses multiple bet sizings based on board texture' },
      { id: 'trapping', description: 'Checks back strong hands at GTO frequency' },
      { id: 'checkraise_balanced', description: 'Check-raises with value and bluffs at proper freq' },
    ],
    cbetFreqIP:  0.70,
    donkFreqOOP: 0.25,
    checkRaiseFreqFlop: 0.14,
    flopSizes:   [33,  50,  66,  75],
    flopWeights: [30,  30,  25,  15],
    turnSizes:   [50,  66,  75,  100],
    turnWeights: [20,  35,  30,  15],
    riverSizes:  [50,  66,  75,  100, 133],
    riverWeights:[15,  30,  30,  18,  7],
  },
  {
    name: 'Random',
    emoji: '🎲',
    tagline: 'Random',
    description: 'A different villain type each hand — great for mixed online game training.',
    coachContext: '', // resolved at scenario generation time
    isRandom: true,
    tendencies: [],
    cbetFreqIP:  0.65,
    donkFreqOOP: 0.20,
    flopSizes:   [33, 50, 66],
    flopWeights: [34, 33, 33],
    turnSizes:   [50, 66, 75],
    turnWeights: [34, 33, 33],
    riverSizes:  [50, 66, 100],
    riverWeights:[34, 33, 33],
  },
];

export const DEFAULT_VILLAIN_PROFILE: VillainProfile = VILLAIN_PROFILES[1]; // TAG

// ── Utilities ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(values: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    r -= weights[i];
    if (r <= 0) return values[i];
  }
  return values[values.length - 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  return deck;
}

// ── Hero Range System ─────────────────────────────────────────────────────────

// [hi_rank, lo_rank, type]  type: 'p'=pair, 's'=suited, 'o'=offsuit
type RawHand = readonly [Rank, Rank, 'p' | 's' | 'o'];

// Rank index helper (lower = higher rank)
function ri(r: Rank): number { return RANKS.indexOf(r); }

// Single-hand constructors
const ps = (hi: Rank, lo: Rank): RawHand => [hi, lo, 's'];
const po = (hi: Rank, lo: Rank): RawHand => [hi, lo, 'o'];

// Range builders — loFrom is the highest kicker, loTo the lowest
// e.g. suitedArr('K','Q','9') = K9s+ = KQs,KJs,KTs,K9s
function pairsArr(hi: Rank, lo: Rank): RawHand[] {
  const res: RawHand[] = [];
  for (let i = ri(hi); i <= ri(lo); i++) res.push([RANKS[i], RANKS[i], 'p']);
  return res;
}

function suitedArr(hi: Rank, loFrom: Rank, loTo: Rank): RawHand[] {
  const res: RawHand[] = [];
  for (let i = ri(loFrom); i <= ri(loTo); i++) {
    if (RANKS[i] !== hi) res.push([hi, RANKS[i], 's']);
  }
  return res;
}

function offsuitArr(hi: Rank, loFrom: Rank, loTo: Rank): RawHand[] {
  const res: RawHand[] = [];
  for (let i = ri(loFrom); i <= ri(loTo); i++) {
    if (RANKS[i] !== hi) res.push([hi, RANKS[i], 'o']);
  }
  return res;
}

function buildHeroRange(
  heroPos: Position,
  villainPos: Position,
  didThreeBet: boolean,
): RawHand[] {
  // 3-bet range: premiums only
  if (didThreeBet) {
    return [
      ...pairsArr('A', 'T'),          // TT+
      ...suitedArr('A', 'K', 'J'),    // AJs+
      po('A', 'K'), po('A', 'Q'),     // AKo, AQo
      ps('K', 'Q'),                   // KQs
    ];
  }

  switch (`${villainPos}_${heroPos}`) {

    // ── BB defends ────────────────────────────────────────────────────────────

    case 'UTG_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),            // A2s+
        ...suitedArr('K', 'Q', '9'),            // K9s+
        ps('Q', 'J'), ps('Q', 'T'),             // QTs+
        ps('J', 'T'),                           // JTs
        ps('T', '9'), ps('9', '8'), ps('8', '7'), ps('7', '6'), ps('6', '5'),
        ...offsuitArr('A', 'K', 'J'),           // AJo+
        po('K', 'Q'),
      ];

    case 'UTG+1_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '9'),
        ps('Q', 'J'), ps('Q', 'T'), ps('Q', '9'),
        ps('J', 'T'), ps('J', '9'),
        ps('T', '9'), ps('T', '8'),
        ps('9', '8'), ps('9', '7'),
        ps('8', '7'), ps('7', '6'), ps('6', '5'),
        ...offsuitArr('A', 'K', 'J'),           // AJo+
        po('K', 'Q'), po('Q', 'J'),
      ];

    case 'HJ_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '7'),            // K7s+
        ...suitedArr('Q', 'J', '8'),            // Q8s+
        ...suitedArr('J', 'T', '8'),            // J8s+
        ps('T', '9'), ps('T', '8'),
        ps('9', '8'), ps('9', '7'),
        ps('8', '7'), ps('8', '6'),
        ps('7', '6'), ps('6', '5'), ps('5', '4'),
        ...offsuitArr('A', 'K', 'T'),           // ATo+
        po('K', 'Q'), po('K', 'J'),
        po('Q', 'J'),
      ];

    case 'CO_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '6'),            // K6s+
        ...suitedArr('Q', 'J', '7'),            // Q7s+
        ...suitedArr('J', 'T', '7'),            // J7s+
        ...suitedArr('T', '9', '7'),            // T7s+
        ps('9', '8'), ps('9', '7'), ps('9', '6'),
        ps('8', '7'), ps('8', '6'), ps('8', '5'),
        ps('7', '6'), ps('7', '5'),
        ps('6', '5'), ps('6', '4'),
        ps('5', '4'), ps('5', '3'),
        ...offsuitArr('A', 'K', 'T'),
        ...offsuitArr('K', 'Q', 'T'),           // KTo+
        po('Q', 'J'),
      ];

    case 'BTN_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '4'),            // K4s+
        ...suitedArr('Q', 'J', '6'),            // Q6s+
        ...suitedArr('J', 'T', '6'),            // J6s+
        ...suitedArr('T', '9', '6'),            // T6s+
        ps('9', '8'), ps('9', '7'), ps('9', '6'), ps('9', '5'),
        ps('8', '7'), ps('8', '6'), ps('8', '5'), ps('8', '4'),
        ps('7', '6'), ps('7', '5'), ps('7', '4'),
        ps('6', '5'), ps('6', '4'), ps('6', '3'),
        ps('5', '4'), ps('5', '3'),
        ps('4', '3'),
        ...offsuitArr('A', 'K', '8'),           // A8o+
        ...offsuitArr('K', 'Q', '9'),           // K9o+
        po('Q', 'J'), po('Q', 'T'),
        po('J', 'T'),
      ];

    case 'SB_BB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '5'),            // K5s+
        ...suitedArr('Q', 'J', '7'),            // Q7s+
        ...suitedArr('J', 'T', '7'),            // J7s+
        ...suitedArr('T', '9', '7'),            // T7s+
        ps('9', '8'), ps('9', '7'), ps('9', '6'),
        ps('8', '7'), ps('8', '6'), ps('8', '5'),
        ps('7', '6'), ps('7', '5'),
        ps('6', '5'), ps('6', '4'),
        ps('5', '4'),
        ...offsuitArr('A', 'K', '8'),           // A8o+
        po('K', 'Q'), po('K', 'J'),
        po('Q', 'J'),
      ];

    // ── SB calls BTN ─────────────────────────────────────────────────────────

    case 'BTN_SB':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '8'),            // K8s+
        ...suitedArr('Q', 'J', 'T'),            // QTs+
        ps('J', 'T'),
        ps('T', '9'), ps('9', '8'), ps('8', '7'), ps('7', '6'), ps('6', '5'), ps('5', '4'),
        ...offsuitArr('A', 'K', 'J'),           // AJo+
        po('K', 'Q'),
      ];

    // ── BTN calls CO ─────────────────────────────────────────────────────────

    case 'CO_BTN':
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '6'),            // K6s+
        ...suitedArr('Q', 'J', '8'),            // Q8s+
        ...suitedArr('J', 'T', '7'),            // J7s+
        ...suitedArr('T', '9', '7'),            // T7s+
        ps('9', '8'), ps('9', '7'), ps('9', '6'),
        ps('8', '7'), ps('8', '6'),
        ps('7', '6'), ps('7', '5'),
        ps('6', '5'), ps('5', '4'),
        ...offsuitArr('A', 'K', 'T'),           // ATo+
        po('K', 'Q'), po('K', 'J'),
        po('Q', 'J'),
      ];

    default:
      return [
        ...pairsArr('A', '2'),
        ...suitedArr('A', 'K', '2'),
        ...suitedArr('K', 'Q', '8'),
        ps('Q', 'J'), ps('Q', 'T'), ps('J', 'T'), ps('T', '9'), ps('9', '8'), ps('8', '7'), ps('7', '6'),
        ...offsuitArr('A', 'K', 'J'),
        po('K', 'Q'),
      ];
  }
}

function dealHeroHand(range: RawHand[], deck: Card[]): [Card, Card] {
  const shuffledRange = shuffle([...range]) as RawHand[];

  for (const [hi, lo, type] of shuffledRange) {
    if (type === 'p') {
      const matches = deck.filter(c => c.rank === hi);
      if (matches.length >= 2) {
        const c1 = pick(matches);
        const rest = matches.filter(c => c !== c1);
        const c2 = pick(rest);
        deck.splice(deck.indexOf(c1), 1);
        deck.splice(deck.indexOf(c2), 1);
        return [c1, c2];
      }
    } else if (type === 's') {
      const availSuits = SUITS.filter(suit =>
        deck.some(c => c.rank === hi && c.suit === suit) &&
        deck.some(c => c.rank === lo && c.suit === suit),
      );
      if (availSuits.length > 0) {
        const suit = pick(availSuits);
        const c1 = deck.find(c => c.rank === hi && c.suit === suit)!;
        const c2 = deck.find(c => c.rank === lo && c.suit === suit)!;
        deck.splice(deck.indexOf(c1), 1);
        deck.splice(deck.indexOf(c2), 1);
        return [c1, c2];
      }
    } else {
      // offsuit
      const c1Options = shuffle(deck.filter(c => c.rank === hi));
      for (const c1 of c1Options) {
        const c2Options = deck.filter(c => c.rank === lo && c.suit !== c1.suit);
        if (c2Options.length > 0) {
          const c2 = pick(c2Options);
          deck.splice(deck.indexOf(c1), 1);
          deck.splice(deck.indexOf(c2), 1);
          return [c1, c2];
        }
      }
    }
  }

  // Fallback — should never reach here with a full deck
  return [deck.pop()!, deck.pop()!];
}

// ── Postflop Action Generator ─────────────────────────────────────────────────

interface StreetActionResult {
  actions: Action[];
  newPot: number;
  heroFlopBetSmall?: boolean;   // hero bet ≤ 40% IP on flop
  heroTurnCheckedBack?: boolean; // hero checked after villain checked on turn
}

function generatePostflopActions(
  street: 'flop' | 'turn' | 'river',
  heroPosition: Position,
  villainPosition: Position,
  heroIsIP: boolean,
  pot: number,
  heroProfile: HeroProfile,
  villainProfile: VillainProfile,
  context?: { heroFlopBetSmall?: boolean; heroTurnCheckedBack?: boolean },
): StreetActionResult {
  const actions: Action[] = [];
  let newPot = pot;
  let heroFlopBetSmall = false;
  let heroTurnCheckedBack = false;

  const heroTendencies = new Set(heroProfile.tendencies.map(t => t.id));

  const villainSizes  = street === 'flop' ? villainProfile.flopSizes
                      : street === 'turn' ? villainProfile.turnSizes
                      : villainProfile.riverSizes;
  const villainWeights = street === 'flop' ? villainProfile.flopWeights
                       : street === 'turn' ? villainProfile.turnWeights
                       : villainProfile.riverWeights;

  function villainBetSize(): number {
    return weightedPick(villainSizes, villainWeights);
  }

  if (heroIsIP) {
    // Villain is OOP — check for river stab pattern first
    const isStabSituation =
      street === 'river' &&
      (villainProfile.riverStabFreqOOP ?? 0) > 0 &&
      context?.heroFlopBetSmall &&
      context?.heroTurnCheckedBack;

    const villainBets = isStabSituation
      ? Math.random() < (villainProfile.riverStabFreqOOP ?? 0)
      : Math.random() < villainProfile.donkFreqOOP;

    if (villainBets) {
      const pct = villainBetSize();
      const amount = Math.round(pot * pct / 100 * 10) / 10;
      actions.push({ position: villainPosition, action: 'bets', sizingPct: pct });
      actions.push({ position: heroPosition, action: 'calls' });
      newPot = pot + amount * 2;
    } else {
      actions.push({ position: villainPosition, action: 'checks' });

      const heroBetsFlop = street === 'flop' && heroTendencies.has('flop_bet_ip_33');
      const heroBetsTurn = street === 'turn' && Math.random() < 0.5;
      const heroBetsRiver = street === 'river' && Math.random() < 0.45;
      const heroBets = heroBetsFlop || heroBetsTurn || heroBetsRiver;

      if (heroBets) {
        const pct = street === 'flop' && heroTendencies.has('flop_bet_ip_33') ? 33
                  : weightedPick(villainSizes, villainWeights);
        const amount = Math.round(pot * pct / 100 * 10) / 10;
        actions.push({ position: heroPosition, action: 'bets', sizingPct: pct });

        // Check-raise opportunity (flop only)
        const crFreq = villainProfile.checkRaiseFreqFlop ?? 0;
        if (street === 'flop' && crFreq > 0 && Math.random() < crFreq) {
          const raisePct = Math.min(200, Math.round(pct * 2.5));
          actions.push({ position: villainPosition, action: 'check-raises', sizingPct: raisePct });
          actions.push({ position: heroPosition, action: 'calls' });
          newPot = pot + 2 * (pot * raisePct / 100);
        } else {
          actions.push({ position: villainPosition, action: 'calls' });
          newPot = pot + amount * 2;
        }

        if (street === 'flop') heroFlopBetSmall = pct <= 40;
      } else {
        actions.push({ position: heroPosition, action: 'checks' });
        if (street === 'turn') heroTurnCheckedBack = true;
      }
    }
  } else {
    // Villain is IP: hero acts first (OOP)
    const heroChecksFlop = street === 'flop' && heroTendencies.has('flop_check_oop');
    const heroChecks = heroChecksFlop || true;

    if (heroChecks) {
      actions.push({ position: heroPosition, action: 'checks' });

      const villainBets = Math.random() < villainProfile.cbetFreqIP;

      if (villainBets) {
        const pct = villainBetSize();
        const amount = Math.round(pot * pct / 100 * 10) / 10;
        actions.push({ position: villainPosition, action: 'bets', sizingPct: pct });
        actions.push({ position: heroPosition, action: 'calls' });
        newPot = pot + amount * 2;
      } else {
        actions.push({ position: villainPosition, action: 'checks' });
      }
    }
  }

  return { actions, newPot, heroFlopBetSmall, heroTurnCheckedBack };
}

// ── Main Generator ────────────────────────────────────────────────────────────

export function generateScenario(
  heroProfile: HeroProfile = DEFAULT_HERO_PROFILE,
  villainProfile: VillainProfile = DEFAULT_VILLAIN_PROFILE,
): FullScenario {
  // Resolve random villain to a concrete profile
  if (villainProfile.isRandom) {
    const selectable = VILLAIN_PROFILES.filter(p => !p.isRandom);
    villainProfile = pick(selectable);
  }

  const deck = shuffle(buildDeck());

  // 1. Positions
  const positionPairs: [Position, Position][] = [
    ['BTN', 'BB'], ['CO', 'BB'], ['BTN', 'SB'],
    ['HJ', 'BB'],  ['CO', 'BTN'], ['UTG', 'BB'],
    ['SB', 'BB'],  ['UTG+1', 'BB'],
  ];
  const [villainPosition, heroPosition] = pick(positionPairs);
  const heroIsIP = POSITION_INDEX[heroPosition] > POSITION_INDEX[villainPosition];
  const stackDepthBB = pick([50, 75, 100, 100, 125, 150, 200]);

  // 2. Preflop action
  const openSize = pick([2, 2.5, 2.5, 3, 3.5]);
  const pfActions: Action[] = [
    { position: villainPosition, action: 'raises', sizingBB: openSize },
  ];

  let pot = openSize * 2;
  let didThreeBet = false;

  if (Math.random() < 0.2) {
    didThreeBet = true;
    const threeBet = Math.round(openSize * pick([3, 3.5, 4]) * 2) / 2;
    pfActions.push({ position: heroPosition, action: '3-bets', sizingBB: threeBet });
    pfActions.push({ position: villainPosition, action: 'calls' });
    pot = threeBet * 2;
  } else {
    pfActions.push({ position: heroPosition, action: 'calls' });
  }

  // 3. Deal hero's hole cards from position-appropriate range
  const heroRange = buildHeroRange(heroPosition, villainPosition, didThreeBet);
  const heroCards = dealHeroHand(heroRange, deck);

  const preflopStreet: StreetData = {
    street: 'preflop',
    newCards: [],
    actions: pfActions,
    potAfter: Math.round(pot * 10) / 10,
  };

  // 4. Deal board cards from remaining deck (heroCards already removed)
  const flopCards = [deck.pop()!, deck.pop()!, deck.pop()!];
  const flopResult = generatePostflopActions('flop', heroPosition, villainPosition, heroIsIP, pot, heroProfile, villainProfile);
  const flopStreet: StreetData = {
    street: 'flop',
    newCards: flopCards,
    actions: flopResult.actions,
    potAfter: Math.round(flopResult.newPot * 10) / 10,
  };
  pot = flopResult.newPot;

  const turnCard = deck.pop()!;
  const turnResult = generatePostflopActions('turn', heroPosition, villainPosition, heroIsIP, pot, heroProfile, villainProfile, {
    heroFlopBetSmall: flopResult.heroFlopBetSmall,
  });
  const turnStreet: StreetData = {
    street: 'turn',
    newCards: [turnCard],
    actions: turnResult.actions,
    potAfter: Math.round(turnResult.newPot * 10) / 10,
  };
  pot = turnResult.newPot;

  const riverCard = deck.pop()!;
  const riverResult = generatePostflopActions('river', heroPosition, villainPosition, heroIsIP, pot, heroProfile, villainProfile, {
    heroFlopBetSmall: flopResult.heroFlopBetSmall,
    heroTurnCheckedBack: turnResult.heroTurnCheckedBack,
  });
  const riverStreet: StreetData = {
    street: 'river',
    newCards: [riverCard],
    actions: riverResult.actions,
    potAfter: Math.round(riverResult.newPot * 10) / 10,
  };

  return {
    heroPosition,
    villainPosition,
    heroIsIP,
    stackDepthBB,
    heroProfile,
    villainProfile,
    heroCards,
    streets: [preflopStreet, flopStreet, turnStreet, riverStreet],
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatCard(card: Card): string {
  const sym: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
  return `${card.rank}${sym[card.suit]}`;
}

export function formatAction(a: Action): string {
  let s = `${a.position} ${a.action}`;
  if (a.sizingBB)  s += ` ${a.sizingBB}BB`;
  if (a.sizingPct) s += ` ${a.sizingPct}% pot`;
  return s;
}

export function boardCardsUpToStreet(
  scenario: FullScenario,
  streetIndex: number,
): Card[] {
  const cards: Card[] = [];
  for (let i = 1; i <= streetIndex && i < scenario.streets.length; i++) {
    cards.push(...scenario.streets[i].newCards);
  }
  return cards;
}

export function scenarioSummaryForCoach(
  scenario: FullScenario,
  rangesPerStreet: { street: string; range: string[] }[],
): string {
  const { heroPosition, villainPosition, stackDepthBB, streets, heroIsIP } = scenario;

  const boardCards = [
    ...streets[1].newCards,
    ...streets[2].newCards,
    ...streets[3].newCards,
  ].map(formatCard).join(' ');

  const preflopStr = streets[0].actions.map(formatAction).join(', ');

  const postflopSections = streets.slice(1).map(s => {
    const cards = s.newCards.map(formatCard).join(' ');
    const acts = s.actions.map(formatAction).join(', ');
    return `${s.street.toUpperCase()} [${cards}]: ${acts || 'no action'}`;
  }).join('\n');

  const rangeSections = rangesPerStreet.map(r =>
    `After ${r.street}: [${r.range.join(', ') || 'nothing selected'}]`
  ).join('\n');

  return `HAND SUMMARY
Hero: ${heroPosition} (${heroIsIP ? 'IP' : 'OOP'}) | Villain: ${villainPosition} | Stacks: ${stackDepthBB}BB
Board: ${boardCards}

PREFLOP: ${preflopStr}
${postflopSections}

STUDENT'S RANGE ASSIGNMENTS
${rangeSections}`;
}
