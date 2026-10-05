# Survive 30 Sols 🚀

**NASA Space Apps 2026 · Build a Junior Astronaut Mission Trainer**

A turn-based outpost game where students (ages 10–15) keep a crew of 4 alive on the **Moon** or **Mars** for 30 days, using real NASA numbers.

> *"Every sol you get one power budget and one big decision. Will your crew make it home?"*

- Free, no login, works on any phone or laptop
- One mission takes 10–15 minutes: 30 turns of about 20 seconds
- Real NASA data drives every number and event

## Submission summary

Survive 30 Sols puts students in charge of a lunar or Martian outpost. Each sol they split one power budget between life support, food, shielding and storage, then face events drawn from real NASA missions, like the 2018 Mars dust storm. A debrief shows the decision that saved or ended their mission, making engineering trade-offs something kids feel, not just read.

## Dashboard: Live Space Explorer (start page)

The app now opens on a **Live Space Explorer**. You fly from the whole galaxy down to the satellites over your head, and tap anything to get an information card. The **🚀 Next: Mission Dashboard** button (or "Run the 30-sol simulation here" on Jezero or the lunar south pole) leads to the mission page where you pick the Moon or Mars.

| View | What you see | How real is it? |
|---|---|---|
| 🌌 Galaxy | Milky Way spiral, bar and bulge, Sun's 26,000-light-year orbit, Sagittarius A*, Magellanic Clouds | Real proportions; star field is procedural |
| ☀️ Solar System | Planets, Moon, JWST (L2), SOHO (L1), Parker Solar Probe, Voyager 1 & 2, New Horizons, Juno, famous asteroids (Bennu, Apophis, Didymos, Ryugu, Eros, Phaethon, Itokawa) | Planets computed now from JPL Keplerian elements; asteroid orbits **live from NASA NeoWs**; probes from published distance, speed and direction |
| 🌍 Earth orbit | ISS, Tiangong, Hubble, TESS, Landsat 8/9, Terra, Aqua, NOAA-20, ICESat-2, GPM, SWOT, Sentinel-6, PACE, GOES-18/19, plus an optional layer of the ~150 brightest satellites | **Live**: CelesTrak orbital elements propagated with SGP4 every frame. Earth's rotation, the day/night line and the Moon are where they are right now |
| ☄️ Asteroids | This week's close approaches on a log-distance radar, with flyby paths, plus the predicted 2029 Apophis flyby | **Live from NASA NeoWs**: time, miss distance, speed, size, hazard flag. NeoWs gives no direction, so path direction is illustrative and the panel says so |
| 🌕 Moon | Lunar south pole (your base at Shackleton, Chandrayaan-3, IM-1, IM-2), the empty north pole (Peary crater), the far side (Chang'e-4/6), Apollo 11 & 17, Blue Ghost, orbiters (LRO, Chandrayaan-2, Danuri, CAPSTONE, ARTEMIS P1) | Lit by today's real Moon phase; day/night per site computed now; orbiters use their published orbits |
| 🔴 Mars | Jezero (Perseverance, Ingenuity), the north polar ice cap, Phoenix, Curiosity, Zhurong, InSight, Viking 1, orbiters (MRO, Odyssey, MAVEN, Mars Express, TGO, Hope, Tianwen-1), Phobos and Deimos | Real Mars clock (NASA Mars24): local time, Perseverance's sol number and the Sun's position are computed for this second |

- **Badges never overstate**: every card says LIVE DATA, LAST KNOWN (cached), COMPUTED NOW, PREDICTED, or REAL ORBIT · POSITION ESTIMATED. Nobody publishes live positions for Moon and Mars orbiters, so we use their real orbit size, shape, tilt and lap time, and mark the position along the orbit as an estimate.
- **Time controls**: ● LIVE, or speed up to 1 min/s, 10 min/s, 1 h/s or 1 day/s. "Watch the 2029 flyby" jumps to Apophis.
- **Offline-safe**: if CelesTrak or NASA can't be reached, the page says so and falls back to estimates (geostationary weather satellites stay exact). A check on each satellite's catalog name means a wrong NORAD number can never show the wrong object.
- **Polite caching**: elements are cached in `localStorage` (satellites 4 h, asteroid feed 3 h, asteroid orbits 24 h). The NASA API uses `DEMO_KEY` (30 requests/hour). For a busy classroom, get a free key at [api.nasa.gov](https://api.nasa.gov/) and build with `VITE_NASA_API_KEY=yourkey npm run build`.
- Tests check the math against known values: Earth at J2000, the January 2025 Mars opposition, the Mars24 worked example, full and new Moon dates, Phobos's 7.65-hour orbit, Voyager 1 reaching about one light-day in November 2026, and SGP4 heights.

Data: [`src/data/spacecraft.json`](src/data/spacecraft.json), [`src/data/asteroids.json`](src/data/asteroids.json), [`src/data/elements.json`](src/data/elements.json). Live sources: [CelesTrak](https://celestrak.org/NORAD/elements/), [NASA NeoWs](https://api.nasa.gov/), [JPL approximate planet positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [NASA GISS Mars24](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html).

## Mission Dashboard: 3D solar system

The second page is the "Mission Dashboard" (three.js). All eight planets and the Moon orbit the Sun with their **real orbital periods**, starting from where they **really are today** (JPL mean longitudes, circular-orbit approximation). Tap the Moon or Mars, either in 3D or with the buttons below it, and the camera flies to it. The target panel then shows live numbers for that world: today's distance from Earth, the radio-message delay, travel time, gravity, day length, temperature and surface radiation.

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

## First-person EVA (you are the Commander)

From the Briefing screen (or the **🧑‍🚀 EVA** button on the 3D view), step outside in first person:

- **Walk the base** with WASD and mouse look (desktop), or with PUBG-Mobile-style touch controls: a joystick, drag-to-look, and Scan, Jump, Sprint, Use and Lamp buttons.
- **Real gravity:** jumps and rover bounces use real surface gravity (Moon 1.62 m/s², Mars 3.71 m/s²). The same hop that lifts you 0.34 m on Earth takes you about 2.1 m high on the Moon and 0.9 m on Mars.
- **Sample scanner:** aim and click a rock to scan it. Each scan gives a real geology fact (anorthosite and the Apollo 15 Genesis Rock, south-pole ice confirmed by LCROSS, Jezero's olivine and carbonates, Opportunity's hematite "blueberries", and more). The game is weapon-free on purpose.
- **Rover simulator:** board the pressurized rover (E), drive with a cab view or chase camera, and watch the dashboard (speed, battery, heading, pitch, roll). It has low-gravity suspension (crests launch you into the air), collisions, battery drain and recharging at the base.
- **Greenhouse facility:** walk into the dome (plant racks, red and blue LED grow bars, a control console) and choose crops. Lettuce, potatoes, dwarf wheat and soybeans are all crops NASA has grown or studied for space (Veggie on the ISS, the Biomass Production Chamber, USU-Apogee wheat). The crop changes growth time, yield and morale in the real game.
- **Helmet HUD:** compass strip with a beacon marker, suit O₂ (recharge at the airlock), real dose rate in µSv/h, task list, interaction prompts, and an auto helmet lamp in the dark.
- **Detailed astronauts:** jointed suits with bearing rings, a life-support backpack, chest control module, gold visor, helmet lamps and commander stripes, plus a low-gravity walk cycle.
- **Sound (synthesized in the browser, no files):** suit fan, breathing, footsteps through your boots, radio squelch, scanner chirps and the rover motor. On Mars you also hear wind that gets louder in dust storms. On the Moon there's no outside sound at all, because there's no air to carry it. Mute with 🔊.

## Crew command: 1 Senior + 3 Junior Astronauts

You're the **Senior Astronaut**. Your three **Junior Astronauts** each have a specialty and a crew colour:

| Junior | Role | Specialty (★) |
|---|---|---|
| 🌱 Asha | Botanist | Greenhouse, rest |
| 🔧 Leo | Engineer | Repairs, solar panels, regolith shielding, reactor |
| 🪨 Mei | Geologist | Rock samples, lab analysis |

In first-person mode press **Q** (or tap **👥 Crew**) and give an order. The junior then **does the task live in 3D**:
- They plan a route around the habitat modules, battery and greenhouse wall, and walk it (leaving footprints).
- For inside jobs they **cycle the airlock**, take their helmet off and walk to the right station.
- They work with the right tool and pose: kneeling with a watering can in the greenhouse, shovelling regolith, brushing dust off panels, typing at the life-support rack or lab bench, or lying in their sleep pod.
- They radio back when they start and finish, with a real fact about the job.
- **👁 Watch** gives you a follow camera to see exactly what they're doing. **📻 Recall** calls them back, and **⏩ Fast-forward** speeds up crew work 4×.

Finished tasks **change the mission**: greenhouse growth, shielding, battery, science, morale, health, or a repair that uses a spare part. Each junior can finish one task per sol, and specialists work faster and get 50% more done. Rules: [`src/engine/crew.js`](src/engine/crew.js). Data: [`src/data/crew.json`](src/data/crew.json).

## The habitat (walk-in)

Use the airlock (E) to go inside. The module has working stations:
- **Life-support rack:** live O₂, water and repair status.
- **Comms:** today's real radio delay to Earth, plus CAPCOM's forecast.
- **Galley:** share a meal, +morale once per sol.
- **Medical bay:** crew health and radiation dose.
- **Lab bench:** turn the rocks you scanned outside into science points.
- **Exercise bike:** why astronauts exercise about 2 hours a day.
- **Sleep pods:** where juniors rest.
- **Command console:** opens crew orders.
- **Viewport window.**

## Historic sites and the sky

- **Mars:** NASA's **Ingenuity** helicopter at real size (49 cm), with the broken rotor blade from its 72nd and final flight in January 2024. Also Perseverance's **"Three Forks" sample depot**: the 10 tubes it left in 2022–23, marked with orange flags.
- **Moon:** a lander lying on its side, like **IM-1 "Odysseus"**, which tipped over near Malapert A close to the south pole in February 2024.
- **Satellites** pass overhead with a fact when they do: LRO at the Moon, MRO and MAVEN at Mars. Their passes are sped up.
- **Footprints:** you and the crew leave bootprints. On the Moon they stay (with no wind, Apollo prints can last tens of thousands to millions of years). On Mars the wind fills them in.

Historic sites show as ◇ on the compass, and visiting one is a commander task.

## Realistic graphics

The 3D views use a modern-game rendering pipeline with real NASA imagery and models.

**NASA assets** (public domain) from [NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources), optimized for the web:

| Asset | Used for |
|---|---|
| **Mars 2020 Perseverance Rover** (official 3D model, real size) | Parked in Jezero Crater; walk up to it in first person |
| **Ingenuity Mars Helicopter** (official 3D model) | At its final resting place, next to its broken blade |
| **Hipparcos Star Map** | The real Milky Way in the Moon sky and Mission Control |
| Mars (Viking), Jupiter, Saturn, Neptune, Venus maps | Planets in Mission Control |
| Earth (NASA Blue Marble based) and Moon maps, via [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets) | Earth on the lunar horizon (with clouds and atmosphere) and in Mission Control |

**Rendering techniques:**
- Ground-truth-style ambient occlusion (GTAO), bloom and sun glare with lens flare, SMAA anti-aliasing, ACES filmic tone mapping, and a subtle camera grade (vignette and grain).
- Image-based lighting, so visors, metal and solar panels reflect the sky and ground.
- PBR terrain with baked regolith textures: albedo, normal and roughness maps, blended at two scales so the tiling doesn't show. A high-detail patch around the base fades into a horizon ring.
- Fractured rocks (displaced shapes with flat fracture planes) and up to 6,000 pebbles.
- A Mars sky shader with dusty aerial perspective and the pale bluish glow that dust scatters around the Sun. The Moon has a black sky, a dazzling Sun and a real star field.
- Suits in PBR fabric with sheen, mirror-gold visors and polished bearing rings.
- An animated Sun with granulation and limb darkening in Mission Control.

**⚙ Graphics menu** (top bar and EVA view):
- **Auto** (default): reads the graphics chip. Dedicated GPUs get High, integrated graphics (most laptops and Chromebooks) get Medium, phones get Medium or Low, and software rendering gets Low.
- **Ultra:** ambient occlusion, 4K shadows, 6,000 pebbles.
- **High:** sharp 2K shadows and anti-aliasing.
- **Medium:** glare and soft shadows.
- **Low:** no post-effects and lower resolution.

**Keeping it smooth:**
- A **performance governor** measures the real frame rate and lowers the render resolution (and as a last resort the glare effects) when a device can't keep up. It raises the resolution again when there's headroom.
- Shadows are reused for a few frames, because the Sun doesn't move.
- The base view, which is a backdrop, is capped at 30–45 fps.
- Small rocks skip the shadow pass, bloom renders at half resolution, and NASA's Perseverance model is simplified from 549k to 100k vertices.

Measured work per frame on High dropped about 72–80% (from about 17 M to 3.5–4.8 M vertices, and from about 2,000 to 735 draw calls). Medium needs about 1.6–2.7 M vertices.

The regolith, rock, foil, fabric and panel textures are generated by [`scripts/build-textures.mjs`](scripts/build-textures.mjs) (`npm run textures`).

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
src/three/solarScene.js    3D Mission Dashboard scene (three.js)
src/three/explorerScene.js Live Space Explorer: galaxy, solar system, Earth/Moon/Mars orbit, asteroid radar
src/engine/space.js        real-time astronomy: JPL elements, Moon, Mars24 clock, Kepler orbits
src/live/live.js           live data: CelesTrak satellites, NASA NeoWs asteroids, caching
src/lib/satellite.js       SGP4 propagator (satellite.js)
src/three/world.js         shared surface world: terrain, sky, base hardware, status visuals
src/three/realism.js       PBR terrain/rocks, skies, real Earth & stars, env lighting, NASA models
src/three/post.js          post-processing: GTAO, bloom, SMAA, tone mapping, camera look
src/three/quality.js       Low / Medium / High / Auto graphics presets
public/models, public/textures   NASA models and maps, baked surface textures
src/three/baseScene.js     orbiting 3D base view
src/three/fppScene.js      first-person EVA + rover driving simulator
src/three/astronaut.js     detailed spacesuit model, walk cycle, work poses, tools
src/three/crewSim.js       junior astronauts: route-finding, airlock, tasks, live progress
src/three/habInterior.js   walk-in habitat module and its stations
src/three/heritage.js      Ingenuity, sample depot, tipped lander, satellites, footprints
src/engine/crew.js         crew task rules (one per junior per sol, specialist bonus)
src/audio/sound.js         Web Audio sound engine (synthesized)
src/engine/orbits.js       planet positions by date, Earth–target distance, radio delay
src/screens/               the 7 screens: live explorer dashboard, choose world, briefing, plan, event+report, debrief, learn+teacher
```

## AI use (disclosure)

Built with help from an AI coding assistant (Claude), which drafted code, Nova's lines and the "Why?" texts. All numbers and stories were checked against the NASA and peer-reviewed sources listed above. Nova's voice uses the browser's built-in text-to-speech. No live AI is called during play, and no AI-generated images are used: the art is NASA imagery and models, procedural textures, emoji and hand-made SVG.

*Not an official NASA product.*
