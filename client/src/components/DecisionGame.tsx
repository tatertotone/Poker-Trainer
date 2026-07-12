import { useState, useCallback, useRef, useEffect } from 'react';
import type { FullScenario, Action, StreetName, ChatMessage, VillainProfile, Card, Suit, Position } from '../types/poker';
import { formatCard } from '../utils/scenarioGenerator';
import VillainPicker from './VillainPicker';
import RangeCategoryPicker from './RangeCategoryPicker';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const STREETS: StreetName[] = ['preflop', 'flop', 'turn', 'river'];

const SUIT_SYMBOL: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR: Record<Suit, string> = { h: '#dc2626', d: '#dc2626', c: '#1a7a3a', s: '#111827' };

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

interface ActionOption {
  label: string;
  value: HeroActionType;
  needsBet?: boolean;
}

interface Facing {
  toBB: number;
}

interface LogEntry {
  street: StreetName;
  position: Position;
  isHero: boolean;
  text: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getVillainAction(scenario: FullScenario, streetIndex: number): Action | null {
  return scenario.streets[streetIndex].actions.find(
    a => a.position === scenario.villainPosition
  ) ?? null;
}

function actionText(kind: 'checks' | 'calls' | 'bets' | 'raises' | 'folds', toBB?: number): string {
  switch (kind) {
    case 'checks': return 'Checks';
    case 'calls': return 'Calls';
    case 'folds': return 'Folds';
    case 'bets': return `Bets ${toBB}BB`;
    case 'raises': return `Raises to ${toBB}BB`;
  }
}

function getHeroOptions(facing: Facing | null, callDelta: number, isPreflop: boolean, raiseCount: number): ActionOption[] {
  if (!facing) {
    return [{ label: 'Check', value: 'check' }, { label: 'Bet', value: 'bet', needsBet: true }];
  }
  const opts: ActionOption[] = [
    { label: 'Fold', value: 'fold' },
    { label: `Call ${callDelta}BB`, value: 'call' },
  ];
  if (raiseCount < 2) {
    opts.push({ label: isPreflop ? '3-Bet' : 'Raise', value: 'raise', needsBet: true });
  }
  return opts;
}

// Simple profile-flavoured frequencies for reacting to a hero-initiated bet/raise
// that isn't already scripted in the generated scenario data.
const FACING_FREQ: Record<string, { fold: number; call: number; raise: number }> = {
  Nit:                { fold: 0.32, call: 0.53, raise: 0.15 },
  'Balanced Regular': { fold: 0.20, call: 0.58, raise: 0.22 },
  LAG:                { fold: 0.12, call: 0.53, raise: 0.35 },
  'Calling Station':  { fold: 0.05, call: 0.88, raise: 0.07 },
  Maniac:             { fold: 0.08, call: 0.40, raise: 0.52 },
  Recreational:       { fold: 0.15, call: 0.75, raise: 0.10 },
  'GTO Bot':          { fold: 0.20, call: 0.55, raise: 0.25 },
};

function synthesizeVillainReaction(villainProfile: VillainProfile, allowRaise: boolean): 'fold' | 'call' | 'raise' {
  const f = FACING_FREQ[villainProfile.name] ?? { fold: 0.2, call: 0.6, raise: 0.2 };
  const foldW = f.fold, callW = f.call, raiseW = allowRaise ? f.raise : 0;
  let r = Math.random() * (foldW + callW + raiseW);
  if (r < foldW) return 'fold';
  r -= foldW;
  if (r < callW) return 'call';
  return 'raise';
}

function boardStr(cards: Card[]): string {
  return cards.map(formatCard).join(' ') || 'none';
}

function allBoardCards(scenario: FullScenario, upToStreet: number): Card[] {
  const cards: Card[] = [];
  for (let i = 1; i <= upToStreet; i++) {
    cards.push(...scenario.streets[i].newCards);
  }
  return cards;
}

// ── Card display ──────────────────────────────────────────────────────────────

function CardBadge({ card }: { card: Card }) {
  return (
    <div className="dg-card" style={{ color: SUIT_COLOR[card.suit] }}>
      {card.rank}<span className="dg-card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

// ── Poker Table ───────────────────────────────────────────────────────────────

const SEAT_POSITIONS: Partial<Record<string, { left: string; top: string }>> = {
  UTG:     { left: '9%',  top: '50%' },
  'UTG+1': { left: '9%',  top: '50%' },
  HJ:      { left: '27%', top: '10%' },
  CO:      { left: '73%', top: '10%' },
  BTN:     { left: '91%', top: '50%' },
  SB:      { left: '73%', top: '90%' },
  BB:      { left: '27%', top: '90%' },
};

const BET_OFFSETS: Partial<Record<string, { left: string; top: string }>> = {
  UTG:     { left: '17%', top: '50%' },
  'UTG+1': { left: '17%', top: '50%' },
  HJ:      { left: '35%', top: '22%' },
  CO:      { left: '65%', top: '22%' },
  BTN:     { left: '80%', top: '50%' },
  SB:      { left: '65%', top: '78%' },
  BB:      { left: '35%', top: '78%' },
};

interface TableProps {
  scenario: FullScenario;
  streetIndex: number;
  pot: number;
  heroStack: number;
  villainStack: number;
  heroBetBB: number | null;
  villainBetBB: number | null;
  seatAction: Partial<Record<string, string>>;
}

function PokerTable({ scenario, streetIndex, pot, heroStack, villainStack, heroBetBB, villainBetBB, seatAction }: TableProps) {
  const { heroPosition, villainPosition, heroCards } = scenario;

  const board = allBoardCards(scenario, streetIndex);
  const allSeats = ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const active = new Set([heroPosition as string, villainPosition as string]);
  const seats = allSeats.filter(pos => {
    if (active.has(pos)) return true;
    if (pos === 'UTG+1' && !active.has('UTG+1')) return false;
    if (pos === 'UTG' && active.has('UTG+1')) return false;
    return true;
  });

  return (
    <div className="dg-table-wrapper">
      <div className="dg-felt">
        {/* Community cards + pot */}
        <div className="dg-community">
          {board.length > 0 ? (
            <div className="dg-board-cards">
              {board.map((c, i) => <CardBadge key={i} card={c} />)}
            </div>
          ) : (
            <div className="dg-preflop-label">PREFLOP</div>
          )}
          <div className="dg-pot-chip">
            <span className="dg-pot-label">POT</span>
            <span className="dg-pot-amount">{pot.toFixed(1)}BB</span>
          </div>
        </div>

        {/* Bet chips */}
        {villainBetBB !== null && (() => {
          const off = BET_OFFSETS[villainPosition as string];
          return off ? (
            <div className="dg-bet-chip" style={{ left: off.left, top: off.top }}>
              {villainBetBB}BB
            </div>
          ) : null;
        })()}
        {heroBetBB !== null && (() => {
          const off = BET_OFFSETS[heroPosition as string];
          return off ? (
            <div className="dg-bet-chip dg-bet-chip--hero" style={{ left: off.left, top: off.top }}>
              {heroBetBB}BB
            </div>
          ) : null;
        })()}
      </div>

      {/* Seats */}
      {seats.map(pos => {
        const center = SEAT_POSITIONS[pos];
        if (!center) return null;
        const isHero = pos === heroPosition;
        const isVillain = pos === villainPosition;
        const cls = ['dg-seat', isHero ? 'dg-seat--hero' : '', isVillain ? 'dg-seat--villain' : '', !isHero && !isVillain ? 'dg-seat--other' : ''].filter(Boolean).join(' ');
        return (
          <div key={pos} className={cls} style={{ left: center.left, top: center.top }}>
            <div className="dg-seat-cards">
              {isHero ? (
                heroCards.map((c, i) => (
                  <div key={i} className="dg-hole-card dg-hole-card--up" style={{ color: SUIT_COLOR[c.suit] }}>
                    {c.rank}<span className="dg-hole-suit">{SUIT_SYMBOL[c.suit]}</span>
                  </div>
                ))
              ) : isVillain ? (
                <><div className="dg-hole-card dg-hole-card--down" /><div className="dg-hole-card dg-hole-card--down" /></>
              ) : (
                <><div className="dg-hole-card dg-hole-card--folded" /><div className="dg-hole-card dg-hole-card--folded" /></>
              )}
            </div>
            <div className="dg-seat-label">
              <span className="dg-seat-pos">{pos}</span>
              {isHero && <span className="dg-seat-stack">{heroStack.toFixed(1)}BB</span>}
              {isVillain && <span className="dg-seat-stack">{villainStack.toFixed(1)}BB</span>}
            </div>
            {(isHero || isVillain) && seatAction[pos] && (
              <div className="dg-seat-action">{seatAction[pos]}</div>
            )}
            {isHero && <div className="dg-seat-badge dg-seat-badge--hero">YOU</div>}
            {isVillain && <div className="dg-seat-badge dg-seat-badge--villain">VIL</div>}
            {pos === 'BTN' && <div className="dg-dealer-chip">D</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  scenario: FullScenario;
  villainProfile: VillainProfile;
  onNewScenario: () => void;
  onVillainChange: (p: VillainProfile) => void;
}

export default function DecisionGame({ scenario, villainProfile, onNewScenario, onVillainChange }: Props) {
  const [streetIndex, setStreetIndex] = useState(0);
  const [pot, setPot] = useState(0);
  const [heroStack, setHeroStack] = useState(scenario.stackDepthBB);
  const [villainStack, setVillainStack] = useState(scenario.stackDepthBB);
  const [heroStreetTotal, setHeroStreetTotal] = useState(0);
  const [heroBetChip, setHeroBetChip] = useState<number | null>(null);
  const [villainBetChip, setVillainBetChip] = useState<number | null>(null);
  const [facing, setFacing] = useState<Facing | null>(null);
  const [raiseCount, setRaiseCount] = useState(0);
  const [betMode, setBetMode] = useState<'bet' | 'raise' | null>(null);
  const [betValue, setBetValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'playing' | 'feedback'>('playing');
  const [currentRangeCats, setCurrentRangeCats] = useState<Set<string>>(new Set());
  const [rangeCatsByStreet, setRangeCatsByStreet] = useState<Partial<Record<StreetName, string[]>>>({});
  const [seatAction, setSeatAction] = useState<Partial<Record<string, string>>>({});
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Authoritative mutable game state — avoids stale closures across the
  // multi-step async reveal chains (villain scripted actions, synthesized
  // reactions to hero-initiated bets, etc).
  const potRef = useRef(0);
  const heroStackRef = useRef(scenario.stackDepthBB);
  const villainStackRef = useRef(scenario.stackDepthBB);
  const heroTotalRef = useRef(0);
  const villainTotalRef = useRef(0);
  const raiseCountRef = useRef(0);
  const actionLogRef = useRef<LogEntry[]>([]);
  const rangeCatsByStreetRef = useRef<Partial<Record<StreetName, string[]>>>({});
  const currentRangeCatsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentRangeCatsRef.current = currentRangeCats;
  }, [currentRangeCats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const pushState = useCallback(() => {
    setPot(potRef.current);
    setHeroStack(heroStackRef.current);
    setVillainStack(villainStackRef.current);
    setHeroStreetTotal(heroTotalRef.current);
    setHeroBetChip(heroTotalRef.current || null);
    setVillainBetChip(villainTotalRef.current || null);
    setRaiseCount(raiseCountRef.current);
    setActionLog([...actionLogRef.current]);
  }, []);

  const announce = useCallback(async (position: Position, isHero: boolean, kind: 'checks' | 'calls' | 'bets' | 'raises' | 'folds', toBB: number | undefined, street: StreetName) => {
    const text = actionText(kind, toBB);
    setSeatAction(prev => ({ ...prev, [position]: text }));
    actionLogRef.current = [...actionLogRef.current, { street, position, isHero, text }];
    pushState();
    await sleep(1000);
  }, [pushState]);

  const buildHandSummary = useCallback((resultNote?: string): string => {
    const { heroPosition, villainPosition, heroCards, stackDepthBB } = scenario;
    const cardStr = heroCards.map(formatCard).join('');
    let s = `Hero: ${heroPosition} | Villain: ${villainPosition} | Stack: ${stackDepthBB}BB | Hero cards: ${cardStr}\n`;
    s += `Villain type: ${villainProfile.name}\n\n`;
    if (resultNote) s += `${resultNote}\n`;
    for (const street of STREETS) {
      const entries = actionLogRef.current.filter(e => e.street === street);
      if (entries.length === 0) continue;
      const idx = STREETS.indexOf(street);
      const board = street === 'preflop' ? 'preflop' : boardStr(allBoardCards(scenario, idx));
      s += `${street.toUpperCase()} — Board: ${board}\n`;
      for (const e of entries) s += `  ${e.position}: ${e.text}\n`;
      const cats = rangeCatsByStreetRef.current[street];
      if (street !== 'preflop' && cats) {
        s += `  Hero's range read on villain: [${cats.join(', ') || 'none selected'}]\n`;
      }
      s += '\n';
    }
    return s;
  }, [scenario, villainProfile]);

  // Streams a coach response for the given conversation history. Surfaces
  // both network/HTTP failures and in-band SSE `error` events as a visible
  // chat message instead of leaving the UI stuck on the typing indicator —
  // previously any failure (bad API key, model error, timeout) was silently
  // swallowed because only `data.text` was ever read from the stream.
  const runCoachStream = useCallback(async (history: ChatMessage[]) => {
    setIsLoading(true);
    let text = '';
    let sawError: string | null = null;
    try {
      const response = await fetch(`${API_BASE}/api/decision-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          villainName: villainProfile.name,
          villainContext: villainProfile.coachContext,
        }),
      });

      if (!response.ok || !response.body) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(bodyText || `Coach request failed (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              text += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: text };
                return updated;
              });
            } else if (data.error) {
              sawError = data.error;
            }
          } catch { /* skip malformed SSE line */ }
        }
      }

      if (sawError && !text) throw new Error(sawError);

      const match = text.match(/\*\*(?:Updated )?Rating:\s*(\d+)\/100\*\*/i);
      if (match) setRating(parseInt(match[1]));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      const errorMsg = `⚠️ Coach is unavailable right now (${reason}). Check that ANTHROPIC_API_KEY is configured on the server.`;
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant' && updated[updated.length - 1].content === '') {
          updated[updated.length - 1] = { role: 'assistant', content: errorMsg };
        } else {
          updated.push({ role: 'assistant', content: errorMsg });
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [villainProfile]);

  const streamFeedback = useCallback(async (userText: string) => {
    const userMsg: ChatMessage = { role: 'user', content: userText };
    setMessages([userMsg]);
    await runCoachStream([userMsg]);
  }, [runCoachStream]);

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: followUpInput };
    const history = [...messages, userMsg];
    setMessages(history);
    setFollowUpInput('');
    await runCoachStream(history);
  };

  const kickOffCoach = useCallback(async (resultNote?: string) => {
    const summary = buildHandSummary(resultNote);
    await streamFeedback(`Please evaluate my decisions in this hand:\n\n${summary}`);
  }, [buildHandSummary, streamFeedback]);

  // Reveals villain's scripted opening action for a street (villain always
  // opens preflop, and opens postflop streets whenever hero is IP). Ends
  // either with facing=null (villain checked — hero's turn to check/bet) or
  // facing={toBB} (villain bet/raised — hero must fold/call/raise).
  const runVillainOpensStreet = useCallback(async (idx: number) => {
    const street = STREETS[idx];
    const villainOpens = idx === 0 || scenario.heroIsIP;
    if (!villainOpens) {
      setFacing(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    const action = getVillainAction(scenario, idx);
    if (!action || action.action === 'checks') {
      await announce(scenario.villainPosition, false, 'checks', undefined, street);
      setFacing(null);
    } else {
      const toBB = action.sizingBB ?? Math.round(potRef.current * (action.sizingPct ?? 0) / 100 * 10) / 10;
      villainTotalRef.current = toBB;
      villainStackRef.current -= toBB;
      potRef.current += toBB;
      raiseCountRef.current = 1;
      pushState();
      await announce(scenario.villainPosition, false, action.action === 'raises' ? 'raises' : 'bets', toBB, street);
      setFacing({ toBB });
    }
    setBusy(false);
  }, [scenario, announce, pushState]);

  // Resets per-hand state and kicks off the preflop opening whenever a new
  // scenario (new hand) arrives.
  useEffect(() => {
    potRef.current = 0;
    heroStackRef.current = scenario.stackDepthBB;
    villainStackRef.current = scenario.stackDepthBB;
    heroTotalRef.current = 0;
    villainTotalRef.current = 0;
    raiseCountRef.current = 0;
    actionLogRef.current = [];
    rangeCatsByStreetRef.current = {};

    setStreetIndex(0);
    setPot(0);
    setHeroStack(scenario.stackDepthBB);
    setVillainStack(scenario.stackDepthBB);
    setHeroStreetTotal(0);
    setHeroBetChip(null);
    setVillainBetChip(null);
    setFacing(null);
    setRaiseCount(0);
    setBetMode(null);
    setBetValue('');
    setBusy(false);
    setPhase('playing');
    setCurrentRangeCats(new Set());
    setRangeCatsByStreet({});
    setSeatAction({});
    setActionLog([]);
    setMessages([]);
    setIsLoading(false);
    setFollowUpInput('');
    setRating(null);

    void runVillainOpensStreet(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const resolveStreetEnd = useCallback(async (justResolvedStreet: StreetName) => {
    if (justResolvedStreet !== 'preflop') {
      rangeCatsByStreetRef.current = { ...rangeCatsByStreetRef.current, [justResolvedStreet]: [...currentRangeCatsRef.current] };
      setRangeCatsByStreet({ ...rangeCatsByStreetRef.current });
    }
    if (justResolvedStreet === 'river') {
      setPhase('feedback');
      await kickOffCoach();
      setBusy(false);
      return;
    }
    setSeatAction({});
    heroTotalRef.current = 0;
    villainTotalRef.current = 0;
    raiseCountRef.current = 0;
    pushState();
    setFacing(null);
    const nextIdx = STREETS.indexOf(justResolvedStreet) + 1;
    setStreetIndex(nextIdx);
    await runVillainOpensStreet(nextIdx);
  }, [pushState, runVillainOpensStreet, kickOffCoach]);

  const endHand = useCallback(async (resultNote: string) => {
    setPhase('feedback');
    await kickOffCoach(resultNote);
    setBusy(false);
  }, [kickOffCoach]);

  const handleHeroAction = useCallback(async (kind: HeroActionType, toBB?: number) => {
    if (busy) return;
    setBusy(true);
    setBetMode(null);
    setBetValue('');
    const street = STREETS[streetIndex];

    if (kind === 'fold') {
      await announce(scenario.heroPosition, true, 'folds', undefined, street);
      await endHand(`Result: Hero folds. Villain (${scenario.villainPosition}) wins the ${potRef.current.toFixed(1)}BB pot.`);
      return;
    }

    if (kind === 'check') {
      await announce(scenario.heroPosition, true, 'checks', undefined, street);
      if (scenario.heroIsIP) {
        // Hero checks back after villain's earlier check — street is over.
        await resolveStreetEnd(street);
        return;
      }
      // Hero is OOP and opened with a check — reveal villain's scripted reaction.
      const vAction = getVillainAction(scenario, streetIndex);
      if (!vAction || vAction.action === 'checks') {
        await announce(scenario.villainPosition, false, 'checks', undefined, street);
        await resolveStreetEnd(street);
      } else {
        const vToBB = vAction.sizingBB ?? Math.round(potRef.current * (vAction.sizingPct ?? 0) / 100 * 10) / 10;
        villainTotalRef.current = vToBB;
        villainStackRef.current -= vToBB;
        potRef.current += vToBB;
        raiseCountRef.current = 1;
        pushState();
        await announce(scenario.villainPosition, false, 'bets', vToBB, street);
        setFacing({ toBB: vToBB });
        setBusy(false);
      }
      return;
    }

    if (kind === 'call') {
      const callTo = facing?.toBB ?? villainTotalRef.current;
      const delta = Math.round((callTo - heroTotalRef.current) * 10) / 10;
      heroTotalRef.current = callTo;
      heroStackRef.current -= delta;
      potRef.current += delta;
      pushState();
      await announce(scenario.heroPosition, true, 'calls', undefined, street);
      await resolveStreetEnd(street);
      return;
    }

    // bet / raise
    const myToBB = toBB!;
    const delta = Math.round((myToBB - heroTotalRef.current) * 10) / 10;
    heroTotalRef.current = myToBB;
    heroStackRef.current -= delta;
    potRef.current += delta;
    raiseCountRef.current += 1;
    pushState();
    await announce(scenario.heroPosition, true, kind === 'bet' ? 'bets' : 'raises', myToBB, street);

    const allowRaise = raiseCountRef.current < 2;
    const reaction = synthesizeVillainReaction(villainProfile, allowRaise);

    if (reaction === 'fold') {
      await announce(scenario.villainPosition, false, 'folds', undefined, street);
      await endHand(`Result: Villain folds. Hero wins the ${potRef.current.toFixed(1)}BB pot.`);
      return;
    }

    if (reaction === 'call') {
      const vDelta = Math.round((myToBB - villainTotalRef.current) * 10) / 10;
      villainTotalRef.current = myToBB;
      villainStackRef.current -= vDelta;
      potRef.current += vDelta;
      pushState();
      await announce(scenario.villainPosition, false, 'calls', undefined, street);
      await resolveStreetEnd(street);
      return;
    }

    // villain raises
    const raiseTo = Math.round(myToBB * 2.2 * 2) / 2;
    const vDelta = Math.round((raiseTo - villainTotalRef.current) * 10) / 10;
    villainTotalRef.current = raiseTo;
    villainStackRef.current -= vDelta;
    potRef.current += vDelta;
    raiseCountRef.current += 1;
    pushState();
    await announce(scenario.villainPosition, false, 'raises', raiseTo, street);
    setFacing({ toBB: raiseTo });
    setBusy(false);
  }, [busy, streetIndex, scenario, facing, villainProfile, announce, pushState, resolveStreetEnd, endHand]);

  const currentStreet = STREETS[streetIndex];
  const isPreflop = streetIndex === 0;
  const callDelta = facing ? Math.round((facing.toBB - heroStreetTotal) * 10) / 10 : 0;
  const options = getHeroOptions(facing, callDelta, isPreflop, raiseCount);
  const needsRange = !isPreflop && currentRangeCats.size === 0;

  const onOptionClick = (opt: ActionOption) => {
    if (busy || needsRange) return;
    if (opt.needsBet) {
      setBetMode(opt.value as 'bet' | 'raise');
      const defaultBB = facing
        ? Math.round(facing.toBB * (isPreflop ? 3 : 2.5) * 2) / 2
        : Math.round(pot * 0.6 * 10) / 10;
      setBetValue(String(defaultBB > 0 ? defaultBB : 1));
    } else {
      void handleHeroAction(opt.value);
    }
  };

  const onBetSubmit = () => {
    if (needsRange) return;
    const bb = parseFloat(betValue);
    if (isNaN(bb) || bb <= 0) return;
    void handleHeroAction(betMode === 'bet' ? 'bet' : 'raise', bb);
  };

  const heroActionCount = actionLog.filter(e => e.isHero).length;
  const historyStreets = STREETS.filter(s => actionLog.some(e => e.street === s));

  return (
    <div className="coach-two-panel">
      {/* ── Sidebar ── */}
      <div className="coach-sidebar">
        <div className="t-sidebar-header">
          <div className="t-sidebar-title">
            <span style={{ fontSize: '1rem' }}>🎯</span>
            Ranging Opponents
          </div>
          <button className="t-btn t-btn--primary t-btn--sm" onClick={onNewScenario}>
            New Hand
          </button>
        </div>

        <div className="coach-sidebar-body">
          <VillainPicker
            selected={villainProfile}
            onChange={onVillainChange}
            disabled={phase === 'feedback'}
          />

          {rating !== null && (
            <div className="coach-rating-card">
              <div className="t-section-label">Hand Rating</div>
              <div className={`coach-rating-num ${rating >= 80 ? 'coach-rating--high' : rating >= 60 ? 'coach-rating--mid' : 'coach-rating--low'}`}>
                {rating}<span className="coach-rating-denom">/100</span>
              </div>
            </div>
          )}

          {historyStreets.length > 0 && (
            <div className="dg-action-history">
              <div className="t-section-label">Action History</div>
              {historyStreets.map(s => (
                <div key={s} className="dg-history-street">
                  <div className="dg-history-street-label">{s}</div>
                  {actionLog.filter(e => e.street === s).map((e, i) => (
                    <div key={i} className={`dg-history-row ${e.isHero ? 'dg-history-row--hero' : 'dg-history-row--villain'}`}>
                      <span className="dg-history-pos">{e.position}</span>
                      <span className="dg-history-text">{e.text}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="coach-sidebar-hint">
            <div className="t-section-label">How to play</div>
            <p>Play your hand against the villain. Make exploitative decisions based on their tendencies. Your coach reviews every decision at the end.</p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="coach-content">
        {/* Game column */}
        <div className={`coach-game-col dg-game-col ${phase === 'playing' ? 'dg-game-col--full' : ''}`}>
          <PokerTable
            scenario={scenario}
            streetIndex={streetIndex}
            pot={pot}
            heroStack={heroStack}
            villainStack={villainStack}
            heroBetBB={heroBetChip}
            villainBetBB={villainBetChip}
            seatAction={seatAction}
          />

          {phase === 'playing' && (
            <div className="dg-action-panel">
              {!isPreflop && (
                <RangeCategoryPicker
                  selected={currentRangeCats}
                  previousSelected={
                    streetIndex > 1 && rangeCatsByStreet[STREETS[streetIndex - 1]]
                      ? new Set(rangeCatsByStreet[STREETS[streetIndex - 1]])
                      : undefined
                  }
                  onChange={setCurrentRangeCats}
                  locked={busy}
                />
              )}

              <div className="dg-hero-label">Your action — {currentStreet}</div>

              {busy ? (
                <div className="dg-waiting">…</div>
              ) : betMode ? (
                <div className="dg-bet-row">
                  <input
                    className="dg-bet-input"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={betValue}
                    onChange={e => setBetValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onBetSubmit()}
                    autoFocus
                  />
                  <span className="dg-bet-unit">BB</span>
                  <button className="dg-action-btn dg-action-btn--confirm" onClick={onBetSubmit}>
                    Confirm
                  </button>
                  <button className="dg-action-btn dg-action-btn--cancel" onClick={() => setBetMode(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {needsRange && (
                    <div className="dg-range-required">Range villain before you act</div>
                  )}
                  <div className="dg-action-btns">
                    {options.map(opt => (
                      <button
                        key={opt.value}
                        className={`dg-action-btn dg-action-btn--${opt.value}`}
                        onClick={() => onOptionClick(opt)}
                        disabled={needsRange}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {phase === 'feedback' && (
            <div className="dg-complete-bar">
              <span>Hand complete — {heroActionCount} decision{heroActionCount !== 1 ? 's' : ''} reviewed</span>
              <button className="new-hand-btn-bar" onClick={onNewScenario}>New Hand</button>
            </div>
          )}
        </div>

        {/* Chat column — hidden until the hand is over */}
        {phase === 'feedback' && (
          <div className="coach-chat-col">
            <div className="coach-chat-header">
              <div className="coach-header-top">
                <h2>Coach</h2>
                {rating !== null && (
                  <span className={`rating-badge ${rating >= 80 ? 'high' : rating >= 60 ? 'mid' : 'low'}`}>
                    {rating}/100
                  </span>
                )}
              </div>
            </div>

            <div className="coach-chat dg-chat">
              <div className="messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-role">{msg.role === 'user' ? 'Hand' : 'Coach'}</div>
                    <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-role">Coach</div>
                    <div className="message-content typing"><span /><span /><span /></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {messages.length > 1 && (
                <form className="follow-up-form" onSubmit={e => { e.preventDefault(); void handleFollowUp(); }}>
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={e => setFollowUpInput(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    disabled={isLoading}
                  />
                  <button type="submit" disabled={isLoading || !followUpInput.trim()}>Send</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
