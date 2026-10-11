import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ChooseWorld from './screens/ChooseWorld.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Briefing from './screens/Briefing.jsx';
import PlanSol from './screens/PlanSol.jsx';
import EventReport from './screens/EventReport.jsx';
import Debrief from './screens/Debrief.jsx';
import Learn from './screens/Learn.jsx';
import Academy from './screens/Academy.jsx';
import Certificate from './screens/Certificate.jsx';
import Teacher from './screens/Teacher.jsx';
import { createGame, nextSol, setCrop, stars } from './engine/engine.js';
import { moduleById, moduleSetup, moduleWorld, recordResult, recordQuiz } from './engine/training.js';
import GreenhousePanel from './components/GreenhousePanel.jsx';
import { applyCrewTask, shareMeal, analyzeSamples } from './engine/crew.js';
import { sound } from './audio/sound.js';
import GraphicsMenu from './components/GraphicsMenu.jsx';
import { newSeed } from './engine/rng.js';

// three.js scene, loaded separately so the menu and game logic stay light.
const BaseView = lazy(() => import('./components/BaseView.jsx'));
const FppView = lazy(() => import('./components/FppView.jsx'));

const SAVE_KEY = 'survive30sols.save.v1';
const PREFS_KEY = 'survive30sols.prefs.v1';
const ACADEMY_KEY = 'survive30sols.academy.v1';

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
  const [screen, setScreen] = useState('academy');
  const [progress, setProgress] = useState(() => load(ACADEMY_KEY) || {});
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
    store(PREFS_KEY, { world, voice });
  }, [world, voice]);
  useEffect(() => {
    store(ACADEMY_KEY, progress);
  }, [progress]);
  useEffect(() => {
    if (game && game.status === 'playing') store(SAVE_KEY, game);
    else if (game) store(SAVE_KEY, null);
  }, [game]);
  useEffect(() => {
    // Braces matter: some browser extensions make scrollTo return a value, which React would treat as a cleanup function.
    window.scrollTo(0, 0);
  }, [screen]);

  const begin = (w, seed, setup = {}) => {
    setGame(createGame(w, seed, setup));
    setReport(null);
    setScreen('briefing');
  };
  const start = (w = world) => {
    setWorld(w);
    begin(w, newSeed());
  };
  const startModule = (mod, w) => begin(moduleWorld(mod, w), newSeed(), moduleSetup(mod));
  const joinClass = (cls) => begin(cls.worldId, cls.seed, { classCode: cls.code });
  // Same module or class mission again (a class mission keeps its seed so results stay comparable).
  const restart = () => {
    const setup = game.setup || {};
    if (!setup.module && !setup.classCode) return start(game.worldId);
    begin(game.worldId, setup.classCode ? game.seed : newSeed(), setup);
  };
  const resume = () => {
    setGame(saved);
    setWorld(saved.worldId);
    setScreen('briefing');
  };
  const launch = (choices) => {
    const out = nextSol(game, choices);
    const mod = out.state.setup && out.state.setup.module ? moduleById(out.state.setup.module) : null;
    if (mod && out.state.status !== 'playing') setProgress((p) => recordResult(p, mod, out.state, stars(out.state)));
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
        <button className="brand" onClick={() => setScreen(game && game.status === 'playing' ? 'briefing' : 'academy')} aria-label="Survive 30 Sols home">
          🚀 <span>Survive 30 Sols</span>
        </button>
        <div className="topbar-actions">
          <GraphicsMenu />
          <button className="icon-btn" onClick={() => setVoice(!voice)} aria-pressed={voice} title="Nova's voice">
            {voice ? '🔊' : '🔈'} <span className="hide-sm">Voice</span>
          </button>
          {screen !== 'learn' && (
            <button className="icon-btn" onClick={learn} title="Learn and teacher page">📘 <span className="hide-sm">Learn</span></button>
          )}
          {game && game.status === 'playing' && ['briefing', 'plan', 'event'].includes(screen) && (
            <button className="icon-btn" onClick={() => setScreen('academy')} title="Quit to the academy (progress is saved)">✕</button>
          )}
        </div>
      </nav>

      <main>
        {game && !eva && ['briefing', 'plan', 'event'].includes(screen) && (
          <Suspense fallback={<div className="base-stage base-loading"><p>🛰 Landing at your base…</p></div>}>
            <BaseView key={game.worldId} state={game} report={report} screen={screen} preview={screen === 'plan' ? preview : null} onEva={openEva} />
          </Suspense>
        )}
        {screen === 'academy' && (
          <Academy
            progress={progress}
            setProgress={setProgress}
            saved={saved}
            onContinue={resume}
            onStartModule={startModule}
            onJoinClass={joinClass}
            onExplorer={() => setScreen('dashboard')}
            onFreePlay={() => setScreen('choose')}
            onLearn={learn}
            onCertificate={() => setScreen('certificate')}
            onTeacher={() => setScreen('teacher')}
          />
        )}
        {screen === 'certificate' && <Certificate progress={progress} setProgress={setProgress} onBack={() => setScreen('academy')} />}
        {screen === 'teacher' && <Teacher onBack={() => setScreen('academy')} />}
        {screen === 'dashboard' && (
          <Dashboard
            onNext={() => setScreen('choose')}
            onAcademy={() => setScreen('academy')}
            onMission={(w) => {
              setWorld(w);
              setScreen('choose');
            }}
            saved={saved}
            onContinue={resume}
          />
        )}
        {screen === 'choose' && (
          <ChooseWorld
            onExplorer={() => setScreen('dashboard')}
            world={world}
            setWorld={setWorld}
            onStart={() => start()}
            saved={saved}
            onContinue={resume}
            onLearn={learn}
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
          <Debrief
            state={game}
            progress={progress}
            onAgain={restart}
            onOther={() => start(game.worldId === 'moon' ? 'mars' : 'moon')}
            onLearn={learn}
            onAcademy={() => setScreen('academy')}
            onModule={(m) => startModule(m)}
            onQuiz={(id, score) => setProgress((p) => recordQuiz(p, id, score))}
          />
        )}
        {screen === 'learn' && <Learn onBack={() => setScreen(returnTo === 'learn' ? 'academy' : returnTo)} />}
      </main>

      {eva && game && (
        <Suspense fallback={<div className="fpp fpp-loading"><p>🧑‍🚀 Suiting up…</p></div>}>
          <FppView state={game} onSetCrop={changeCrop} onCrewTask={crewTask} onCommanderAction={commanderAction} onClose={() => setEva(false)} />
        </Suspense>
      )}
      {ghOpen && game && <GreenhousePanel state={game} onSetCrop={changeCrop} onClose={() => setGhOpen(false)} />}

      <footer className="footer">
        Built for NASA Space Apps 2026 with real NASA data. Not an official NASA product.
      </footer>
    </div>
  );
}
