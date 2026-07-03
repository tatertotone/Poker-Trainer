import type { FullScenario, Card, Suit, StreetName } from '../types/poker';
import { formatAction } from '../utils/scenarioGenerator';

// ── Suit styling ──────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR: Record<Suit, string> = {
  h: '#dc2626',
  d: '#dc2626',
  c: '#111827',
  s: '#111827',
};

const STREET_ORDER: StreetName[] = ['preflop', 'flop', 'turn', 'river'];

// ── Seat layout ───────────────────────────────────────────────────────────────
// Clockwise order: UTG → HJ → CO → BTN → SB → BB
// Positions as % of the 470px × 230px table-wrapper

const SEAT_CENTERS: Partial<Record<string, { cx: string; cy: string }>> = {
  UTG:    { cx: '9%',  cy: '50%' },  // 9 o'clock (left)
  'UTG+1':{ cx: '9%',  cy: '50%' },  // same slot as UTG (mutually exclusive)
  HJ:     { cx: '27%', cy: '10%' },  // 11 o'clock (upper-left)
  CO:     { cx: '73%', cy: '10%' },  // 1 o'clock  (upper-right)
  BTN:    { cx: '91%', cy: '50%' },  // 3 o'clock  (right)
  SB:     { cx: '73%', cy: '90%' },  // 5 o'clock  (lower-right)
  BB:     { cx: '27%', cy: '90%' },  // 7 o'clock  (lower-left)
};

// ── Card components ───────────────────────────────────────────────────────────

function FaceUpCard({ card }: { card: Card }) {
  return (
    <div className="hole-card face-up">
      <span style={{ color: SUIT_COLOR[card.suit] }}>
        {card.rank}<span className="hole-suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
    </div>
  );
}

function FaceDownCard() {
  return <div className="hole-card face-down" />;
}

function CommunityCard({ card }: { card: Card }) {
  return (
    <div className="community-card">
      <span style={{ color: SUIT_COLOR[card.suit] }}>
        {card.rank}<span className="comm-suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
    </div>
  );
}

// ── Seat component ────────────────────────────────────────────────────────────

interface SeatProps {
  position: string;
  isHero: boolean;
  isVillain: boolean;
  heroCards?: [Card, Card];
  stack: number;
}

function Seat({ position, isHero, isVillain, heroCards, stack }: SeatProps) {
  const center = SEAT_CENTERS[position];
  if (!center) return null;

  const isDealer = position === 'BTN';

  const cls = [
    'table-seat',
    isHero ? 'is-hero' : '',
    isVillain ? 'is-villain' : '',
    !isHero && !isVillain ? 'is-other' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ left: center.cx, top: center.cy, transform: 'translate(-50%, -50%)' }}
    >
      {/* Cards */}
      <div className="seat-cards">
        {isHero && heroCards ? (
          <>
            <FaceUpCard card={heroCards[0]} />
            <FaceUpCard card={heroCards[1]} />
          </>
        ) : isVillain ? (
          <>
            <FaceDownCard />
            <FaceDownCard />
          </>
        ) : (
          <>
            <div className="hole-card folded" />
            <div className="hole-card folded" />
          </>
        )}
      </div>

      {/* Label */}
      <div className="seat-label">
        <span className="seat-pos">{position}</span>
        {(isHero || isVillain) && (
          <span className="seat-stack">{stack}BB</span>
        )}
      </div>

      {/* Role badge */}
      {isHero && <div className="seat-badge hero-badge">YOU</div>}
      {isVillain && <div className="seat-badge villain-badge">VIL</div>}

      {/* Dealer button chip */}
      {isDealer && <div className="dealer-chip">D</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  scenario: FullScenario;
  currentStreetIndex: number;
  onNewScenario: () => void;
}

export default function ScenarioDisplay({ scenario, currentStreetIndex, onNewScenario }: Props) {
  const { heroPosition, villainPosition, stackDepthBB, streets, heroCards } = scenario;

  // Board cards revealed progressively
  const revealedFlop  = currentStreetIndex >= 1 ? streets[1].newCards : [];
  const revealedTurn  = currentStreetIndex >= 2 ? streets[2].newCards : [];
  const revealedRiver = currentStreetIndex >= 3 ? streets[3].newCards : [];

  const currentStreet = streets[currentStreetIndex];
  const currentPot = currentStreetIndex === 0
    ? streets[0].potAfter
    : streets[currentStreetIndex - 1].potAfter;

  // Which seats to render — UTG and UTG+1 are mutually exclusive
  const allSeats = ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const activeSpecial = new Set([heroPosition as string, villainPosition as string]);
  const seatsToShow = allSeats.filter(pos => {
    if (activeSpecial.has(pos)) return true;
    if (pos === 'UTG+1' && !activeSpecial.has('UTG+1')) return false;
    if (pos === 'UTG'   && activeSpecial.has('UTG+1'))  return false;
    return true;
  });

  return (
    <div className="scenario-display">

      {/* ── Minimal header: just the New Hand button ── */}
      <div className="scenario-header">
        <button className="new-hand-btn" onClick={onNewScenario}>New Hand</button>
      </div>

      {/* ── Poker Table ── */}
      <div className="table-wrapper">
        <div className="felt">
          <div className="community-area">
            {revealedFlop.length > 0 ? (
              <div className="community-cards">
                {revealedFlop.map((c, i) => <CommunityCard key={`f${i}`} card={c} />)}
                {revealedTurn.length > 0 && <span className="comm-divider" />}
                {revealedTurn.map((c, i) => <CommunityCard key={`t${i}`} card={c} />)}
                {revealedRiver.length > 0 && <span className="comm-divider" />}
                {revealedRiver.map((c, i) => <CommunityCard key={`r${i}`} card={c} />)}
              </div>
            ) : (
              <div className="preflop-label">PREFLOP</div>
            )}
            <div className="pot-chip">Pot: {currentPot}BB</div>
          </div>
        </div>

        {seatsToShow.map(pos => (
          <Seat
            key={pos}
            position={pos}
            isHero={pos === (heroPosition as string)}
            isVillain={pos === (villainPosition as string)}
            heroCards={heroCards}
            stack={stackDepthBB}
          />
        ))}
      </div>

      {/* ── Street tabs ── */}
      <div className="street-tabs">
        {STREET_ORDER.map((s, i) => {
          const isActive = i === currentStreetIndex;
          const isPast = i < currentStreetIndex;
          return (
            <div
              key={s}
              className={`street-tab ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${i > currentStreetIndex ? 'future' : ''}`}
            >
              {isPast && <span className="tab-check">✓</span>}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          );
        })}
      </div>

      {/* ── Action history ── */}
      <div className="action-history">
        {streets.slice(0, currentStreetIndex + 1).map((s) => (
          <div key={s.street} className="action-section">
            <span className={`street-label ${s.street === currentStreet.street ? 'current' : ''}`}>
              {s.street}
            </span>
            <div className="actions">
              {s.actions.length === 0 && (
                <span className="action-item muted">No action</span>
              )}
              {s.actions.map((a, i) => (
                <span
                  key={i}
                  className={`action-item ${a.position === villainPosition ? 'villain' : 'hero'}`}
                >
                  {formatAction(a)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Prompt ── */}
      <div className="scenario-prompt">
        Put <strong>{villainPosition}</strong> on a range after their <strong>{currentStreet.street}</strong> action.
        {currentStreetIndex > 0 && ' Narrow from your previous range.'}
      </div>
    </div>
  );
}
