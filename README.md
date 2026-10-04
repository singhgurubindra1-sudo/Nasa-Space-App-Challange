# Survive 30 Sols 🚀

**NASA Space Apps 2026 · Build a Junior Astronaut Mission Trainer**

A turn-based outpost game where students (ages 10–15) keep a crew of 4 alive on the **Moon** or **Mars** for 30 days, using real NASA numbers.

> *"Every sol you get one power budget and one big decision. Will your crew make it home?"*

- Free, no login, works on any phone or laptop
- One mission takes 10–15 minutes: 30 turns of about 20 seconds
- Real NASA data drives every number and event

## Submission summary

Survive 30 Sols puts students in charge of a lunar or Martian outpost. Each sol they split one power budget between life support, food, shielding and storage, then face events drawn from real NASA missions, like the 2018 Mars dust storm. A debrief shows the decision that saved or ended their mission, making engineering trade-offs something kids feel, not just read.

## Mission Control: 3D solar system

The start page is a 3D "Mission Control" (three.js). All eight planets and the Moon orbit the Sun with their **real orbital periods**, starting from where they **really are today** (JPL mean longitudes, circular-orbit approximation). Tap the Moon or Mars, either in 3D or with the buttons below it, and the camera flies to it. The target panel then shows live numbers for that world: today's distance from Earth, the radio-message delay, travel time, gravity, day length, temperature and surface radiation.

- Drag to rotate, pinch or scroll to zoom, and set the sim speed (pause, 1, 8 or 40 days per second)
- Sizes and distances are squeezed so the outer planets fit on a phone, and the page says so
- Textures are drawn in code (no image downloads), and three.js loads separately so the game screens stay fast
- If WebGL is off, the page falls back to the normal world buttons

Orbit data: [`src/data/planets.json`](src/data/planets.json), from the [NASA Planetary Fact Sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html). A test checks that Mars comes out close to Earth at its real January 2025 opposition.

## 3D base view: Mars and Moon surfaces

During the mission, the Briefing, Plan and Event screens show your base in 3D. Each world has its own scene, all generated in code (no image files):

| | 🔴 Mars · Jezero Crater | 🌕 Moon · south pole |
|---|---|---|
| Sky | Butterscotch dusty sky with fog, like Perseverance photos | Black sky, stars, Earth low on the horizon |
| Ground | Red rocky plain, hundreds of boulders, a big hill and the crater rim | Grey cratered regolith, massifs, harsh long shadows from a low Sun |
| Power | Large flat solar array | Tall sun-tracking vertical solar arrays + a fission reactor behind a berm |
| Shared | Habitat modules, greenhouse dome, battery bank, antenna, rover, astronauts, lander | |

**The scene follows the game:**
- **Shielding:** the regolith mound over the habitat grows with your shielding %
- **Greenhouse:** plants grow with maturity, and grow lights brighten as you move the greenhouse slider
- **Battery:** the LED strip shows charge (green, yellow, red)
- **Repairs:** a red alarm beacon flashes when life support is broken or the hab leaks
- **Dust storm (Mars):** dust blows, the sky goes brown, and the solar panels get dusty
- **Shadow (Moon):** the Sun goes dark and the base lights come on
- **Event animations:** particle storms flash the sky, micrometeoroids streak in, and supply landers descend with engine flames

The 3D view pauses when it's scrolled off-screen, and it is skipped entirely if WebGL is unavailable.

## How the brief maps to features

| The brief asks for… | Survive 30 Sols gives… |
|---|---|
| An interactive game or app | A turn-based web game, 30 turns, playable in a browser |
| Students run a lunar or Martian outpost | Two maps: Moon south pole (Artemis region) and Jezero Crater, Mars |
| Balance life support, radiation shielding, power and food | One limited power budget shared by 4 systems, set with sliders every sol |
| Make engineering trade-offs tangible and fun | Every choice moves gauges; events punish weak spots |
| Not oversimplified, not too complex | 4 systems, 3 crew meters, plain words, a "Why?" card on every event |
| Experience what makes a mission fail or succeed | Mission debrief: a timeline of your choices and the one that mattered most |

## The core loop (one sol)

1. **Morning briefing** – Nova, the AI CAPCOM, reports status and the forecast
2. **Split the power** – 4 sliders (life support, greenhouse, shielding, science & repair); unspent power charges the battery
3. **Pick one action** – Build, Repair, Plant, Explore or Shelter
4. **Event card** – a real NASA-based surprise (or a calm day), with a "Why?" card
5. **Night report** – gauges update

**Win:** reach sol 30 with the crew alive. Stars for crew health, radiation dose, food left over and science.
**Lose:** oxygen or water hits zero, crew health hits zero, dose passes the mission limit, or the battery is dead 2 sols in a row.

**The turning point:** after a mission the game replays it ~4,000 times, each time changing one sol's choice. The sol where a different choice changes the ending most is shown as the turning point, with the single factor (one slider or the action) that made the difference. Example: *"On sol 8 you put 4 kWh into science & repair while life support was broken. With 8 kWh there instead, your crew would have survived all 30 sols."*

## NASA data

Every number lives in [`src/data/numbers.json`](src/data/numbers.json) with its source, so non-coders can check and balance it. The game also shows this list on its **Learn → NASA data** tab.

