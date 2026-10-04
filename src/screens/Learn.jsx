import { useState } from 'react';
import { N, G, WORLDS, EVENTS, NEEDS } from '../engine/engine.js';
import SpaceWeather from '../components/SpaceWeather.jsx';
import WhyCard from '../components/WhyCard.jsx';

const LEARN = [
  {
    title: 'Why do we shield?',
    text: `Space is full of radiation: galactic cosmic rays from exploding stars far away, and bursts of particles from our own Sun. On Earth, the thick air and the magnetic field protect us. On the Moon there is no air at all: China's Chang'e-4 lander measured about ${N.moonDoseMsvPerDay.value} mSv per day there. On Mars, NASA's Curiosity rover measured about ${N.marsDoseMsvPerDay.value} mSv per day — lower because the thin air helps a little. For comparison, people on Earth get about 0.01 mSv per day. Piling regolith (loose rock and dust) on top of the hab blocks most solar particles and some cosmic rays. Cosmic rays are so energetic that no practical shield stops them all, which is why NASA sets limits on how much dose an astronaut may get in a whole career (${N.careerDoseLimitMsv.value} mSv).`,
    source: N.moonDoseMsvPerDay.source,
    url: N.moonDoseMsvPerDay.url,
  },
  {
    title: 'Why is power the master resource?',
    text: `In a base, almost everything runs on electricity. Splitting water makes oxygen. Pumps and filters recycle ${Math.round(N.waterRecovery.value * 100)}% of the water, like on the ISS. Heaters stop pipes from freezing, and lamps grow plants. If power runs short, every other system fails too. That's why NASA's Fission Surface Power project is designing a 40-kilowatt reactor for the Moon: it runs day and night, through lunar nights and dust storms.`,
    source: N.kilopowerKwe.source,
    url: N.kilopowerKwe.url,
  },
  {
    title: 'What does a crew need every day?',
    text: `NASA's Baseline Values and Assumptions Document (BVAD) lists what a person uses. Each astronaut breathes about ${N.o2PerAstronautKg.value} kg of oxygen, drinks and eats about ${N.waterPerAstronautKg.value} kg of water, and eats about ${N.foodPerAstronautKg.value} kg of packaged food per day. So a crew of 4 needs ${NEEDS.o2.toFixed(2)} kg of oxygen, ${NEEDS.water} kg of water and ${NEEDS.food.toFixed(1)} kg of food every day. Over 30 days that's ${Math.round(NEEDS.food * 30)} kg of food — which is why growing some of it helps.`,
    source: N.o2PerAstronautKg.source,
    url: N.o2PerAstronautKg.url,
  },
  {
    title: 'Can Mars make its own oxygen?',
    text: `Yes! Mars air is 95% carbon dioxide (CO₂). NASA's MOXIE experiment on the Perseverance rover pulled oxygen atoms out of CO₂ 16 times between 2021 and 2023. It made 122 grams in total, at up to ${N.moxieGramsPerHour.value} grams per hour. A much bigger future version could make oxygen for rocket fuel and for a crew to breathe.`,
    source: N.moxieGramsPerHour.source,
    url: N.moxieGramsPerHour.url,
  },
];

const QUESTIONS = [
  'Your battery is full and Nova warns of a dust storm tomorrow. What would you change today, and why?',
  'Why does the Moon base get a reactor in this game while the Mars base runs only on sunlight? What would you add to the Mars base?',
  'Shielding costs power now but only pays off later. Can you think of something on Earth that works the same way (insurance, savings, seat belts)?',
  'The Moon has more radiation but help from Earth is only 3 days away. Mars has less radiation but help is months away. Which world would you rather live on for a month? Defend your answer.',
  'Look at your debrief chart. Find the moment your margins were smallest. What warning signs did you see before it?',
  'NASA recycles 98% of water on the ISS. What would happen in the game if it were only 80%? (Hint: 4 crew need 10 kg of water a day.)',
  'Real forecasts are sometimes wrong (the game has false alarms too). Is it still worth preparing? Why?',
];

