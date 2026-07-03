import { useState, useCallback, useRef, useEffect } from 'react';
import ScenarioDisplay from './components/ScenarioDisplay';
import RangeCategoryPicker from './components/RangeCategoryPicker';
import CoachChat from './components/CoachChat';
import VillainPicker from './components/VillainPicker';
import Leaderboard from './components/Leaderboard';
import RangeTrainer from './components/trainer/RangeTrainer';
import HandReview from './components/HandReview';
import {
  generateScenario, scenarioSummaryForCoach,
  boardCardsUpToStreet, formatCard, DEFAULT_VILLAIN_PROFILE,
} from './utils/scenarioGenerator';
import type { FullScenario, ChatMessage, StreetName, VillainProfile, LeaderboardEntry } from './types/poker';
import './App.css';

type AppTab = 'coach' | 'trainer' | 'review';

const STREETS: StreetName[] = ['preflop', 'flop', 'turn', 'river'];
const LB_KEY = 'ranging-leaderboard';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface StreetRangeEntry {
  street: StreetName;
  range: Set<string>;
}

export default function App() {
  const [villainProfile, setVillainProfile] = useState<VillainProfile>(DEFAULT_VILLAIN_PROFILE);
  const [scenario, setScenario] = useState<FullScenario>(() => generateScenario(undefined, DEFAULT_VILLAIN_PROFILE));

  // Game state
  const [currentStreetIndex, setCurrentStreetIndex] = useState(0);
  const [streetRanges, setStreetRanges] = useState<StreetRangeEntry[]>([]);
  const [currentCategories, setCurrentCategories] = useState<Set<string>>(new Set());
  const [gamePhase, setGamePhase] = useState<'ranging' | 'debrief'>('ranging');

  // Coach state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [currentRating, setCurrentRating] = useState<number | null>(null);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTimeRef = useRef(0);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); }
    catch { return []; }
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const currentEntryIdRef = useRef<string | null>(null);

  // Hidden per-street notes
  const notePromisesRef = useRef<Promise<string>[]>([]);

  const previousCategories: Set<string> | undefined =
    currentStreetIndex > 0 ? streetRanges[currentStreetIndex - 1]?.range : undefined;

  // ── Timer helpers ────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Start timer on first mount
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Leaderboard helpers ───────────────────────────────────────────────────────

  const saveEntry = useCallback((entry: LeaderboardEntry) => {
    setLeaderboard(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem(LB_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateEntryRating = useCallback((id: string, rating: number) => {
    setLeaderboard(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, rating } : e);
      localStorage.setItem(LB_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearLeaderboard = useCallback(() => {
    setLeaderboard([]);
    localStorage.removeItem(LB_KEY);
  }, []);

  // ── Scenario management ───────────────────────────────────────────────────────

  const newScenario = useCallback((profile?: VillainProfile) => {
    const vp = profile ?? villainProfile;
    setScenario(generateScenario(undefined, vp));
    setCurrentStreetIndex(0);
    setStreetRanges([]);
    setCurrentCategories(new Set());
    setGamePhase('ranging');
    setMessages([]);
    setFollowUpInput('');
    setCurrentRating(null);
    currentEntryIdRef.current = null;
    notePromisesRef.current = [];
    startTimer();
  }, [villainProfile, startTimer]);

  const handleVillainChange = (profile: VillainProfile) => {
    setVillainProfile(profile);
    newScenario(profile);
  };

  // ── Street note (background, silent) ─────────────────────────────────────────

  const fetchStreetNote = (
    streetIndex: number,
    range: string[],
    allRangesSoFar: StreetRangeEntry[],
    resolvedScenario: FullScenario,
  ): Promise<string> => {
    const street = STREETS[streetIndex];
    const streetData = resolvedScenario.streets[streetIndex];
    const actions = streetData.actions
      .map(a => `${a.position} ${a.action}${a.sizingBB ? ` ${a.sizingBB}BB` : a.sizingPct ? ` ${a.sizingPct}% pot` : ''}`)
      .join(', ');
    const boardCards = boardCardsUpToStreet(resolvedScenario, streetIndex).map(formatCard).join(' ');
    const previousRanges = allRangesSoFar.slice(0, streetIndex).map(r => ({
      street: r.street,
      range: Array.from(r.range).sort(),
    }));

    return fetch('http://localhost:3001/api/street-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        street,
        villainPosition: resolvedScenario.villainPosition,
        heroPosition: resolvedScenario.heroPosition,
        heroIsIP: resolvedScenario.heroIsIP,
        actions: actions || 'no action',
        board: boardCards,
        playerRange: range,
        previousRanges,
        villainName: resolvedScenario.villainProfile.name,
        villainContext: resolvedScenario.villainProfile.coachContext,
      }),
    })
      .then(r => r.json())
      .then(data => (data.note as string) || '')
      .catch(() => '');
  };

  // ── Street confirmation ───────────────────────────────────────────────────────

  const handleConfirmStreet = async () => {
    const entry: StreetRangeEntry = {
      street: STREETS[currentStreetIndex],
      range: new Set(currentCategories),
    };
    const updatedRanges = [...streetRanges, entry];
    setStreetRanges(updatedRanges);

    const notePromise = fetchStreetNote(
      currentStreetIndex,
      Array.from(currentCategories),
      updatedRanges,
      scenario,
    );
    notePromisesRef.current.push(notePromise);

    const nextIndex = currentStreetIndex + 1;
    if (nextIndex >= STREETS.length) {
      stopTimer();
      finalTimeRef.current = elapsedSeconds;
      setGamePhase('debrief');

      const notes = await Promise.all(notePromisesRef.current);
      await requestDebrief(updatedRanges, notes);
    } else {
      setCurrentStreetIndex(nextIndex);
      setCurrentCategories(new Set());
    }
  };

  // ── Streaming helpers ─────────────────────────────────────────────────────────

  // Returns the rating found in the response, or null
  const streamFromServer = async (body: object): Promise<number | null> => {
    setIsLoading(true);
    let text = '';
    let foundRating: number | null = null;

    const response = await fetch('http://localhost:3001/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.body) { setIsLoading(false); return null; }
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

    // Extract rating from completed response
    const ratingMatch = text.match(/\*\*(?:Updated )?Rating:\s*(\d+)\/100\*\*/i);
    if (ratingMatch) {
      foundRating = parseInt(ratingMatch[1]);
      setCurrentRating(foundRating);
    }

    setIsLoading(false);
    return foundRating;
  };

  // ── Debrief ───────────────────────────────────────────────────────────────────

  const requestDebrief = async (ranges: StreetRangeEntry[], notes: string[]) => {
    const summary = scenarioSummaryForCoach(
      scenario,
      ranges.map(r => ({ street: r.street, range: Array.from(r.range).sort() })),
    );
    const userMsg: ChatMessage = { role: 'user', content: summary };
    setMessages([userMsg]);

    const rating = await streamFromServer({
      mode: 'debrief',
      summary,
      history: [userMsg],
      perStreetNotes: notes,
      villainName: scenario.villainProfile.name,
      villainContext: scenario.villainProfile.coachContext,
    });

    // Save to leaderboard once we have a rating
    if (rating !== null) {
      const id = Date.now().toString();
      currentEntryIdRef.current = id;
      saveEntry({
        id,
        date: new Date().toISOString(),
        villainName: scenario.villainProfile.name,
        villainEmoji: scenario.villainProfile.emoji,
        heroPosition: scenario.heroPosition,
        villainPosition: scenario.villainPosition,
        timeSeconds: finalTimeRef.current,
        rating,
      });
    }
  };

  // ── Follow-up ─────────────────────────────────────────────────────────────────

  const handleFollowUp = async (message: string) => {
    const userMsg: ChatMessage = { role: 'user', content: message };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setFollowUpInput('');

    const rating = await streamFromServer({
      mode: 'followup',
      summary: '',
      history: updatedHistory,
      villainName: scenario.villainProfile.name,
      villainContext: scenario.villainProfile.coachContext,
    });

    // Update leaderboard if rating changed
    if (rating !== null && currentEntryIdRef.current) {
      updateEntryRating(currentEntryIdRef.current, rating);
    }
  };

  const currentStreetName = STREETS[currentStreetIndex];
  const isLastStreet = currentStreetIndex === STREETS.length - 1;

  const [activeTab, setActiveTab] = useState<AppTab>('trainer');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Ranging Practice</h1>
          <p>Train your ability to put opponents on accurate ranges</p>
        </div>
        <div className="app-tabs">
          <button
            className={`app-tab ${activeTab === 'trainer' ? 'app-tab--active' : ''}`}
            onClick={() => setActiveTab('trainer')}
          >
            Range Trainer
          </button>
          <button
            className={`app-tab ${activeTab === 'coach' ? 'app-tab--active' : ''}`}
            onClick={() => setActiveTab('coach')}
          >
            AI Coach
          </button>
          <button
            className={`app-tab ${activeTab === 'review' ? 'app-tab--active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            Hand Review
          </button>
        </div>
        <button className="lb-open-btn" onClick={() => setShowLeaderboard(true)}>
          🏆 Leaderboard
        </button>
      </header>

      {activeTab === 'trainer' && (
        <main className="app-main app-main--trainer">
          <RangeTrainer />
        </main>
      )}

      {activeTab === 'coach' && (
      <main className="app-main app-main--trainer">
        <div className="coach-two-panel">

          {/* ── Coach sidebar ── */}
          <div className="coach-sidebar">
            <div className="t-sidebar-header">
              <div className="t-sidebar-title">
                <span style={{ fontSize: '1rem' }}>🤖</span>
                AI Coach
              </div>
              <button className="t-btn t-btn--primary t-btn--sm" onClick={() => newScenario()}>
                New Hand
              </button>
            </div>

            <div className="coach-sidebar-body">
              <VillainPicker
                selected={villainProfile}
                onChange={handleVillainChange}
                disabled={gamePhase === 'debrief'}
              />

              {currentRating !== null && (
                <div className="coach-rating-card">
                  <div className="t-section-label">Session Rating</div>
                  <div className={`coach-rating-num ${currentRating >= 80 ? 'coach-rating--high' : currentRating >= 60 ? 'coach-rating--mid' : 'coach-rating--low'}`}>
                    {currentRating}<span className="coach-rating-denom">/100</span>
                  </div>
                </div>
              )}

              <div className="coach-sidebar-hint">
                <div className="t-section-label">How to play</div>
                <p>Range the villain on each street. After the river, your coach reviews your full progression. Ask follow-ups to defend your reads.</p>
              </div>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="coach-content">

            {/* Game column */}
            <div className="coach-game-col">
              <ScenarioDisplay
                scenario={scenario}
                currentStreetIndex={currentStreetIndex}
                onNewScenario={() => newScenario()}
              />
              <RangeCategoryPicker
                street={currentStreetName}
                board={boardCardsUpToStreet(scenario, currentStreetIndex)}
                selected={currentCategories}
                previousSelected={previousCategories}
                onChange={setCurrentCategories}
                locked={gamePhase === 'debrief'}
              />

              {gamePhase === 'ranging' && (
                <div className="confirm-bar">
                  <div className="confirm-info">
                    <span className="confirm-count">
                      {currentCategories.size} categor{currentCategories.size === 1 ? 'y' : 'ies'} selected
                    </span>
                    <span className="confirm-street">
                      Ranging: <strong>{currentStreetName}</strong>
                    </span>
                  </div>
                  <div className="confirm-right">
                    <span className="timer-badge">⏱ {formatTime(elapsedSeconds)}</span>
                    <button
                      className="confirm-btn"
                      onClick={() => void handleConfirmStreet()}
                      disabled={currentCategories.size === 0}
                    >
                      {isLastStreet ? 'Finish & Get Debrief →' : `Confirm ${currentStreetName} →`}
                    </button>
                  </div>
                </div>
              )}

              {gamePhase === 'debrief' && (
                <div className="debrief-bar">
                  <span>
                    Hand complete
                    <span className="debrief-time">⏱ {formatTime(finalTimeRef.current)}</span>
                  </span>
                  <button className="new-hand-btn-bar" onClick={() => newScenario()}>New Hand</button>
                </div>
              )}
            </div>

            {/* Chat column */}
            <div className="coach-chat-col">
              <div className="coach-chat-header">
                <div className="coach-header-top">
                  <h2>Coach</h2>
                  {currentRating !== null && (
                    <span className={`rating-badge ${currentRating >= 80 ? 'high' : currentRating >= 60 ? 'mid' : 'low'}`}>
                      {currentRating}/100
                    </span>
                  )}
                </div>
                {gamePhase === 'debrief' && !isLoading && messages.length > 0 && (
                  <p>Review complete. A strong argument can raise your rating.</p>
                )}
              </div>
              <CoachChat
                messages={messages}
                isLoading={isLoading}
                onFollowUp={handleFollowUp}
                followUpInput={followUpInput}
                onFollowUpChange={setFollowUpInput}
              />
            </div>

          </div>
        </div>
      </main>
      )}

      {activeTab === 'review' && (
        <main className="app-main app-main--trainer">
          <HandReview />
        </main>
      )}

      {showLeaderboard && (
        <Leaderboard
          entries={leaderboard}
          onClose={() => setShowLeaderboard(false)}
          onClear={clearLeaderboard}
        />
      )}
    </div>
  );
}
