import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ChooseWorld from './screens/ChooseWorld.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Briefing from './screens/Briefing.jsx';
import PlanSol from './screens/PlanSol.jsx';
import EventReport from './screens/EventReport.jsx';
import Debrief from './screens/Debrief.jsx';
import Learn from './screens/Learn.jsx';
import { createGame, nextSol, setCrop } from './engine/engine.js';
import GreenhousePanel from './components/GreenhousePanel.jsx';
import { applyCrewTask, shareMeal, analyzeSamples } from './engine/crew.js';
import { sound } from './audio/sound.js';
import GraphicsMenu from './components/GraphicsMenu.jsx';
import { newSeed } from './engine/rng.js';
import { resolveDifficulty, LEVELS, DEFAULT_LEVEL } from './engine/difficulty.js';
import { fetchLiveDifficultyInputs } from './live/nasaDifficulty.js';
import { useAuth } from './auth/AuthContext.jsx';
import AuthModal from './auth/AuthModal.jsx';
import AccountMenu from './auth/AccountMenu.jsx';
import Support from './support/Support.jsx';
import Admin from './support/Admin.jsx';
import Tour, { Welcome, tourPrefs } from './onboarding/Tour.jsx';
import { TOURS } from './onboarding/tours.js';
import WarpTransition from './components/WarpTransition.jsx';

// Page names for the warp label.
const PAGE_LABEL = {
  dashboard: 'Live Space Explorer',
  choose: 'Mission Dashboard',
  briefing: 'Morning briefing',
  plan: 'Mission planning',
  event: 'Event report',
  debrief: 'Mission debrief',
  learn: 'Learn & Teacher page',
  support: 'Help Center',
  admin: 'Operations console',
};
// Steps inside the mission loop get a quicker jump so 30 sols never feel slow.
const QUICK = new Set(['briefing', 'plan', 'event']);

