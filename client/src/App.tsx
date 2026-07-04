import { useState, useCallback } from 'react';
import Leaderboard from './components/Leaderboard';
import RangeTrainer from './components/trainer/RangeTrainer';
import HandReview from './components/HandReview';
import DecisionGame from './components/DecisionGame';
import { generateScenario, DEFAULT_VILLAIN_PROFILE } from './utils/scenarioGenerator';
import type { FullScenario, VillainProfile, LeaderboardEntry } from './types/poker';
import './App.css';

type AppTab = 'coach' | 'trainer' | 'review';

const LB_KEY = 'ranging-leaderboard';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('trainer');
  const [villainProfile, setVillainProfile] = useState<VillainProfile>(DEFAULT_VILLAIN_PROFILE);
  const [scenario, setScenario] = useState<FullScenario>(() => generateScenario(undefined, DEFAULT_VILLAIN_PROFILE));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); }
    catch { return []; }
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const newScenario = useCallback((profile?: VillainProfile) => {
    const vp = profile ?? villainProfile;
    setScenario(generateScenario(undefined, vp));
  }, [villainProfile]);

  const handleVillainChange = useCallback((profile: VillainProfile) => {
    setVillainProfile(profile);
    setScenario(generateScenario(undefined, profile));
  }, []);

  const clearLeaderboard = useCallback(() => {
    setLeaderboard([]);
    localStorage.removeItem(LB_KEY);
  }, []);

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
            Ranging Opponents
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
          <DecisionGame
            scenario={scenario}
            villainProfile={villainProfile}
            onNewScenario={() => newScenario()}
            onVillainChange={handleVillainChange}
          />
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
