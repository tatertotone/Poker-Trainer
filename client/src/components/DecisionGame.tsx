import { useState, useCallback, useRef, useEffect } from 'react';
import type { FullScenario, Action, StreetName, ChatMessage, VillainProfile, Card, Suit } from '../types/poker';
import { formatCard } from '../utils/scenarioGenerator';
import VillainPicker from './VillainPicker';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const STREETS: StreetName[] = ['preflop', 'flop', 'turn', 'river'];

const SUIT_SYMBOL: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR: Record<Suit, string> = { h: '#dc2626', d: '#dc2626', c: '#1a7a3a', s: '#111827' };

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

interface HeroDecision {
  streetIndex: number;
  street: StreetName;
  villainActionStr: string;
  villainBetBB: number | null;
  heroAction: HeroActionType;
  heroBetBB: number | null;
  potBefore: number;
  board: string;
}

interface ActionOption {
  label: string;
  value: HeroActionType;
  needsBet?: boolean;
  callAmount?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVillainAction(scenario: FullScenario, streetIndex: number): Action | null {
  return scenario.streets[streetIndex].actions.find(
    a => a.position === scenario.villainPosition
  ) ?? null;
}

function formatVillainActionStr(action: Action | null, pot: number): string {
  if (!action) return 'checks';
  const v = action.action;
  if (v === 'checks') return 'checks';
  if (v === 'bets') {
    const bb = action.sizingBB;
    const pct = action.sizingPct;
    if (bb) return `bets ${bb}BB`;
    if (pct) return `bets ${Math.round(pot * pct / 100 * 10) / 10}BB (${pct}% pot)`;
    return 'bets';
  }
  if (v === 'raises' || v === '3-bets') {
    return action.sizingBB ? `raises to ${action.sizingBB}BB` : 'raises';
  }
  if (v === 'check-raises') {
    return action.sizingBB ? `check-raises to ${action.sizingBB}BB` : 'check-raises';
  }
  if (v === 'calls') return 'calls';
  return v;
}

function getVillainBetBB(action: Action | null, pot: number): number | null {
  if (!action) return null;
  const v = action.action;
  if (v === 'checks' || v === 'calls') return null;
  if (action.sizingBB) return action.sizingBB;
  if (action.sizingPct) return Math.round(pot * action.sizingPct / 100 * 10) / 10;
  return null;
}

function getHeroOptions(action: Action | null, isPreflop: boolean): ActionOption[] {
  const v = action?.action;
  if (!v || v === 'checks') {
    return isPreflop
      ? [{ label: 'Fold', value: 'fold' }, { label: 'Check/Limp', value: 'call' }, { label: 'Raise', value: 'raise', needsBet: true }]
      : [{ label: 'Check', value: 'check' }, { label: 'Bet', value: 'bet', needsBet: true }];
  }
  if (v === 'calls') {
    return [{ label: 'Fold', value: 'fold' }, { label: 'Call', value: 'call' }, { label: 'Raise', value: 'raise', needsBet: true }];
  }
  const callAmt = action?.sizingBB ?? null;
  return [
    { label: 'Fold', value: 'fold' },
    { label: callAmt ? `Call ${callAmt}BB` : 'Call', value: 'call', callAmount: callAmt ?? undefined },
    { label: isPreflop ? '3-Bet' : 'Raise', value: 'raise', needsBet: true },
  ];
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
  heroBetBB: number | null;
  villainBetBB: number | null;
}

function PokerTable({ scenario, streetIndex, pot, heroBetBB, villainBetBB }: TableProps) {
  const { heroPosition, villainPosition, heroCards, stackDepthBB } = scenario;

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
              {(isHero || isVillain) && <span className="dg-seat-stack">{stackDepthBB}BB</span>}
            </div>
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
  const [decisions, setDecisions] = useState<HeroDecision[]>([]);
  const [pot, setPot] = useState(1.5);
  const [heroBetChip, setHeroBetChip] = useState<number | null>(null);
  const [villainBetChip, setVillainBetChip] = useState<number | null>(null);
  const [betMode, setBetMode] = useState<'bet' | 'raise' | null>(null);
  const [betValue, setBetValue] = useState('');
  const [phase, setPhase] = useState<'playing' | 'feedback'>('playing');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset when scenario changes
  useEffect(() => {
    const vilAction = getVillainAction(scenario, 0);
    const vilBet = getVillainBetBB(vilAction, 1.5);
    setStreetIndex(0);
    setDecisions([]);
    setPot(1.5);
    setHeroBetChip(null);
    setVillainBetChip(vilBet);
    setBetMode(null);
    setBetValue('');
    setPhase('playing');
    setMessages([]);
    setIsLoading(false);
    setFollowUpInput('');
    setRating(null);
  }, [scenario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const currentStreet = STREETS[streetIndex];
  const isPreflop = streetIndex === 0;
  const vilAction = getVillainAction(scenario, streetIndex);
  const vilActionStr = formatVillainActionStr(vilAction, pot);
  const options = getHeroOptions(vilAction, isPreflop);

  const buildHandSummary = useCallback((finalDecisions: HeroDecision[]): string => {
    const { heroPosition, villainPosition, heroCards, stackDepthBB } = scenario;
    const cardStr = heroCards.map(formatCard).join('');
    let s = `Hero: ${heroPosition} | Villain: ${villainPosition} | Stack: ${stackDepthBB}BB | Hero cards: ${cardStr}\n`;
    s += `Villain type: ${villainProfile.name}\n\n`;
    for (const d of finalDecisions) {
      s += `${d.street.toUpperCase()} — Board: ${d.board}\n`;
      s += `  Villain: ${d.villainActionStr}\n`;
      const heroStr = d.heroAction === 'bet' || d.heroAction === 'raise'
        ? `${d.heroAction}s ${d.heroBetBB}BB`
        : `${d.heroAction}s`;
      s += `  Hero: ${heroStr} (pot was ${d.potBefore.toFixed(1)}BB)\n\n`;
    }
    return s;
  }, [scenario, villainProfile]);

  const streamFeedback = useCallback(async (summary: string) => {
    const userMsg: ChatMessage = { role: 'user', content: summary };
    setMessages([userMsg]);
    setIsLoading(true);

    let text = '';
    const response = await fetch(`${API_BASE}/api/decision-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [userMsg],
        villainName: villainProfile.name,
        villainContext: villainProfile.coachContext,
      }),
    });

    if (!response.body) { setIsLoading(false); return; }
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
          }
        } catch { /* skip */ }
      }
    }

    const match = text.match(/\*\*(?:Updated )?Rating:\s*(\d+)\/100\*\*/i);
    if (match) setRating(parseInt(match[1]));
    setIsLoading(false);
  }, [villainProfile, API_BASE]);

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: followUpInput };
    const history = [...messages, userMsg];
    setMessages(history);
    setFollowUpInput('');
    setIsLoading(true);

    let text = '';
    const response = await fetch(`${API_BASE}/api/decision-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        villainName: villainProfile.name,
        villainContext: villainProfile.coachContext,
      }),
    });

    if (!response.body) { setIsLoading(false); return; }
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
          }
        } catch { /* skip */ }
      }
    }

    const match = text.match(/\*\*(?:Updated )?Rating:\s*(\d+)\/100\*\*/i);
    if (match) setRating(parseInt(match[1]));
    setIsLoading(false);
  };

  const commitDecision = useCallback((heroAction: HeroActionType, heroBetBB: number | null) => {
    const board = streetIndex === 0 ? 'preflop' : boardStr(allBoardCards(scenario, streetIndex));
    const vilBet = getVillainBetBB(vilAction, pot);

    const decision: HeroDecision = {
      streetIndex,
      street: currentStreet,
      villainActionStr: vilActionStr,
      villainBetBB: vilBet,
      heroAction,
      heroBetBB,
      potBefore: pot,
      board,
    };

    const newDecisions = [...decisions, decision];
    setDecisions(newDecisions);

    // Update pot
    let newPot = pot;
    if (vilBet) newPot += vilBet;
    if (heroAction === 'call' && vilBet) newPot += vilBet;
    if ((heroAction === 'bet' || heroAction === 'raise') && heroBetBB) newPot += heroBetBB;
    setPot(newPot);

    if (heroAction === 'fold' || streetIndex === 3) {
      // Hand over — get feedback
      setHeroBetChip(heroBetBB);
      setVillainBetChip(null);
      setPhase('feedback');
      const summary = `Please evaluate my decisions in this hand:\n\n${buildHandSummary(newDecisions)}`;
      void streamFeedback(summary);
    } else {
      // Advance to next street
      const nextIndex = streetIndex + 1;
      const nextVilAction = getVillainAction(scenario, nextIndex);
      const nextVilBet = getVillainBetBB(nextVilAction, newPot);
      setHeroBetChip(heroBetBB);
      setVillainBetChip(nextVilBet);
      setStreetIndex(nextIndex);
      setBetMode(null);
      setBetValue('');
    }
  }, [streetIndex, vilAction, vilActionStr, pot, decisions, currentStreet, scenario, buildHandSummary, streamFeedback]);

  const handleAction = (opt: ActionOption) => {
    if (opt.needsBet) {
      setBetMode(opt.value as 'bet' | 'raise');
      const defaultBB = opt.value === 'raise' && opt.callAmount
        ? opt.callAmount * 3
        : Math.round(pot * 0.6 * 10) / 10;
      setBetValue(String(defaultBB));
    } else {
      commitDecision(opt.value, null);
    }
  };

  const handleBetSubmit = () => {
    const bb = parseFloat(betValue);
    if (isNaN(bb) || bb <= 0) return;
    commitDecision(betMode === 'bet' ? 'bet' : 'raise', bb);
    setBetMode(null);
    setBetValue('');
  };

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

          {phase === 'playing' && decisions.length > 0 && (
            <div className="dg-decision-log">
              <div className="t-section-label">Decisions</div>
              {decisions.map((d, i) => (
                <div key={i} className="dg-log-row">
                  <span className="dg-log-street">{d.street}</span>
                  <span className="dg-log-action">
                    {d.heroAction === 'bet' || d.heroAction === 'raise'
                      ? `${d.heroAction} ${d.heroBetBB}BB`
                      : d.heroAction}
                  </span>
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
        <div className="coach-game-col dg-game-col">
          <PokerTable
            scenario={scenario}
            streetIndex={streetIndex}
            pot={pot}
            heroBetBB={heroBetChip}
            villainBetBB={villainBetChip}
          />

          {phase === 'playing' && (
            <div className="dg-action-panel">
              <div className="dg-villain-action">
                <span className="dg-villain-label">{scenario.villainPosition}</span>
                <span className="dg-villain-verb">{vilActionStr}</span>
              </div>

              <div className="dg-hero-label">Your action — {currentStreet}</div>

              {betMode ? (
                <div className="dg-bet-row">
                  <input
                    className="dg-bet-input"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={betValue}
                    onChange={e => setBetValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleBetSubmit()}
                    autoFocus
                  />
                  <span className="dg-bet-unit">BB</span>
                  <button className="dg-action-btn dg-action-btn--confirm" onClick={handleBetSubmit}>
                    Confirm
                  </button>
                  <button className="dg-action-btn dg-action-btn--cancel" onClick={() => setBetMode(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="dg-action-btns">
                  {options.map(opt => (
                    <button
                      key={opt.value}
                      className={`dg-action-btn dg-action-btn--${opt.value}`}
                      onClick={() => handleAction(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'feedback' && (
            <div className="dg-complete-bar">
              <span>Hand complete — {decisions.length} decision{decisions.length !== 1 ? 's' : ''} reviewed</span>
              <button className="new-hand-btn-bar" onClick={onNewScenario}>New Hand</button>
            </div>
          )}
        </div>

        {/* Chat column */}
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
            {phase === 'playing' && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Play out the hand — coach reviews when it ends.
              </p>
            )}
          </div>

          <div className="coach-chat dg-chat">
            <div className="messages">
              {messages.length === 0 && (
                <div className="coach-empty">
                  <div className="coach-empty-icon">🎯</div>
                  <p>Play through the hand making your decisions. When the hand ends, your coach will review every choice you made against this villain type.</p>
                </div>
              )}
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

            {phase === 'feedback' && messages.length > 1 && (
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
      </div>
    </div>
  );
}