| Number in the game | Value | Source |
|---|---|---|
| Oxygen per astronaut | 0.82 kg/day | [NASA BVAD, NASA/TP-2015-218570/REV1](https://ntrs.nasa.gov/citations/20180001338) |
| Water per astronaut (drinking + food) | 2.5 kg/day | [NASA BVAD](https://ntrs.nasa.gov/citations/20180001338) |
| Food per astronaut (packaged) | 1.8 kg/day | [NASA BVAD](https://ntrs.nasa.gov/citations/20180001338) |
| Water recycled by life support | 98% | [NASA: ISS reaches 98% water recovery (2023)](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) |
| Sunlight at Mars | 43% of Earth's (586 vs 1361 W/m²) | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Mars surface radiation | 0.67 mSv/day | [Curiosity RAD, Hassler et al., *Science* 2014](https://www.science.org/doi/10.1126/science.1244797) |
| Moon surface radiation | 1.37 mSv/day | [Chang'e-4 LND, Zhang et al., *Science Advances* 2020](https://www.science.org/doi/10.1126/sciadv.aaz1334) |
| Astronaut career dose limit | 600 mSv | [NASA-STD-3001 radiation technical brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) |
| Lunar night | ~14 Earth days | [NASA Moon facts](https://science.nasa.gov/moon/facts/) |
| Small fission reactor | Kilopower: 1–10 kWe | [NASA Fission Surface Power](https://www.nasa.gov/exploration-systems-development-mission-directorate/fission-surface-power/) |
| Mars sol | 24.66 h | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| MOXIE oxygen from Mars air | up to 12 g/h, 122 g total | [NASA/JPL: MOXIE completes mission](https://www.jpl.nasa.gov/news/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/) |

Event "Why?" cards ([`src/data/events.json`](src/data/events.json)) cite: the 2018 dust storm that ended **Opportunity**, NASA's **DONKI** space-weather database, **LRO** lunar illumination, **ISS ECLSS** repairs, NASA's Meteoroid Environment Office, **Perseverance MEDA** weather, and **Artemis** cargo landers.

**Design choices built on the data** (not NASA values): the base's battery size (60 kWh), the 1 kWe reactor on the Moon (24 kWh/day), the Mars base being solar-only with a large array (to teach why NASA studies reactors for Mars), the greenhouse growth rate, and the mission dose limit of 50 mSv (1/12 of NASA's 600 mSv career limit). Gameplay health, morale and shielding effects are simplified for 10–15 year olds.

**Live data:** the Learn page shows the real Sun's last 30 days (solar flares and particle storms) from NASA's [DONKI API](https://api.nasa.gov/) using the public `DEMO_KEY`. Set `VITE_NASA_API_KEY` at build time to use your own key. If the API is unreachable the game still works fully.

## Moon vs Mars

| | 🌕 Moon · south pole rim | 🔴 Mars · Jezero Crater |
|---|---|---|
| Power | 1 kWe reactor (24 kWh) + 30 kWh solar | 50 kWh solar only |
| Signature event | Shadow: no solar for 3–5 days | Dust storm: solar −60% for 3–5 sols |
| Radiation | 1.37 mSv/day, big particle storms | 0.67 mSv/day, thin air helps |
| Other events | Micrometeoroid leaks | Cold snaps (+heating) |
| Bonus | Explore mines ice for water | Explore earns more science (ancient lake) |
| Lesson | Store energy and shield the hab | Build margins and backups |

## Balance test

`npm run simulate` plays 1,000 missions per world with two simulated players. Target from the build plan: about 40–60% wins on a first try.

```
MOON  first-try player wins 42.6% | careful player wins 99.6%
MARS  first-try player wins 45.8% | careful player wins 99.0%
```

## Run it

```bash
npm install
npm start          # play locally at http://localhost:5173 (also: npm run dev)
npm test           # engine tests
npm run simulate   # balance test (1,000 games per world)
npm run build      # production build in dist/
```

### Deploy to Netlify

The repo includes `netlify.toml`. In Netlify: **Add new site → Import from Git**, pick this repo, and it builds with `npm run build` and publishes `dist/`. The build uses relative paths, so `dist/` also works on GitHub Pages or any static host.

## Code map

```
src/data/numbers.json      all NASA values + game balance numbers (with sources)
src/data/events.json       7 event cards + "Why?" text with sources
src/engine/engine.js       game rules: nextSol(state, choices) → new state
src/engine/turningPoint.js counterfactual replays to find the decision that mattered most
src/engine/nova.js         Nova's briefing lines (pre-written, no live AI)
src/engine/strategies.js   preset plans for the debrief + simulated players
scripts/simulate.mjs       1,000-game balance script
src/three/solarScene.js    3D Mission Control scene (three.js)
src/three/baseScene.js     3D Mars / Moon surface base view, driven by game state
src/engine/orbits.js       planet positions by date, Earth–target distance, radio delay
src/screens/               the 6 screens: choose world, briefing, plan, event+report, debrief, learn+teacher
```

## AI use (disclosure)

Built with help from an AI coding assistant (Claude), which drafted code, Nova's lines and the "Why?" texts. All numbers and stories were checked against the NASA and peer-reviewed sources listed above. Nova's voice uses the browser's built-in text-to-speech. No live AI is called during play, and no AI-generated images are used: all art is emoji and hand-made SVG.

*Not an official NASA product.*
