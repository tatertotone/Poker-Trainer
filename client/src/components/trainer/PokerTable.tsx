import PlayingCard from './PlayingCard';
import type { TrainingCard } from '../../types/trainer';

export interface TableSeat {
  position: string;
  isHero: boolean;
  stack: number; // in BB
  state: 'waiting' | 'folded' | 'raised' | 'limped' | 'blind';
  betAmount?: number; // chips in front (blind/raise size)
  holeCards?: [TrainingCard, TrainingCard]; // hero only
  isDealer: boolean;
}

interface Props {
  seats: TableSeat[]; // seats[0] = hero, rest clockwise
  pot: number; // in BB
}

// Returns percentage-based positions — works at any container size
function seatPos(idx: number, total: number) {
  const angle = ((180 + idx * (360 / total)) % 360) * (Math.PI / 180);
  return {
    leftPct: 50 + 42 * Math.sin(angle),
    topPct:  50 - 40 * Math.cos(angle),
  };
}

export default function PokerTable({ seats, pot }: Props) {
  return (
    <div className="pt-wrap">
      <div className="pt-outer">
        <div className="pt-felt">
          {/* Inner rail line */}
          <div className="pt-rail-inner" />

          {/* Pot */}
          <div className="pt-center">
            <div className="pt-pot">
              <span className="pt-pot-label">Pot</span>
              <span className="pt-pot-amount">{pot.toFixed(1)}BB</span>
            </div>
          </div>

          {/* Seats */}
          {seats.map((seat, i) => {
            const { leftPct, topPct } = seatPos(i, seats.length);
            return (
              <div
                key={seat.position}
                className={`pt-seat${seat.isHero ? ' pt-seat--hero' : ' pt-seat--opp'}${seat.state === 'folded' ? ' pt-seat--folded' : ''}`}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                {seat.isHero ? (
                  <>
                    <div className="pt-hero-cards">
                      {seat.holeCards && <>
                        <PlayingCard card={seat.holeCards[0]} size="md" />
                        <PlayingCard card={seat.holeCards[1]} size="md" />
                      </>}
                    </div>
                    <div className="pt-nameplate">
                      {seat.isDealer && <span className="pt-dealer-btn">D</span>}
                      <span className="pt-name">{seat.position}</span>
                      <span className="pt-stack">{seat.stack}BB</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pt-opp-cards">
                      <div className={`pt-card-back${seat.state === 'folded' ? ' pt-card-back--folded' : ''}`} />
                      <div className={`pt-card-back${seat.state === 'folded' ? ' pt-card-back--folded' : ''}`} />
                    </div>
                    {seat.betAmount != null && seat.betAmount > 0 && (
                      <div className={`pt-chip${seat.state === 'raised' ? ' pt-chip--raise' : seat.state === 'limped' ? ' pt-chip--call' : ' pt-chip--blind'}`}>
                        {seat.state === 'raised' ? `↑${seat.betAmount}` : seat.betAmount}BB
                      </div>
                    )}
                    <div className="pt-nameplate pt-nameplate--opp">
                      {seat.isDealer && <span className="pt-dealer-btn">D</span>}
                      <span className="pt-name">{seat.position}</span>
                      <span className="pt-stack">{seat.stack}BB</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
