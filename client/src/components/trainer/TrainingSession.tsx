import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { RangeConfig, TrainingHand, RangeStats, TrainerMode } from '../../types/trainer';
import { loadStats, saveStats, seatsFromHero, computePot, dealHoleCards, shuffle } from '../../utils/trainerUtils';
import PokerTable, { type TableSeat } from './PokerTable';
import ResultGrid from './ResultGrid';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_HAND_COUNT = 300;

/**
 * Minimum probability p such that Binomial(totalDraws, p) ≥ poolSize
 * with 99% probability (normal approximation, z=2.326).
 * This is the lowest "sprinkle" rate that still guarantees full coverage.
 */
function minSprinkelP(poolSize: number, totalDraws: number): number {
  if (poolSize <= 0) return 0;
  if (poolSize >= totalDraws) return 1;
  const r = poolSize / totalDraws;
  return Math.min(1, r + 2.326 * Math.sqrt(poolSize * (totalDraws - poolSize)) / Math.pow(totalDraws, 1.5));
}
const TEST_PASS_THRESHOLD = 0.95;
const TIMER_MS = 1000;
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── Seat builder ──────────────────────────────────────────────────────────────

function buildSeats(range: RangeConfig, stackBB: number, hand: TrainingHand): TableSeat[] {
  const ordered = seatsFromHero(range.position, range.opponents + 1);
  const spotMap = new Map((range.preflopSpot ?? []).map(a => [a.position, a]));
  const btnPos = ordered.includes('BTN') ? 'BTN' : ordered[0];

  return ordered.map((pos): TableSeat => {
    const isHero = pos === range.position;
    const spot = spotMap.get(pos);
    let state: TableSeat['state'] = 'waiting';
    let betAmount: number | undefined;

    if (spot) {
      if (spot.action === 'fold') { state = 'folded'; }
      else if (spot.action === 'raise') { state = 'raised'; betAmount = spot.sizeBB; }
      else if (spot.action === 'limp') { state = 'limped'; betAmount = 1; }
    } else if (!isHero) {
      if (pos === 'SB') { state = 'blind'; betAmount = 0.5; }
      else if (pos === 'BB') { state = 'blind'; betAmount = 1; }
    }

    return { position: pos, isHero, stack: stackBB, state, betAmount,
      holeCards: isHero ? hand.cards : undefined, isDealer: pos === btnPos };
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  range: RangeConfig;
  opponents: number;
  stackBB: number;
  position: string;
  mode: TrainerMode;
  onBack: () => void;
  onTestComplete?: (passed: boolean) => void;
}

interface Result {
  correct: boolean;
  chosenId: string;
  correctId: string | null;
}

interface HandLogEntry { label: string; correct: boolean; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingSession({ range, opponents, stackBB, position, mode, onBack, onTestComplete }: Props) {
  // ── Stats (loaded first so mistake pool can reference initial snapshot) ────

  const [stats, setStats] = useState<RangeStats>(() => {
    const all = loadStats();
    return all[range.id] ?? { rangeId: range.id, totalCorrect: 0, totalAttempts: 0, handStats: {} };
  });

  // ── Drill pool (memoized) ──────────────────────────────────────────────────
  // For 'mistakes' mode, capture the initial stats snapshot so the pool
  // doesn't shift mid-session as new answers arrive.

  const initialStatsRef = useRef(stats);

  const drillPool = useMemo(() => {
    if (mode === 'mistakes') {
      const hs = initialStatsRef.current.handStats;
      const mistakes = Object.entries(hs)
        .filter(([, s]) => s.total > 0 && (s.total - s.correct) / s.total > 0.05)
        .map(([label]) => label);
      return mistakes.length > 0 ? mistakes : Object.keys(range.handActions);
    }
    const testHands = range.testHands ?? [];
    return testHands.length > 0 ? testHands : Object.keys(range.handActions);
  }, [range, mode]);

  // ── Hand picker — pure random, unseen hands sprinkled in at minimum rate ──
  // p is recomputed on every draw based on how many unseen hands remain and
  // how many draws are left. This keeps the guarantee tight as the unseen
  // stack shrinks, rather than over-sprinkling with a fixed upfront rate.
  // When the random branch draws a hand that's still unseen, it's removed
  // from the unseen stack so it isn't double-counted.

  const unseenRef = useRef<string[]>(shuffle([...drillPool]));
  const handsAnsweredRef = useRef(0);

  const getNextLabel = useCallback((): string => {
    const remaining = Math.max(1, TEST_HAND_COUNT - handsAnsweredRef.current);
    const p = minSprinkelP(unseenRef.current.length, remaining);
    if (unseenRef.current.length > 0 && Math.random() < p) {
      return unseenRef.current.pop()!;
    }
    const label = drillPool[Math.floor(Math.random() * drillPool.length)];
    // If this random pick happens to be unseen, remove it from the unseen stack
    const idx = unseenRef.current.indexOf(label);
    if (idx !== -1) unseenRef.current.splice(idx, 1);
    return label;
  }, [drillPool]);

  const makeHand = useCallback((label: string): TrainingHand => ({
    label,
    actionId: range.handActions[label] ?? 'fold',
    cards: dealHoleCards(label),
  }), [range.handActions]);

  // ── Core state ─────────────────────────────────────────────────────────────

  const [hand, setHand] = useState<TrainingHand>(() => makeHand(getNextLabel()));
  const [result, setResult] = useState<Result | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [handLog, setHandLog] = useState<HandLogEntry[]>([]);

  // Test/mistakes-mode only
  const [countdown, setCountdown] = useState<number | null>((mode === 'test' || mode === 'mistakes') ? 3 : null);
  const [timeLeft, setTimeLeft] = useState(TIMER_MS);
  const [handsAnswered, setHandsAnswered] = useState(0);
  const [testDone, setTestDone] = useState(false);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number>(0);
  const resultRef = useRef<Result | null>(null);

  const actionButtons = useMemo(() =>
    range.actions.map(a => ({ id: a.id, label: a.name, color: a.color })),
    [range.actions],
  );

  // ── Core action handler ────────────────────────────────────────────────────

  const handleAction = useCallback((chosenId: string) => {
    if (resultRef.current) return;

    const correctId = hand.actionId ?? 'fold';
    const correct = chosenId === correctId;
    const newResult: Result = { correct, chosenId, correctId };
    resultRef.current = newResult;
    setResult(newResult);
    setSessionCorrect(n => n + (correct ? 1 : 0));
    setSessionTotal(n => n + 1);
    handsAnsweredRef.current += 1;
    setHandsAnswered(handsAnsweredRef.current);
    setHandLog(log => [...log, { label: hand.label, correct }]);

    setStats(prev => {
      const hs = { ...prev.handStats };
      const entry = hs[hand.label] ?? { correct: 0, total: 0 };
      hs[hand.label] = { correct: entry.correct + (correct ? 1 : 0), total: entry.total + 1 };
      const next: RangeStats = {
        ...prev,
        totalCorrect: prev.totalCorrect + (correct ? 1 : 0),
        totalAttempts: prev.totalAttempts + 1,
        handStats: hs,
      };
      const all = loadStats();
      all[range.id] = next;
      saveStats(all);
      return next;
    });
  }, [hand, range.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActionRef = useRef(handleAction);
  useEffect(() => { handleActionRef.current = handleAction; }, [handleAction]);

  // ── Next hand ──────────────────────────────────────────────────────────────

  const nextHand = useCallback(() => {
    resultRef.current = null;
    setResult(null);
    setTimeLeft(TIMER_MS);
    setHand(makeHand(getNextLabel()));
  }, [makeHand, getNextLabel]);

  // ── Test done ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if ((mode !== 'test' && mode !== 'mistakes') || testDone || handsAnswered < TEST_HAND_COUNT) return;
    setTestDone(true);
  }, [handsAnswered, mode, testDone]);

  useEffect(() => {
    if (testDone && onTestComplete) {
      onTestComplete(sessionCorrect / TEST_HAND_COUNT >= TEST_PASS_THRESHOLD);
    }
  }, [testDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (countdown !== 0) return;
    const t = setTimeout(() => setCountdown(null), 600);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Circular timer ─────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    if ((mode !== 'test' && mode !== 'mistakes') || countdown !== null || testDone) return;
    stopTimer();
    setTimeLeft(TIMER_MS);
    timerStartRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const remaining = TIMER_MS - (Date.now() - timerStartRef.current);
      if (remaining <= 0) {
        stopTimer();
        setTimeLeft(0);
        if (!resultRef.current) handleActionRef.current('__timeout__');
      } else {
        setTimeLeft(remaining);
      }
    }, 16);
    return stopTimer;
  }, [hand.label, countdown, testDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (result) stopTimer(); }, [result, stopTimer]);

  // ── Auto-advance ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'practice' || !result || !autoAdvance) return;
    const t = setTimeout(() => nextHand(), 400);
    return () => clearTimeout(t);
  }, [result, autoAdvance, mode, nextHand]);

  useEffect(() => {
    if ((mode !== 'test' && mode !== 'mistakes') || !result?.correct || testDone) return;
    const t = setTimeout(() => nextHand(), 400);
    return () => clearTimeout(t);
  }, [result, mode, testDone, nextHand]);

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (countdown !== null || testDone) return;
      if (result) { if (e.key === 'Enter' || e.key === ' ') nextHand(); return; }
      const idx = parseInt(e.key) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < actionButtons.length) handleAction(actionButtons[idx].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [result, actionButtons, nextHand, handleAction, countdown, testDone]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const correctActionName = result
    ? (range.actions.find(a => a.id === result.correctId)?.name ?? 'Fold')
    : '';
  const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null;
  const lifetimePct = stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) : null;
  const timerProgress = timeLeft / TIMER_MS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const timerColor = timerProgress > 0.5 ? '#4ade80' : timerProgress > 0.25 ? '#f97316' : '#ef4444';

  // ── Test complete screen ───────────────────────────────────────────────────

  if (testDone) {
    const passed = sessionCorrect / TEST_HAND_COUNT >= TEST_PASS_THRESHOLD;
    const finalPct = Math.round((sessionCorrect / TEST_HAND_COUNT) * 100);

    // Aggregate session hand log per label
    const perHand: Record<string, { correct: number; total: number }> = {};
    for (const entry of handLog) {
      if (!perHand[entry.label]) perHand[entry.label] = { correct: 0, total: 0 };
      perHand[entry.label].correct += entry.correct ? 1 : 0;
      perHand[entry.label].total += 1;
    }

    return (
      <div className="t-session">
        <div className="t-test-result">
          <div className={`t-test-result-verdict ${passed ? 't-test-result-verdict--pass' : 't-test-result-verdict--fail'}`}>
            {passed ? '✓ PASSED' : '✗ FAILED'}
          </div>
          <div className="t-test-result-score">{sessionCorrect} / {TEST_HAND_COUNT} correct</div>
          <div className="t-test-result-pct">{finalPct}%</div>
          <div className="t-test-result-required">Required: {Math.round(TEST_PASS_THRESHOLD * 100)}% to pass</div>

          <ResultGrid perHand={perHand} />

          <button className="t-btn t-btn--primary t-test-result-done" onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="t-session">
      {countdown !== null && (
        <div className="t-countdown-overlay">
          <div className={`t-countdown-number ${countdown === 0 ? 't-countdown-go' : ''}`}>
            {countdown === 0 ? 'GO!' : countdown}
          </div>
          <div className="t-countdown-label">
            {range.name} · {mode === 'mistakes' ? 'Mistakes Mode' : 'Test Mode'} · {TEST_HAND_COUNT} hands
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="t-hud">
        <button className="t-btn t-btn--ghost t-btn--sm" onClick={onBack}>
          <ArrowLeft size={14} /> Exit
        </button>
        <div className="t-hud-info">
          <span className="t-hud-name">{range.name}</span>
          <span className="t-hud-meta">{position} · {stackBB}BB · {opponents}v1</span>
        </div>
        <div className="t-hud-scores">
          {(mode === 'test' || mode === 'mistakes') ? (
            <>
              <div className="t-score-badge">
                <span className="t-score-num">{handsAnswered}/{TEST_HAND_COUNT}</span>
                <span className="t-score-label">Hands{pct !== null ? ` · ${pct}%` : ''}</span>
              </div>
              <div className={`t-score-badge ${pct !== null && pct >= 95 ? 't-score-badge--pass' : pct !== null ? 't-score-badge--fail' : ''}`}>
                <span className="t-score-num">{pct !== null ? `${pct}%` : '—'}</span>
                <span className="t-score-label">Current</span>
              </div>
            </>
          ) : (
            <>
              <div className="t-score-badge">
                <span className="t-score-num">{sessionCorrect}/{sessionTotal}</span>
                <span className="t-score-label">Session{pct !== null ? ` · ${pct}%` : ''}</span>
              </div>
              {lifetimePct !== null && (
                <div className="t-score-badge t-score-badge--lifetime">
                  <span className="t-score-num">{lifetimePct}%</span>
                  <span className="t-score-label">Lifetime</span>
                </div>
              )}
              <label className="t-auto-advance-toggle">
                <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />
                <span>Auto</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Poker table */}
      <PokerTable seats={buildSeats(range, stackBB, hand)} pot={computePot(range.preflopSpot ?? [])} />

      {/* Bottom */}
      <div className="t-session-bottom">
        {/* Fixed-height slot — timer or feedback, never shifts the layout */}
        <div className="t-feedback-slot">
          {(mode === 'test' || mode === 'mistakes') && !result && countdown === null && (
            <svg className="t-timer-svg" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r={RADIUS} className="t-timer-track" />
              <circle cx="27" cy="27" r={RADIUS} className="t-timer-ring"
                style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset, stroke: timerColor }} />
              <text x="27" y="32" className="t-timer-text">{Math.ceil(timeLeft / 1000)}</text>
            </svg>
          )}
          {result && (
            <div className={`t-feedback ${result.correct ? 't-feedback--correct' : 't-feedback--wrong'}`}>
              {result.correct ? '✓ Correct!' : `✗ ${result.chosenId === '__timeout__' ? 'Time up' : 'Wrong'} — ${correctActionName}`}
            </div>
          )}
        </div>

        <div className="t-action-buttons">
          {actionButtons.map((btn, i) => {
            let state = '';
            if (result) {
              if (btn.id === result.correctId) state = 't-abtn--correct';
              else if (btn.id === result.chosenId && !result.correct) state = 't-abtn--wrong';
              else state = 't-abtn--dim';
            }
            return (
              <button key={btn.id} className={`t-abtn ${state}`}
                style={!result ? { borderColor: btn.color, color: btn.color } : {}}
                onClick={() => handleAction(btn.id)} disabled={!!result}>
                <span className="t-abtn-key">{i + 1}</span>{btn.label}
              </button>
            );
          })}
        </div>

        {result && (mode === 'practice' ? !autoAdvance : !result.correct) && !testDone && (
          <button className="t-btn t-btn--primary t-next-btn" onClick={nextHand}>
            <RotateCcw size={15} /> Next hand <span className="t-hint-key">(Enter)</span>
          </button>
        )}
      </div>
    </div>
  );
}