export default function Learn({ onBack }) {
  const [tab, setTab] = useState('learn');
  const sources = [
    ...Object.values(N).map((x) => ({ label: x.label, value: `${x.value} ${x.unit}`, source: x.source, url: x.url })),
    ...Object.values(EVENTS).map((e) => ({ label: `Event card: ${e.title}`, value: '“Why?” card', source: e.why.source, url: e.why.url })),
  ];

  return (
    <div className="screen">
      <div className="row">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>
      <h2 className="screen-title">Learn & teach</h2>
      <div className="tabs" role="tablist">
        {[['learn', '📘 Learn'], ['worlds', '🌕🔴 Moon vs Mars'], ['data', '📊 NASA data'], ['teacher', '🍎 Teacher']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab selected' : 'tab'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'learn' && (
        <>
          {LEARN.map((l) => <WhyCard key={l.title} why={{ ...l }} startOpen={false} />)}
          <h3 className="section-title">Every event card</h3>
          {Object.values(EVENTS).map((e) => (
            <WhyCard key={e.id} why={{ ...e.why, title: `${e.emoji} ${e.why.title}` }} />
          ))}
          <SpaceWeather />
        </>
      )}

      {tab === 'worlds' && (
        <div className="card">
          <div className="table-wrap">
            <table className="compare">
              <thead><tr><th></th><th>🌕 Moon south pole</th><th>🔴 Mars, Jezero</th></tr></thead>
              <tbody>
                <tr><td>Air</td><td>None</td><td>Thin CO₂ (about 1% of Earth's pressure)</td></tr>
                <tr><td>Radiation (surface)</td><td>{WORLDS.moon.doseMsvPerSol} mSv/day</td><td>{WORLDS.mars.doseMsvPerSol} mSv/day</td></tr>
                <tr><td>Sunlight</td><td>Like Earth, but low at the pole; long shadows</td><td>{Math.round(N.marsSunlight.value * 100)}% of Earth's; dust storms</td></tr>
                <tr><td>Day length</td><td>~29.5 Earth days for a full day–night cycle</td><td>{N.marsSolHours.value} hours (one sol)</td></tr>
                <tr><td>Water</td><td>Ice in permanently shadowed craters</td><td>Ice underground; old lake bed in Jezero</td></tr>
                <tr><td>Oxygen from local stuff</td><td>Can be baked out of regolith (being tested)</td><td>From CO₂ air (MOXIE proved it)</td></tr>
                <tr><td>Help from Earth</td><td>{WORLDS.moon.helpFromEarth}</td><td>{WORLDS.mars.helpFromEarth}</td></tr>
                <tr><td>Main lesson</td><td>{WORLDS.moon.lesson}</td><td>{WORLDS.mars.lesson}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="card">
          <p className="muted">Every number in the game is in one file, <code>src/data/numbers.json</code>, with its source. Values are rounded for young players. Game-design numbers (battery size, greenhouse speed) are built on top of these.</p>
          <ul className="sources">
            {sources.map((s) => (
              <li key={s.label}>
                <span className="src-label">{s.label}</span>
                <b className="src-value">{s.value}</b>
                <a href={s.url} target="_blank" rel="noreferrer">{s.source} ↗</a>
              </li>
            ))}
          </ul>
          <p className="muted small">The game's mission limit of {G.doseLimitMsv} mSv is a teaching choice: 1/12 of NASA's {N.careerDoseLimitMsv.value} mSv career limit for one month on the surface.</p>
        </div>
      )}

      {tab === 'teacher' && (
        <>
          <div className="card">
            <h3>One class period (45 min)</h3>
            <ol>
              <li><b>5 min</b> — Hook: “Could YOU keep a crew alive on Mars for 30 days?” Show the two worlds.</li>
              <li><b>15 min</b> — Students play one mission alone or in pairs (10–15 minutes per run).</li>
              <li><b>10 min</b> — Compare debriefs: who survived? What was each turning point?</li>
              <li><b>10 min</b> — Discussion questions below.</li>
              <li><b>5 min</b> — Exit ticket: “The one thing I'd do differently is…”</li>
            </ol>
            <p className="muted">Works on any phone or laptop. No login, no data collected; progress is saved only in the browser.</p>
          </div>
          <div className="card">
            <h3>Class discussion questions</h3>
            <ol>{QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ol>
          </div>
          <div className="card">
            <h3>Learning goals</h3>
            <ul>
              <li>Power is the master resource: every other system depends on it.</li>
              <li>Shielding, food and spare parts cost something now but save the mission later.</li>
              <li>The Moon and Mars punish you differently: lunar shadows versus dust storms, thin air versus no air.</li>
              <li>Real missions plan for bad events with margins and backups.</li>
            </ul>
          </div>
          <div className="card">
            <h3>AI use (disclosure)</h3>
            <p className="muted">This project was built with help from an AI coding assistant (Claude), which drafted code, Nova's lines and the “Why?” text. Every number and story was checked against the NASA and peer-reviewed sources listed in the NASA data tab. Nova's voice uses your browser's built-in text-to-speech. No live AI is called while you play, and no AI-generated images are used: all art is emoji and hand-made SVG.</p>
          </div>
        </>
      )}
    </div>
  );
}