// three.js scene, loaded separately so the menu and game logic stay light.
const BaseView = lazy(() => import('./components/BaseView.jsx'));
const FppView = lazy(() => import('./components/FppView.jsx'));

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
  const auth = useAuth();
  const [world, setWorld] = useState(prefs.world || 'mars');
  const [level, setLevel] = useState(prefs.level && (LEVELS[prefs.level] || prefs.level === 'live') ? prefs.level : DEFAULT_LEVEL);
  const [live, setLive] = useState(null);
  const [liveStatus, setLiveStatus] = useState('idle');
  const [authModal, setAuthModal] = useState(null); // 'signin' | 'signup' | 'reset' | null
  const [supportTab, setSupportTab] = useState('new');
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => !tourPrefs.get().welcomed);
  const [tour, setTour] = useState(null); // key of TOURS
  const [warp, setWarp] = useState(null);
  const [voice, setVoice] = useState(!!prefs.voice);
  const [game, setGame] = useState(null);
  const [report, setReport] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [returnTo, setReturnTo] = useState('choose');
  const [preview, setPreview] = useState(null); // live slider values from the plan screen
  const [eva, setEva] = useState(false); // first-person EVA mode
  const [ghOpen, setGhOpen] = useState(false);
  const changeCrop = (crop) => setGame((g) => setCrop(g, crop));
  // Crew and commander actions need the latest game state synchronously (they return a message).
  const gameRef = useRef(game);
  gameRef.current = game;
  const commit = (r) => {
    if (r.state !== gameRef.current) {
      gameRef.current = r.state;
      setGame(r.state);
    }
    return r;
  };
  const crewTask = (juniorId, taskId) => commit(applyCrewTask(gameRef.current, juniorId, taskId)).text;
  const commanderAction = (kind, n) => commit(kind === 'meal' ? shareMeal(gameRef.current) : analyzeSamples(gameRef.current, n || 0));
  const openEva = () => {
    sound.unlock();
    setEva(true);
  };

  useEffect(() => {
    store(PREFS_KEY, { world, voice, level });
  }, [world, voice, level]);

  // Live NASA difficulty: read DONKI once the player picks it (cached for 3 hours).
  useEffect(() => {
    if (level !== 'live' || liveStatus !== 'idle') return;
    setLiveStatus('loading');
    fetchLiveDifficultyInputs().then((x) => {
      setLive(x);
      setLiveStatus('ready');
    });
  }, [level, liveStatus]);

  // Arriving from a password-reset email.
  useEffect(() => {
    if (auth.recovery) setAuthModal('reset');
  }, [auth.recovery]);

  // Every page change plays a space jump; first visits to a page get a guided tour.
  const tourKey = screen === 'support' ? 'support' : screen;
  const prevScreen = useRef(screen);
  useEffect(() => {
    if (prevScreen.current === screen) return;
    const quick = QUICK.has(screen) && QUICK.has(prevScreen.current);
    prevScreen.current = screen;
    setWarp({ id: Date.now(), short: quick, label: PAGE_LABEL[screen] });
  }, [screen]);
  const maybeTour = useCallback(() => {
    const p = tourPrefs.get();
    if (!p.welcomed || p.disabled || (p.seen || {})[tourKey] || !TOURS[tourKey]) return;
    setTimeout(() => setTour(tourKey), 350);
  }, [tourKey]);
  useEffect(() => {
    if (!warp && !welcome) maybeTour();
  }, [tourKey, warp, welcome, maybeTour]);
  const endTour = () => {
    if (tour) tourPrefs.markSeen(tour);
    setTour(null);
  };

  // A signed-in player's win is added to their profile.
  const recorded = useRef(null);
  useEffect(() => {
    if (game && game.status === 'won' && auth.user && recorded.current !== game.seed) {
      recorded.current = game.seed;
      auth.recordWin(game.difficulty ? game.difficulty.level : DEFAULT_LEVEL);
    }
  }, [game, auth]);

  const openSupport = (tab = 'new') => {
    setSupportTab(tab);
    if (screen !== 'support') setReturnTo(screen);
    setScreen('support');
  };
  const navigate = (target) => {
    if (target.startsWith('support:')) return openSupport(target.split(':')[1]);
    if (screen !== target && !['support', 'admin'].includes(screen)) setReturnTo(screen);
    setScreen(target);
  };
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
    setGame(createGame(w, newSeed(), resolveDifficulty(level, w, live)));
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
        <button className="brand" onClick={() => setScreen(game && game.status === 'playing' ? 'briefing' : 'dashboard')} aria-label="Survive 30 Sols home">
          🚀 <span>Survive 30 Sols</span>
        </button>
        <div className="topbar-actions">
          <GraphicsMenu />
          <div className="help-wrap">
            <button className="icon-btn" data-tour="help" onClick={() => setHelpOpen(!helpOpen)} aria-expanded={helpOpen} title="Help, tour and support">❔</button>
            {helpOpen && (
              <div className="menu" role="menu" onMouseLeave={() => setHelpOpen(false)}>
                {TOURS[tourKey] && <button role="menuitem" onClick={() => { setHelpOpen(false); setTour(tourKey); }}>🧭 Tour this page</button>}
                <button role="menuitem" onClick={() => { setHelpOpen(false); setWelcome(true); }}>👋 How this site works</button>
                <button role="menuitem" onClick={() => { setHelpOpen(false); openSupport('new'); }}>🆘 Raise a support ticket</button>
                <button role="menuitem" onClick={() => { setHelpOpen(false); openSupport('feedback'); }}>💬 Send feedback</button>
                <button role="menuitem" onClick={() => { setHelpOpen(false); const off = !tourPrefs.get().disabled; tourPrefs.set({ disabled: off }); }}>
                  {tourPrefs.get().disabled ? '💡 Turn tips back on' : '🔕 Stop showing tips'}
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setVoice(!voice)} aria-pressed={voice} title="Nova's voice">
            {voice ? '🔊' : '🔈'} <span className="hide-sm">Voice</span>
          </button>
          <AccountMenu onSignIn={() => setAuthModal('signin')} onNavigate={navigate} />
          {screen !== 'learn' && (
            <button className="icon-btn" onClick={learn} title="Learn and teacher page">📘 <span className="hide-sm">Learn</span></button>
          )}
          {game && game.status === 'playing' && screen !== 'choose' && screen !== 'dashboard' && screen !== 'learn' && (
            <button className="icon-btn" onClick={() => setScreen('choose')} title="Quit to menu (progress is saved)">✕</button>
          )}
        </div>
      </nav>

      <main>
        {game && !eva && ['briefing', 'plan', 'event'].includes(screen) && (
          <Suspense fallback={<div className="base-stage base-loading"><p>🛰 Landing at your base…</p></div>}>
            <BaseView key={game.worldId} state={game} report={report} screen={screen} preview={screen === 'plan' ? preview : null} onEva={openEva} />
          </Suspense>
        )}
        {screen === 'dashboard' && (
          <Dashboard
            onNext={() => setScreen('choose')}
            onMission={(w) => {
              setWorld(w);
              setScreen('choose');
            }}
            saved={saved}
            onContinue={() => {
              setGame(saved);
              setWorld(saved.worldId);
              setScreen('briefing');
            }}
          />
        )}
        {screen === 'choose' && (
          <ChooseWorld
            onExplorer={() => setScreen('dashboard')}
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
            level={level}
            setLevel={setLevel}
            live={live}
            liveStatus={liveStatus}
          />
        )}
        {screen === 'briefing' && game && <Briefing state={game} voice={voice} onNext={() => setScreen('plan')} onEva={openEva} onGreenhouse={() => setGhOpen(true)} />}
        {screen === 'plan' && game && <PlanSol key={game.sol} state={game} onLaunch={launch} onBack={() => setScreen('briefing')} onAllocChange={setPreview} />}
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
        {screen === 'learn' && <Learn onBack={() => setScreen(returnTo === 'learn' ? 'dashboard' : returnTo)} />}
        {screen === 'support' && (
          <Support tab={supportTab} fromScreen={returnTo} onSignIn={() => setAuthModal('signin')} onBack={() => setScreen(['support', 'admin'].includes(returnTo) ? 'dashboard' : returnTo)} />
        )}
        {screen === 'admin' && <Admin onBack={() => setScreen(['support', 'admin'].includes(returnTo) ? 'dashboard' : returnTo)} />}
      </main>

      {eva && game && (
        <Suspense fallback={<div className="fpp fpp-loading"><p>🧑‍🚀 Suiting up…</p></div>}>
          <FppView state={game} onSetCrop={changeCrop} onCrewTask={crewTask} onCommanderAction={commanderAction} onClose={() => setEva(false)} />
        </Suspense>
      )}
      {ghOpen && game && <GreenhousePanel state={game} onSetCrop={changeCrop} onClose={() => setGhOpen(false)} />}

      {authModal && <AuthModal key={authModal} initialMode={authModal} onClose={() => { setAuthModal(null); auth.clearRecovery(); }} />}
      {welcome && (
        <Welcome
          onTour={() => { tourPrefs.set({ welcomed: true, disabled: false }); setWelcome(false); setTour(TOURS[tourKey] ? tourKey : 'dashboard'); }}
          onSkip={() => { tourPrefs.set({ welcomed: true }); setWelcome(false); }}
          onSignUp={() => { tourPrefs.set({ welcomed: true }); setWelcome(false); setAuthModal('signup'); }}
        />
      )}
      {tour && !welcome && !warp && <Tour key={tour} tour={TOURS[tour]} onDone={endTour} />}
      {warp && <WarpTransition key={warp.id} short={warp.short} label={warp.label} onDone={() => setWarp(null)} />}

      <footer className="footer">
        Built for NASA Space Apps 2026 with real NASA data. Not an official NASA product.
        <br />
        <button className="link-btn inline" onClick={() => openSupport('new')}>Support</button> · <button className="link-btn inline" onClick={() => openSupport('feedback')}>Feedback</button>
      </footer>
    </div>
  );
}
