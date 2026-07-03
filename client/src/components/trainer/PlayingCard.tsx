import type { TrainingCard } from '../../types/trainer';

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR: Record<string, string> = { s: '#1e293b', h: '#dc2626', d: '#2563eb', c: '#16a34a' };

interface Props {
  card: TrainingCard;
  size?: 'sm' | 'md' | 'lg';
}

export default function PlayingCard({ card, size = 'lg' }: Props) {
  const symbol = SUIT_SYMBOL[card.suit];
  const color = SUIT_COLOR[card.suit];
  const isLg = size === 'lg' || size === 'md';

  return (
    <div
      className={`playing-card playing-card--${size}`}
      style={{ color }}
    >
      <span className="playing-card__rank">{card.rank}</span>
      <span className={`playing-card__suit ${isLg ? 'playing-card__suit--center' : ''}`}>
        {symbol}
      </span>
      <span className="playing-card__rank playing-card__rank--bottom">{card.rank}</span>
    </div>
  );
}
