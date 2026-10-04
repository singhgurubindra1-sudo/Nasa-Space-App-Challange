import { useEffect, useState } from 'react';
import ChooseWorld from './screens/ChooseWorld.jsx';
import Briefing from './screens/Briefing.jsx';
import PlanSol from './screens/PlanSol.jsx';
import EventReport from './screens/EventReport.jsx';
import Debrief from './screens/Debrief.jsx';
import Learn from './screens/Learn.jsx';
import { createGame, nextSol } from './engine/engine.js';
import { newSeed } from './engine/rng.js';

const SAVE_KEY = 'survive30sols.save.v1';
const PREFS_KEY = 'survive30sols.prefs.v1';

const load = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const store = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the game still works, it just won't remember */
  }
};

export default function App() {
  const saved = load(SAVE_KEY);
  const prefs = load(PREFS_KEY) || {};
  const [world, setWorld] = useState(prefs.world || 'mars');
  const [voice, setVoice] = useState(!!prefs.voice);
  const [game, setGame] = useState(null);
  const [report, setReport] = useState(null);
  const [screen, setScreen] = useState('choose');
  const [returnTo, setReturnTo] = useState('choose');

  useEffect(() => {
    store(PREFS_KEY, { world, voice });
  }, [world, voice]);
  useEffect(() => {
    if (game && game.status === 'playing') store(SAVE_KEY, game);
    else if (game) store(SAVE_KEY, null);
  }, [game]);
  useEffect(() => {
    // Braces matter: some browser extensions make scrollTo return a value, which React would treat as a cleanup function.
    window.scrollTo(0, 0);
  }, [screen]);

  const start = (w = world) => {
    setWorld(w);
    setGame(createGame(w, newSeed()));
    setReport(null);
    setScreen('briefing');
  };
  const launch = (choices) => {
    const out = nextSol(game, choices);
    setGame(out.state);
    setReport(out.report);
    setScreen('event');
  };
  const learn = () => {
    setReturnTo(screen);
    setScreen('learn');
  };

  return (
    <div className="app">
      <nav className="topbar">
        <button className="brand" onClick={() => setScreen(game && game.status === 'playing' ? 'briefing' : 'choose')} aria-label="Survive 30 Sols home">
          🚀 <span>Survive 30 Sols</span>
        </button>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setVoice(!voice)} aria-pressed={voice} title="Nova's voice">
            {voice ? '🔊' : '🔈'} <span className="hide-sm">Voice</span>
          </button>
          {screen !== 'learn' && (
            <button className="icon-btn" onClick={learn} title="Learn and teacher page">📘 <span className="hide-sm">Learn</span></button>
          )}
          {game && game.status === 'playing' && screen !== 'choose' && screen !== 'learn' && (
            <button className="icon-btn" onClick={() => setScreen('choose')} title="Quit to menu (progress is saved)">✕</button>
          )}
        </div>
      </nav>

      <main>
        {screen === 'choose' && (
          <ChooseWorld
            world={world}
            setWorld={setWorld}
            onStart={() => start()}
            saved={saved}
            onContinue={() => {
              setGame(saved);
              setWorld(saved.worldId);
              setScreen('briefing');
            }}
            onLearn={learn}
          />
        )}
        {screen === 'briefing' && game && <Briefing state={game} voice={voice} onNext={() => setScreen('plan')} />}
        {screen === 'plan' && game && <PlanSol key={game.sol} state={game} onLaunch={launch} onBack={() => setScreen('briefing')} />}
        {screen === 'event' && game && report && (
          <EventReport
            key={report.sol}
            state={game}
            report={report}
            onNext={() => setScreen(game.status === 'playing' ? 'briefing' : 'debrief')}
          />
        )}
        {screen === 'debrief' && game && (
          <Debrief state={game} onAgain={() => start(game.worldId)} onOther={() => start(game.worldId === 'moon' ? 'mars' : 'moon')} onLearn={learn} />
        )}
        {screen === 'learn' && <Learn onBack={() => setScreen(returnTo === 'learn' ? 'choose' : returnTo)} />}
      </main>

      <footer className="footer">
        Built for NASA Space Apps 2026 with real NASA data. Not an official NASA product.
      </footer>
    </div>
  );
}
